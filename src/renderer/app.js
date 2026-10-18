"use strict";

/* Warboard Box — renderer. Plain DOM, no framework, no network except IPC. */

const api = window.warboardBox;
const byId = (id) => document.getElementById(id);

const CORE_FILES = [
  "00-README.md",
  "01-source-notes.md",
  "02-structured.md",
  "03-actions.md",
];

const app = {
  data: null,
  meta: null,
  view: "warboards",
  warboard: null,
  deck: null,
  deckFile: "00-README.md",
  deckDirty: false,
  notesTimer: null,
  toastTimer: null,
  shipResult: null,
};

/* --------------------------------------------------------------- helpers */

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function flash(message, isError) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.toggle("err", Boolean(isError));
  toast.hidden = false;
  clearTimeout(app.toastTimer);
  app.toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, isError ? 6000 : 2600);
}

async function call(label, fn, successMessage) {
  try {
    const result = await fn();
    if (!result || result.ok !== true) {
      throw new Error((result && result.error) || `${label} failed`);
    }
    if (successMessage) flash(successMessage);
    return result.data;
  } catch (issue) {
    flash(issue.message || String(issue), true);
    return null;
  }
}

function setFoot(text) {
  byId("foot-activity").textContent = text;
}

function shortDate(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isDirty() {
  return app.deckDirty;
}

/* ------------------------------------------------------------------ boot */

async function boot() {
  startChrome();
  wireEvents();
  await refresh();
  setView("warboards");
  loadActivity();
  loadRemoteStatus();
  loadMeta();
}

/* ------------------------------------------------------------- chrome */

function startChrome() {
  const clock = byId("clock");
  const tick = () => {
    clock.textContent = new Date().toLocaleTimeString();
  };
  tick();
  setInterval(tick, 1000);

  const bootEl = byId("boot");
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    bootEl.classList.add("done");
    setTimeout(() => {
      bootEl.style.display = "none";
    }, 520);
  };
  byId("boot-skip").addEventListener("click", dismiss);
  setTimeout(dismiss, 2600);
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter" || event.key === "Escape") dismiss();
    },
    { once: true }
  );
}

function setTicker(text) {
  const el = byId("ticker");
  if (el) el.textContent = text;
}

async function loadMeta() {
  const meta = await call("meta", () => api.meta());
  if (!meta) return;
  app.meta = meta;
  const pre = byId("about");
  if (pre) {
    pre.textContent = [
      `WARBOARD BOX ${meta.app}  //  NEON-90`,
      `Electron ${meta.electron}  ·  Node ${meta.node}`,
      `data root: ${meta.root}`,
      `docs: ${meta.docs}`,
      "plain files only — no database",
      "recursive security gate: security/run.js --gate",
    ].join("\n");
  }
}

async function refresh() {
  const data = await call("refresh", () => api.state());
  if (!data) return;
  app.data = data;

  if (app.warboard && !data.warboards.some((item) => item.id === app.warboard.id)) {
    app.warboard = null;
  }
  if (app.deck) {
    const meta = data.decks.find((item) => item.id === app.deck.id);
    if (!meta) app.deck = null;
  }

  renderHeader();
  renderWarboards();
  renderDecks();
  renderBox();
  renderShipped();
  renderSettings();
}

/* ---------------------------------------------------------------- header */

function renderHeader() {
  const box = app.data.box;
  byId("pill-box").textContent = `BOX ${box.count}/${box.target}`;
  byId("pill-box").classList.toggle("ok", box.count >= box.target);
  setTicker(
    `WARBOARD BOX // BOX ${box.count}/${box.target} ${
      box.reached ? "TARGET REACHED" : "FILLING"
    } // ${app.data.warboards.length} WARBOARDS // ${app.data.decks.length} DECKS // ` +
      `${box.sealed ? "SEALED EARLY" : "SHIP LOCKED UNTIL TARGET"} // ELECTRON FEED STABLE`
  );
}

/* ------------------------------------------------------------- warboards */

function renderWarboards() {
  const list = byId("warboard-list");
  const items = app.data.warboards;
  byId("warboard-count").textContent = items.length;

  if (!items.length) {
    list.innerHTML = '<p class="hint">No warboards yet. Name one above and start dumping.</p>';
  } else {
    list.innerHTML = items
      .map((item) => {
        const active = app.warboard && app.warboard.id === item.id;
        const status =
          item.status === "converted"
            ? '<span class="chip locked">CONVERTED</span>'
            : '<span class="chip open">BRAINSTORM</span>';
        return `<button class="item ${active ? "on" : ""}" data-warboard="${esc(item.id)}">
          <span class="row1"><span class="ttl">${esc(item.title)}</span>${status}</span>
          <span class="sub"><span>${item.notesChars} chars</span><span>${item.attachmentCount} files</span><span>${shortDate(item.updated_at)}</span></span>
        </button>`;
      })
      .join("");
  }

  renderWarboardDetail();
}

function renderWarboardDetail() {
  const work = byId("warboard-work");
  const empty = byId("warboard-empty");
  const item = app.warboard;

  if (!item) {
    work.hidden = true;
    empty.hidden = false;
    return;
  }
  work.hidden = false;
  empty.hidden = true;

  byId("wb-title").textContent = item.title;
  byId("wb-meta").textContent = `${item.id} · ${shortDate(item.updated_at)}`;
  const notes = byId("wb-notes");
  if (document.activeElement !== notes) {
    notes.value = item.notes || "";
  }
  byId("wb-attach-count").textContent = item.attachments.length;
  byId("wb-attachments").innerHTML = item.attachments.length
    ? item.attachments
        .map(
          (name) => `<span class="attach">${esc(name)}<button data-remove="${esc(
            name
          )}" title="remove">×</button></span>`
        )
        .join("")
    : '<span class="hint">No attachments yet. Drop files or folders above.</span>';
}

function selectWarboard(id) {
  const item = app.data.warboards.find((entry) => entry.id === id);
  if (!item) return;
  app.warboard = item;
  app.deckDirty = false;
  renderWarboards();
}

async function createWarboard() {
  const input = byId("new-title");
  const title = input.value.trim();
  if (!title) {
    flash("Name the warboard first.", true);
    input.focus();
    return;
  }
  const created = await call("create warboard", () => api.createWarboard(title), "Warboard created");
  if (!created) return;
  input.value = "";
  await refresh();
  selectWarboard(created.id);
  byId("wb-notes").focus();
}

async function saveNotesNow() {
  if (!app.warboard) return;
  const text = byId("wb-notes").value;
  const line = byId("wb-save");
  line.textContent = "saving…";
  line.className = "saveline";
  const result = await api.saveNotes(app.warboard.id, text);
  if (!result.ok) {
    line.textContent = result.error;
    line.className = "saveline err";
    return;
  }
  app.warboard = result.data;
  const index = app.data.warboards.findIndex((item) => item.id === result.data.id);
  if (index >= 0) app.data.warboards[index] = result.data;
  line.textContent = `saved ${new Date().toLocaleTimeString()}`;
  line.className = "saveline ok";
  renderWarboards();
}

async function addPaths(paths) {
  if (!app.warboard) {
    flash("Pick a warboard first.", true);
    return;
  }
  if (!paths.length) return;
  const result = await call(
    "attach",
    () => api.addPaths(app.warboard.id, paths),
    `Attached ${paths.length} item(s)`
  );
  if (!result) return;
  app.warboard = result.warboard;
  await refresh();
  selectWarboard(app.warboard.id);
}

async function pickFiles() {
  const paths = await call("pick files", () => api.pickFiles());
  if (paths && paths.length) await addPaths(paths);
}

async function removeAttachment(name) {
  if (!app.warboard) return;
  const result = await call("remove attachment", () => api.removeAttachment(app.warboard.id, name));
  if (!result) return;
  app.warboard = result;
  await refresh();
  selectWarboard(app.warboard.id);
}

async function convertWarboard() {
  if (!app.warboard) return;
  const empty = !(app.warboard.notes || "").trim() && app.warboard.attachmentCount === 0;
  if (empty && !window.confirm("This warboard is empty. Convert it anyway?")) return;
  const result = await call(
    "convert",
    () => api.convertWarboard(app.warboard.id),
    "Deck draft created — review the four files, then lock"
  );
  if (!result) return;
  await refresh();
  setView("decks");
  await selectDeck(result.deck.id);
}

/* ----------------------------------------------------------------- decks */

function renderDecks() {
  const list = byId("deck-list");
  const items = app.data.decks;
  byId("deck-count").textContent = items.length;

  if (!items.length) {
    list.innerHTML = '<p class="hint">No decks yet. Convert a warboard to make one.</p>';
  } else {
    list.innerHTML = items
      .map((item) => {
        const active = app.deck && app.deck.id === item.id;
        const chip = item.locked
          ? '<span class="chip locked">LOCKED</span>'
          : '<span class="chip draft">DRAFT — REVIEW</span>';
        return `<button class="item ${active ? "on" : ""}" data-deck="${esc(item.id)}">
          <span class="row1"><span class="ttl">${esc(item.title)}</span>${chip}</span>
          <span class="sub"><span>${item.attachmentCount} attachments</span><span>${shortDate(
          item.locked ? item.locked_at : item.updated_at
        )}</span></span>
        </button>`;
      })
      .join("");
  }

  renderDeckDetail();
}

function renderDeckDetail() {
  const work = byId("deck-work");
  const empty = byId("deck-empty");
  const deck = app.deck;

  if (!deck) {
    work.hidden = true;
    empty.hidden = false;
    return;
  }
  work.hidden = false;
  empty.hidden = true;

  byId("deck-title").textContent = deck.title;
  byId("deck-meta").textContent = deck.locked
    ? `LOCKED ${shortDate(deck.locked_at)} · ${deck.id}`
    : `DRAFT · ${deck.id}`;

  byId("deck-lockbanner").hidden = !deck.locked;
  byId("deck-confirmrow").hidden = deck.locked;
  byId("deck-draftrow").hidden = deck.locked;

  const editor = byId("deck-file");
  editor.readOnly = deck.locked;
  byId("deck-savebtn").disabled = deck.locked;
  byId("deck-save").textContent = deck.locked ? "locked — read-only" : "—";
  byId("deck-save").className = "saveline";

  renderDeckTabs();
  if (document.activeElement !== editor) {
    editor.value = deck.files[app.deckFile] || "";
  }

  const validation = deck.validation || { ok: false, errors: [] };
  const rows = CORE_FILES.map((name) => {
    const content = (deck.files[name] || "").trim();
    const present = content.length > 0;
    return `<div class="vrow ${present ? "ok" : "err"}">${present ? "✓" : "✗"} ${name}</div>`;
  });
  if (deck.locked) {
    rows.push('<div class="vrow ok">✓ locked into the current box</div>');
  } else if (!validation.ok) {
    for (const error of validation.errors) {
      rows.push(`<div class="vrow err">✗ ${esc(error)}</div>`);
    }
  } else {
    rows.push('<div class="vrow ok">✓ all four files pass the completeness check</div>');
  }
  byId("deck-validation").innerHTML = rows.join("");

  const reviewed = byId("deck-reviewed");
  reviewed.checked = false;
  byId("deck-confirm").disabled = true;
}

function renderDeckTabs() {
  byId("deck-filetabs").innerHTML = CORE_FILES.map(
    (name) =>
      `<button data-file="${esc(name)}" class="${app.deckFile === name ? "on" : ""}">${esc(
        name
      )}</button>`
  ).join("");
}

async function selectDeck(id) {
  const deck = await call("load deck", () => api.getDeck(id));
  if (!deck) return;
  app.deck = deck;
  app.deckFile = CORE_FILES.includes(app.deckFile) ? app.deckFile : "00-README.md";
  app.deckDirty = false;
  renderDecks();
}

function switchDeckFile(name) {
  if (!app.deck) return;
  if (app.deckDirty && !window.confirm("Discard unsaved changes to this file?")) return;
  app.deckFile = name;
  app.deckDirty = false;
  renderDeckDetail();
}

async function saveDeckFile() {
  if (!app.deck) return;
  const content = byId("deck-file").value;
  const result = await call(
    "save file",
    () => api.writeDeckFile(app.deck.id, app.deckFile, content),
    "File saved"
  );
  if (!result) return;
  app.deck = result;
  app.deckDirty = false;
  await refresh();
  await selectDeck(app.deck.id);
}

async function confirmDeck() {
  if (!app.deck) return;
  if (!byId("deck-reviewed").checked) {
    flash("Tick the review box first.", true);
    return;
  }
  if (app.deckDirty) await saveDeckFile();
  const result = await call("lock deck", () => api.confirmDeck(app.deck.id));
  if (!result) return;
  if (result.confirmed === false) {
    flash(result.errors.join(" · "), true);
    app.deck = result;
    renderDeckDetail();
    return;
  }
  flash("Deck locked and added to the box");
  await refresh();
  await selectDeck(app.deck.id);
  renderHeader();
}

async function unlockDeck() {
  if (!app.deck) return;
  if (!window.confirm("Unlock this deck? It will be removed from the current box and become editable.")) {
    return;
  }
  const result = await call("unlock deck", () => api.unlockDeck(app.deck.id), "Deck unlocked");
  if (!result) return;
  await refresh();
  await selectDeck(app.deck.id);
  renderHeader();
}

async function deleteDeck() {
  if (!app.deck) return;
  if (!window.confirm("Delete this draft deck folder permanently?")) return;
  const result = await call("delete deck", () => api.deleteDeck(app.deck.id), "Draft deck deleted");
  if (!result) return;
  app.deck = null;
  await refresh();
}

async function openDeckFolder() {
  if (!app.deck) return;
  const folder = await call("deck folder", () => api.deckFolder(app.deck.id));
  if (!folder) return;
  await call("open folder", () => api.openPath(folder));
}

/* ------------------------------------------------------------------- box */

function renderBox() {
  const box = app.data.box;
  byId("box-count").textContent = box.count;
  byId("box-target").textContent = box.target;
  byId("box-target-input").value = box.target;

  const percent = box.target > 0 ? Math.min(100, (box.count / box.target) * 100) : 0;
  byId("box-bar").style.width = `${percent}%`;

  byId("box-seal").hidden = Boolean(box.sealed);
  byId("box-unseal").hidden = !box.sealed;
  byId("box-deck-count").textContent = box.decks.length;

  const shipButton = byId("box-ship");
  shipButton.disabled = !box.canShip;

  let hint = `${box.target - box.count > 0 ? box.target - box.count : 0} more to reach the target`;
  if (box.count >= box.target) hint = "Target reached — shipping is available";
  if (box.sealed && box.count < box.target) hint = "Box is sealed — shipping early is allowed";
  if (box.count === 0) hint = "Empty box. Lock decks into it first.";
  byId("box-hint").textContent = hint;

  byId("box-decks").innerHTML = box.decks.length
    ? box.decks
        .map(
          (deck) => `<div class="card">
            <b>${esc(deck.title)}</b>
            <span class="sub">${esc(deck.id)}</span>
            <span class="sub">locked ${shortDate(deck.locked_at)} · ${deck.attachmentCount} attachments</span>
            <div class="row">
              <span class="chip locked">LOCKED</span>
              <button class="ghost" data-box-deck="${esc(deck.id)}">REVIEW DECK</button>
            </div>
          </div>`
        )
        .join("")
    : '<p class="hint">No decks in this box yet. Convert a warboard, review it, lock it.</p>';
}

async function setBoxTarget(target) {
  const value = Number.parseInt(target, 10);
  if (!Number.isFinite(value) || value < 1 || value > 50) {
    flash("Target must be a whole number 1–50.", true);
    return;
  }
  const result = await call("set target", () => api.setBoxTarget(value), `Box target set to ${value}`);
  if (!result) return;
  await refresh();
}

async function sealBox() {
  const result = await call("seal", () => api.sealBox(), "Box sealed early — shipping now allowed");
  if (!result) return;
  await refresh();
}

async function unsealBox() {
  const result = await call("unseal", () => api.unsealBox(), "Box unsealed");
  if (!result) return;
  await refresh();
}

async function shipBox() {
  const box = app.data.box;
  if (!box.canShip) return;
  const message = `Ship box with ${box.count} deck(s)? Target was ${box.target}${
    box.sealed && box.count < box.target ? ", sealed early" : ""
  }.\n\nThis writes a dated copy + BOX-MANIFEST.md and starts a new empty box.`;
  if (!window.confirm(message)) return;
  const result = await call("ship box", () => api.shipBox());
  if (!result) return;
  app.shipResult = result;
  flash(`Shipped ${result.name}`);
  await refresh();
  renderShipResult();
}

function renderShipResult() {
  const panel = byId("ship-result");
  if (!app.shipResult) {
    panel.hidden = true;
    return;
  }
  const result = app.shipResult;
  panel.hidden = false;
  byId("ship-name").textContent = result.name;
  byId("ship-summary").textContent = `${result.decks.length} deck(s) · target ${result.target} · ${
    result.sealedEarly ? "sealed early" : "target reached"
  } · ${result.dir}`;
  byId("ship-manifest").textContent = result.manifest;
}

/* --------------------------------------------------------------- shipped */

function renderShipped() {
  const list = byId("shipped-list");
  const items = app.data.shipped;
  byId("shipped-count").textContent = items.length;

  if (!items.length) {
    list.innerHTML = '<p class="hint">Nothing shipped yet.</p>';
    return;
  }
  list.innerHTML = items
    .map(
      (box) => `<button class="item" data-shipped="${esc(box.name)}">
        <span class="row1"><span class="ttl">${esc(box.name)}</span>
        <span class="chip locked">${box.deckCount} DECKS</span>${
        box.sealedEarly ? '<span class="chip draft">SEALED EARLY</span>' : ""
      }</span>
        <span class="sub"><span>${shortDate(box.shipped_at)}</span><span>${esc(box.path)}</span></span>
      </button>`
    )
    .join("");
}

/* -------------------------------------------------------------- settings */

function renderSettings() {
  byId("set-root").value = app.data.root;
  byId("set-target").value = app.data.config.boxTarget;
  byId("set-remote").checked = Boolean(app.data.config.remoteView);
  byId("set-port").value = app.data.config.remotePort;
}

async function changeDataRoot() {
  const picked = await call("pick root", () => api.pickDataRoot());
  if (!picked) return;
  const ok = window.confirm(`Use this folder for all warboards, decks and boxes?\n\n${picked}`);
  if (!ok) return;
  const result = await call("move data root", () => api.saveConfig({ dataRoot: picked }), "Data folder changed");
  if (!result) return;
  await refresh();
}

async function saveDefaultTarget() {
  const value = Number.parseInt(byId("set-target").value, 10);
  if (!Number.isFinite(value) || value < 1 || value > 50) {
    flash("Target must be 1–50.", true);
    return;
  }
  const result = await call("save target", () => api.saveConfig({ boxTarget: value }), "Default target saved");
  if (!result) return;
  await refresh();
}

async function applyRemoteSettings() {
  const enabled = byId("set-remote").checked;
  const port = Number.parseInt(byId("set-port").value, 10);
  if (!Number.isFinite(port) || port < 1024 || port > 65535) {
    flash("Port must be 1024–65535.", true);
    return;
  }
  const result = await call(
    "remote settings",
    () => api.saveConfig({ remoteView: enabled, remotePort: port }),
    enabled ? "Remote view server enabled on 127.0.0.1" : "Remote view server disabled"
  );
  if (!result) return;
  await refresh();
  await loadRemoteStatus();
}

async function loadRemoteStatus() {
  const status = await call("remote status", () => api.remoteStatus());
  if (!status) return;
  const el = byId("remote-status");
  if (!status.enabled) {
    el.textContent = "Remote view is off. The app is local-only.";
    byId("pill-mode").textContent = "LOCAL";
    return;
  }
  if (status.running) {
    el.textContent = `Listening on 127.0.0.1:${status.port}. Reach it from another device with: tailscale serve --bg http://127.0.0.1:${status.port}`;
    byId("pill-mode").textContent = `VIEW :${status.port}`;
  } else {
    el.textContent = `Enabled on port ${status.port} but not listening: ${status.error || "starting…"}`;
  }
}

async function loadActivity() {
  const items = await call("activity", () => api.recentActivity());
  if (!items || !items.length) {
    setFoot("no activity yet");
    return;
  }
  const last = items[0];
  setFoot(`${last.event} ${last.at ? `· ${shortDate(last.at)}` : ""}`);
}

/* ------------------------------------------------------------ navigation */

function setView(view) {
  app.view = view;
  for (const button of document.querySelectorAll("#tabs button")) {
    button.classList.toggle("on", button.dataset.view === view);
  }
  for (const section of document.querySelectorAll(".view")) {
    section.classList.toggle("on", section.id === `view-${view}`);
  }
  if (view === "box") renderBox();
  if (view === "shipped") renderShipped();
  if (view === "settings") {
    renderSettings();
    loadRemoteStatus();
  }
  if (view === "decks") renderDecks();
  if (view === "warboards") renderWarboards();
}

/* --------------------------------------------------------------- events */

function wireEvents() {
  for (const button of document.querySelectorAll("#tabs button")) {
    button.addEventListener("click", () => setView(button.dataset.view));
  }

  byId("new-warboard").addEventListener("click", createWarboard);
  byId("new-title").addEventListener("keydown", (event) => {
    if (event.key === "Enter") createWarboard();
  });

  byId("warboard-list").addEventListener("click", (event) => {
    const target = event.target.closest("[data-warboard]");
    if (target) selectWarboard(target.dataset.warboard);
  });

  const notes = byId("wb-notes");
  notes.addEventListener("input", () => {
    byId("wb-save").textContent = "typing…";
    byId("wb-save").className = "saveline";
    clearTimeout(app.notesTimer);
    app.notesTimer = setTimeout(saveNotesNow, 700);
  });
  notes.addEventListener("blur", () => {
    clearTimeout(app.notesTimer);
    saveNotesNow();
  });

  byId("wb-add-files").addEventListener("click", pickFiles);
  byId("wb-convert").addEventListener("click", convertWarboard);
  byId("wb-attachments").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (button) removeAttachment(button.dataset.remove);
  });

  const drop = byId("wb-drop");
  for (const type of ["dragenter", "dragover"]) {
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.add("over");
    });
  }
  for (const type of ["dragleave", "dragend"]) {
    drop.addEventListener(type, () => drop.classList.remove("over"));
  }
  drop.addEventListener("drop", async (event) => {
    event.preventDefault();
    drop.classList.remove("over");
    const files = event.dataTransfer && event.dataTransfer.files;
    if (!files || !files.length) {
      flash("No files in that drop.", true);
      return;
    }
    const paths = api.pathsFromFiles(files);
    if (!paths.length) {
      flash("Could not read a path from the dropped item. Use CHOOSE FILES / FOLDERS.", true);
      return;
    }
    await addPaths(paths);
  });

  byId("deck-list").addEventListener("click", (event) => {
    const target = event.target.closest("[data-deck]");
    if (target) selectDeck(target.dataset.deck);
  });

  const tabs = byId("deck-filetabs");
  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-file]");
    if (!button) return;
    switchDeckFile(button.dataset.file);
  });

  const editor = byId("deck-file");
  editor.addEventListener("input", () => {
    app.deckDirty = true;
    byId("deck-save").textContent = "unsaved changes";
    byId("deck-save").className = "saveline";
  });
  byId("deck-savebtn").addEventListener("click", saveDeckFile);
  byId("deck-reviewed").addEventListener("change", (event) => {
    byId("deck-confirm").disabled = !event.target.checked;
  });
  byId("deck-confirm").addEventListener("click", confirmDeck);
  byId("deck-unlock").addEventListener("click", unlockDeck);
  byId("deck-delete").addEventListener("click", deleteDeck);
  byId("deck-openfolder").addEventListener("click", openDeckFolder);

  byId("box-target-save").addEventListener("click", () =>
    setBoxTarget(byId("box-target-input").value)
  );
  byId("box-seal").addEventListener("click", sealBox);
  byId("box-unseal").addEventListener("click", unsealBox);
  byId("box-ship").addEventListener("click", shipBox);
  byId("box-decks").addEventListener("click", (event) => {
    const target = event.target.closest("[data-box-deck]");
    if (target) {
      setView("decks");
      selectDeck(target.dataset.boxDeck);
    }
  });

  byId("ship-open").addEventListener("click", () => {
    if (app.shipResult) api.openPath(app.shipResult.dir);
  });
  byId("ship-copy").addEventListener("click", async () => {
    if (!app.shipResult) return;
    try {
      await navigator.clipboard.writeText(app.shipResult.manifest);
      flash("Manifest copied");
    } catch {
      flash("Could not copy", true);
    }
  });

  byId("shipped-list").addEventListener("click", (event) => {
    const target = event.target.closest("[data-shipped]");
    if (!target) return;
    const name = target.dataset.shipped;
    api.shippedFolder(name).then((folder) => {
      if (folder && folder.ok) api.openPath(folder.data);
    });
  });

  byId("set-root-pick").addEventListener("click", changeDataRoot);
  byId("set-root-open").addEventListener("click", () => api.openPath(app.data.root));
  byId("set-target-save").addEventListener("click", saveDefaultTarget);
  byId("set-remote-save").addEventListener("click", applyRemoteSettings);
  byId("open-tailscale-doc").addEventListener("click", () => api.openDocs());

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (app.view === "decks" && app.deck && !app.deck.locked) saveDeckFile();
      if (app.view === "warboards" && app.warboard) saveNotesNow();
    }
    if (event.ctrlKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      setView("warboards");
      byId("new-title").focus();
    }
  });
}

boot();
