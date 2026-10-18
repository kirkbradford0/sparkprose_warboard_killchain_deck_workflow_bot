"use strict";

/**
 * WarboardStore — the whole application model, on disk, as plain files.
 *
 * Layout under the configured data root:
 *
 *   warboards/<id>/warboard.json, notes.md, attachments/
 *   decks/<id>/deck.json, 00-README.md, 01-source-notes.md,
 *              02-structured.md, 03-actions.md, attachments/, .locked
 *   boxes/current/box.json
 *   boxes/shipped/<BOX-...>/BOX-MANIFEST.md, box.json, decks/<id>/...
 *   activity.log                       (append-only JSONL, plain text)
 *
 * There is no database. Every deck and box is a folder a human can read,
 * zip, copy to a drive, or hand to another tool. The JSON files hold metadata
 * only; the content is markdown and attachments.
 */

const fs = require("node:fs");
const path = require("node:path");

const util = require("./util");
const { CORE_FILES, validateDeckFiles } = require("./validate");
const { buildDeckFiles } = require("./convert");

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

const DEFAULT_CONFIG = {
  dataRoot: "",
  boxTarget: 4,
  keepTargetOnShip: true,
  remoteView: false,
  remotePort: 8795,
};

function cleanTitle(title) {
  const value = String(title || "").replace(/\s+/g, " ").trim();
  return value.slice(0, 120) || "Untitled warboard";
}

function assertId(id) {
  if (!ID_RE.test(String(id || ""))) {
    throw new Error(`invalid id: ${id}`);
  }
  return id;
}

class WarboardStore {
  constructor(options = {}) {
    this.appRoot = options.appRoot || path.resolve(__dirname, "..", "..");
    this.configPath = options.configPath || path.join(this.appRoot, "config", "settings.json");
    this.config = { ...DEFAULT_CONFIG, ...util.readJson(this.configPath, {}) };
    if (!this.config.dataRoot) {
      this.config.dataRoot = path.join(this.appRoot, "data");
    }
    this.root = path.resolve(this.config.dataRoot);
    this.ready = false;
  }

  /* ---------------------------------------------------------------- setup */

  init() {
    util.ensureDir(this.root);
    for (const dir of ["warboards", "decks", "boxes", "boxes/current", "boxes/shipped", "logs"]) {
      util.ensureDir(this._p(dir));
    }
    util.writeJson(this.configPath, this.config);
    this._ensureBox();
    this.ready = true;
    return this;
  }

  _p(...parts) {
    return path.join(this.root, ...parts);
  }

  _warboardDir(id) {
    return util.assertInside(this.root, this._p("warboards", assertId(id)));
  }

  _deckDir(id) {
    return util.assertInside(this.root, this._p("decks", assertId(id)));
  }

  _boxPath() {
    return this._p("boxes", "current", "box.json");
  }

  _ensureBox() {
    const existing = this.getBoxRaw();
    if (existing) return existing;
    const number = this.listShipped().length + 1;
    const box = {
      id: `box-${util.stamp()}-${String(number).padStart(3, "0")}`,
      number,
      created_at: util.isoNow(),
      target: this._target(),
      deck_ids: [],
      sealed: false,
      sealed_at: null,
    };
    util.writeJson(this._boxPath(), box);
    this.log("box.created", { box: box.id, target: box.target });
    return box;
  }

  _target() {
    const value = Number.parseInt(this.config.boxTarget, 10);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_CONFIG.boxTarget;
  }

  log(event, detail = {}) {
    try {
      const line = JSON.stringify({ at: util.isoNow(), event, ...detail }) + "\n";
      util.writeTextFile(this._p("logs", "activity.log"), util.readTextFile(this._p("logs", "activity.log")) + line);
    } catch {
      // Logging must never break an operation.
    }
  }

  /* ---------------------------------------------------------------- config */

  getConfig() {
    return { ...this.config, dataRoot: this.root };
  }

  saveConfig(patch = {}) {
    const next = { ...this.config, ...patch };
    if (patch.dataRoot) {
      const resolved = path.resolve(String(patch.dataRoot));
      if (!path.isAbsolute(resolved)) throw new Error("data root must be an absolute path");
      next.dataRoot = resolved;
      this.root = resolved;
    }
    next.boxTarget = Math.max(1, Math.min(50, Number.parseInt(next.boxTarget, 10) || 4));
    this.config = next;
    util.writeJson(this.configPath, this.config);
    this.init();
    this.log("config.saved", { dataRoot: this.root, boxTarget: this.config.boxTarget });
    return this.getConfig();
  }

  /* ------------------------------------------------------------- warboards */

  listWarboards() {
    const items = util
      .listDir(this._p("warboards"))
      .filter((entry) => entry.isDirectory())
      .map((entry) => this._readWarboard(entry.name))
      .filter(Boolean)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    return items;
  }

  _readWarboard(id) {
    try {
      const dir = this._warboardDir(id);
      const meta = util.readJson(path.join(dir, "warboard.json"), null);
      if (!meta) return null;
      const notes = util.readTextFile(path.join(dir, "notes.md"), "");
      const attachments = util
        .listDir(path.join(dir, "attachments"))
        .map((entry) => entry.name)
        .sort();
      return {
        ...meta,
        notes,
        attachments,
        attachmentCount: attachments.length,
        notesChars: notes.length,
      };
    } catch {
      return null;
    }
  }

  createWarboard(title) {
    const clean = cleanTitle(title);
    let id = `w-${util.stamp()}-${util.slugify(clean, "warboard")}`;
    let suffix = 2;
    while (util.exists(this._p("warboards", id))) {
      id = `${id}-${suffix}`;
      suffix += 1;
    }
    const dir = this._warboardDir(id);
    util.ensureDir(path.join(dir, "attachments"));
    const meta = {
      id,
      title: clean,
      created_at: util.isoNow(),
      updated_at: util.isoNow(),
      status: "brainstorm",
      deckId: null,
    };
    util.writeJson(path.join(dir, "warboard.json"), meta);
    util.writeTextFile(path.join(dir, "notes.md"), "");
    this.log("warboard.created", { id, title: clean });
    return this._readWarboard(id);
  }

  getWarboard(id) {
    const item = this._readWarboard(id);
    if (!item) throw new Error(`warboard not found: ${id}`);
    return item;
  }

  saveNotes(id, text) {
    const dir = this._warboardDir(id);
    const meta = util.readJson(path.join(dir, "warboard.json"), null);
    if (!meta) throw new Error(`warboard not found: ${id}`);
    util.writeTextFile(path.join(dir, "notes.md"), String(text || ""));
    meta.updated_at = util.isoNow();
    util.writeJson(path.join(dir, "warboard.json"), meta);
    return this._readWarboard(id);
  }

  addAttachments(id, sourcePaths) {
    const dir = this._warboardDir(id);
    const meta = util.readJson(path.join(dir, "warboard.json"), null);
    if (!meta) throw new Error(`warboard not found: ${id}`);
    const target = util.ensureDir(path.join(dir, "attachments"));
    const added = [];
    for (const source of sourcePaths || []) {
      const resolved = path.resolve(String(source));
      if (!util.exists(resolved)) continue;
      const copied = util.copyPathInto(resolved, target);
      added.push(path.basename(copied));
    }
    meta.updated_at = util.isoNow();
    util.writeJson(path.join(dir, "warboard.json"), meta);
    this.log("warboard.attachments", { id, added });
    return { added, warboard: this._readWarboard(id) };
  }

  removeAttachment(id, name) {
    const attachments = util.assertInside(
      this.root,
      path.join(this._warboardDir(id), "attachments", path.basename(String(name)))
    );
    util.removePath(attachments);
    this.log("warboard.attachment.removed", { id, name });
    return this._readWarboard(id);
  }

  /* ----------------------------------------------------------------- decks */

  listDecks() {
    return util
      .listDir(this._p("decks"))
      .filter((entry) => entry.isDirectory())
      .map((entry) => this._readDeckMeta(entry.name))
      .filter(Boolean)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  }

  _readDeckMeta(id) {
    try {
      const dir = this._deckDir(id);
      const meta = util.readJson(path.join(dir, "deck.json"), null);
      if (!meta) return null;
      const attachments = util.listDir(path.join(dir, "attachments")).map((entry) => entry.name);
      return {
        ...meta,
        id,
        attachmentCount: attachments.length,
        attachments,
      };
    } catch {
      return null;
    }
  }

  getDeck(id) {
    const meta = this._readDeckMeta(id);
    if (!meta) throw new Error(`deck not found: ${id}`);
    const dir = this._deckDir(id);
    const files = {};
    for (const name of CORE_FILES) {
      files[name] = util.readTextFile(path.join(dir, name), "");
    }
    const validation = validateDeckFiles(files);
    return { ...meta, files, validation };
  }

  readDeckFile(id, name) {
    if (!CORE_FILES.includes(name)) throw new Error(`not an editable deck file: ${name}`);
    return util.readTextFile(path.join(this._deckDir(id), name), "");
  }

  writeDeckFile(id, name, content) {
    if (!CORE_FILES.includes(name)) throw new Error(`not an editable deck file: ${name}`);
    const dir = this._deckDir(id);
    const meta = util.readJson(path.join(dir, "deck.json"), null);
    if (!meta) throw new Error(`deck not found: ${id}`);
    if (meta.locked) {
      throw new Error("deck is locked. Unlock it first to edit.");
    }
    util.writeTextFile(path.join(dir, name), String(content || ""));
    meta.updated_at = util.isoNow();
    util.writeJson(path.join(dir, "deck.json"), meta);
    return this.getDeck(id);
  }

  convertWarboard(id) {
    const warboard = this.getWarboard(id);
    if (warboard.deckId) {
      const existing = this._readDeckMeta(warboard.deckId);
      if (existing) return { deck: this.getDeck(existing.id), existing: true };
    }

    let deckId = `d-${util.stamp()}-${util.slugify(warboard.title, "deck")}`;
    let deckSuffix = 2;
    while (util.exists(this._p("decks", deckId))) {
      deckId = `${deckId}-${deckSuffix}`;
      deckSuffix += 1;
    }
    const deckDir = this._deckDir(deckId);
    const attachmentsDir = util.ensureDir(path.join(deckDir, "attachments"));

    const attachmentNames = [];
    const sourceAttachments = path.join(this._warboardDir(id), "attachments");
    for (const entry of util.listDir(sourceAttachments)) {
      util.copyPathInto(path.join(sourceAttachments, entry.name), attachmentsDir);
      attachmentNames.push(entry.name);
    }

    const files = buildDeckFiles({
      title: warboard.title,
      notes: warboard.notes,
      warboardId: warboard.id,
      attachmentNames,
    });

    for (const [name, content] of Object.entries(files)) {
      util.writeTextFile(path.join(deckDir, name), content);
    }

    const deckMeta = {
      id: deckId,
      title: warboard.title,
      warboard_id: warboard.id,
      status: "draft",
      locked: false,
      created_at: util.isoNow(),
      updated_at: util.isoNow(),
      locked_at: null,
      validated_at: null,
    };
    util.writeJson(path.join(deckDir, "deck.json"), deckMeta);

    const warboardDir = this._warboardDir(id);
    const warboardMeta = util.readJson(path.join(warboardDir, "warboard.json"));
    warboardMeta.deckId = deckId;
    warboardMeta.status = "converted";
    warboardMeta.updated_at = util.isoNow();
    util.writeJson(path.join(warboardDir, "warboard.json"), warboardMeta);

    this.log("deck.converted", { deck: deckId, warboard: id, attachments: attachmentNames.length });
    return { deck: this.getDeck(deckId), existing: false };
  }

  confirmDeck(id) {
    const deck = this.getDeck(id);
    if (deck.locked) return deck;
    if (!deck.validation.ok) {
      return { ...deck, confirmed: false, errors: deck.validation.errors };
    }

    const dir = this._deckDir(id);
    const meta = util.readJson(path.join(dir, "deck.json"));
    meta.locked = true;
    meta.status = "locked";
    meta.locked_at = util.isoNow();
    meta.validated_at = util.isoNow();
    meta.updated_at = util.isoNow();
    util.writeJson(path.join(dir, "deck.json"), meta);
    util.writeTextFile(
      path.join(dir, ".locked"),
      `locked ${meta.locked_at}\nDeck: ${meta.title}\nUnlock removes this deck from the current box.\n`
    );

    const box = this._ensureBox();
    if (!box.deck_ids.includes(id)) {
      box.deck_ids.push(id);
      util.writeJson(this._boxPath(), box);
    }

    this.log("deck.locked", { deck: id, box: box.id, count: box.deck_ids.length });
    return { ...this.getDeck(id), confirmed: true, errors: [] };
  }

  unlockDeck(id) {
    const dir = this._deckDir(id);
    const meta = util.readJson(path.join(dir, "deck.json"), null);
    if (!meta) throw new Error(`deck not found: ${id}`);

    meta.locked = false;
    meta.status = "draft";
    meta.updated_at = util.isoNow();
    meta.locked_at = null;
    util.writeJson(path.join(dir, "deck.json"), meta);
    util.removePath(path.join(dir, ".locked"));

    const box = this._ensureBox();
    const before = box.deck_ids.length;
    box.deck_ids = box.deck_ids.filter((deckId) => deckId !== id);
    if (box.deck_ids.length !== before) {
      box.sealed = false;
      box.sealed_at = null;
      util.writeJson(this._boxPath(), box);
    }

    this.log("deck.unlocked", { deck: id, removedFromBox: before !== box.deck_ids.length });
    return this.getDeck(id);
  }

  /* ------------------------------------------------------------------- box */

  getBoxRaw() {
    return util.readJson(this._boxPath(), null);
  }

  getBox() {
    const box = this._ensureBox();
    const decks = box.deck_ids
      .map((id) => {
        const meta = this._readDeckMeta(id);
        if (!meta) return null;
        return {
          id: meta.id,
          title: meta.title,
          status: meta.status,
          locked: meta.locked,
          locked_at: meta.locked_at,
          warboard_id: meta.warboard_id,
          attachmentCount: meta.attachmentCount,
          updated_at: meta.updated_at,
        };
      })
      .filter(Boolean);
    const count = decks.filter((deck) => deck.locked).length;
    return {
      ...box,
      decks,
      count,
      target: box.target || this._target(),
      reached: count >= (box.target || this._target()),
      canShip: count > 0 && (count >= (box.target || this._target()) || box.sealed === true),
    };
  }

  setBoxTarget(target) {
    const box = this._ensureBox();
    const value = Number.parseInt(target, 10);
    if (!Number.isFinite(value) || value < 1 || value > 50) {
      throw new Error("box target must be a whole number between 1 and 50");
    }
    box.target = value;
    util.writeJson(this._boxPath(), box);
    this.config.boxTarget = value;
    util.writeJson(this.configPath, this.config);
    this.log("box.target", { box: box.id, target: value });
    return this.getBox();
  }

  sealBox() {
    const box = this._ensureBox();
    box.sealed = true;
    box.sealed_at = util.isoNow();
    util.writeJson(this._boxPath(), box);
    this.log("box.sealed", { box: box.id, count: box.deck_ids.length, target: box.target });
    return this.getBox();
  }

  unsealBox() {
    const box = this._ensureBox();
    box.sealed = false;
    box.sealed_at = null;
    util.writeJson(this._boxPath(), box);
    return this.getBox();
  }

  listShipped() {
    return util
      .listDir(this._p("boxes", "shipped"))
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const meta = util.readJson(path.join(this._p("boxes", "shipped"), entry.name, "box.json"), null);
        return {
          name: entry.name,
          path: path.join(this._p("boxes", "shipped"), entry.name),
          deckCount: meta && Array.isArray(meta.deck_ids) ? meta.deck_ids.length : 0,
          shipped_at: (meta && meta.shipped_at) || null,
          sealedEarly: Boolean(meta && meta.sealed_early),
        };
      })
      .sort((a, b) => String(b.name).localeCompare(String(a.name)));
  }

  shipBox(options = {}) {
    const box = this._ensureBox();
    const lockedDecks = box.deck_ids
      .map((id) => this._readDeckMeta(id))
      .filter((meta) => meta && meta.locked);

    if (lockedDecks.length !== box.deck_ids.length) {
      throw new Error("the box contains a deck that is not locked. No incomplete decks are allowed in a box.");
    }
    if (lockedDecks.length === 0) {
      throw new Error("the box is empty. Add at least one locked deck before shipping.");
    }
    const target = box.target || this._target();
    const reached = lockedDecks.length >= target;
    if (!reached && box.sealed !== true) {
      throw new Error(
        `box has ${lockedDecks.length}/${target} decks. Reach the target or seal the box to ship early.`
      );
    }

    const day = util.dateOnly();
    const existing = util
      .listDir(this._p("boxes", "shipped"))
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(`BOX-${day}-`)).length;
    const shippedName = `BOX-${day}-${String(existing + 1).padStart(3, "0")}`;
    const shippedDir = util.ensureDir(this._p("boxes", "shipped", shippedName));
    const decksDir = util.ensureDir(path.join(shippedDir, "decks"));

    const manifestRows = [];
    for (const meta of lockedDecks) {
      const source = this._deckDir(meta.id);
      const destination = path.join(decksDir, meta.id);
      fs.cpSync(source, destination, { recursive: true, force: true });

      const checksums = [];
      for (const name of CORE_FILES) {
        const file = path.join(destination, name);
        if (util.exists(file)) checksums.push(`${name}  ${util.sha256File(file)}`);
      }
      manifestRows.push({ meta, checksums });
    }

    const sealedEarly = !reached && box.sealed === true;
    const manifest = [
      `# BOX-MANIFEST — ${shippedName}`,
      "",
      `- Shipped: ${util.isoNow()}`,
      `- Box: ${box.id}`,
      `- Decks: ${lockedDecks.length}`,
      `- Target at ship time: ${target}`,
      `- Sealed early: ${sealedEarly ? "YES (manual seal)" : "no"}`,
      `- Data root: ${this.root}`,
      "",
      "## Decks",
      "",
      ...manifestRows.flatMap((row, index) => [
        `### ${index + 1}. ${row.meta.title}`,
        "",
        `- Deck id: \`${row.meta.id}\``,
        `- Locked: ${row.meta.locked_at}`,
        `- Source warboard: \`${row.meta.warboard_id}\``,
        `- Attachments: ${row.meta.attachmentCount}`,
        "- Files:",
        ...CORE_FILES.map((name) => `  - ${name}`),
        "- SHA-256:",
        ...row.checksums.map((line) => `  - ${line}`),
        "",
      ]),
      "## Rule",
      "",
      "This folder is a shipped, dated copy. Editing the source decks later does not change it.",
      "",
    ].join("\n");

    util.writeTextFile(path.join(shippedDir, "BOX-MANIFEST.md"), manifest);
    util.writeJson(path.join(shippedDir, "box.json"), {
      ...box,
      shipped_at: util.isoNow(),
      sealed_early: sealedEarly,
      shipped_name: shippedName,
      deck_ids: lockedDecks.map((meta) => meta.id),
    });

    // A new empty box starts automatically. Target is kept unless changed.
    const nextTarget = Math.max(1, Number.parseInt(options.nextTarget, 10) || target);
    const nextNumber = this.listShipped().length + 1;
    const nextBox = {
      id: `box-${util.stamp()}-${String(nextNumber).padStart(3, "0")}`,
      number: nextNumber,
      created_at: util.isoNow(),
      target: nextTarget,
      deck_ids: [],
      sealed: false,
      sealed_at: null,
    };
    util.writeJson(this._boxPath(), nextBox);
    this.config.boxTarget = nextTarget;
    util.writeJson(this.configPath, this.config);

    this.log("box.shipped", {
      box: box.id,
      shippedName,
      decks: lockedDecks.length,
      sealedEarly,
    });

    return {
      name: shippedName,
      dir: shippedDir,
      manifest,
      manifestPath: path.join(shippedDir, "BOX-MANIFEST.md"),
      decks: manifestRows.map((row) => ({ id: row.meta.id, title: row.meta.title })),
      target,
      sealedEarly,
      nextBox,
    };
  }

  /* ------------------------------------------------------------- aggregate */

  getState() {
    return {
      config: this.getConfig(),
      root: this.root,
      warboards: this.listWarboards(),
      decks: this.listDecks(),
      box: this.getBox(),
      shipped: this.listShipped(),
    };
  }
}

module.exports = { DEFAULT_CONFIG, WarboardStore, cleanTitle };
