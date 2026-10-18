"use strict";

/**
 * Warboard Box — Electron main process.
 *
 * Owns the window, the IPC surface, the optional read-only Tailscale view
 * server, and nothing else. All deck/box logic lives in src/core/store.js and
 * is covered by node test/core.test.js.
 */

const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const { WarboardStore } = require("./src/core/store");
const { CORE_FILES } = require("./src/core/validate");
const { isInside, readJson } = require("./src/core/util");

const APP_ROOT = __dirname;
const DOCS = path.join(APP_ROOT, "docs");
const SELFTEST = process.argv.includes("--selftest");

let store = null;
let win = null;
let remoteServer = null;
let remoteState = { running: false, port: null, error: null };

/* ------------------------------------------------------------------ store */

function initStore() {
  store = new WarboardStore({ appRoot: APP_ROOT });
  store.init();
  return store;
}

function safe(action) {
  try {
    return { ok: true, data: action() };
  } catch (issue) {
    return { ok: false, error: issue && issue.message ? issue.message : String(issue) };
  }
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (event, payload) => safe(() => fn(payload || {})));
}

/* ----------------------------------------------------- read-only view server */

function renderRemotePage() {
  const state = store.getState();
  const short = (text, size = 160) =>
    String(text || "").replace(/\s+/g, " ").slice(0, size);
  const row = (item) => `<li><b>${escapeHtml(item.title)}</b> — ${escapeHtml(item.status)}</li>`;
  const decks = state.decks.map(
    (deck) =>
      `<li><b>${escapeHtml(deck.title)}</b> — ${escapeHtml(deck.status)} ${
        deck.locked ? "(locked)" : ""
      } — <a href="/deck/${encodeURIComponent(deck.id)}/00-README.md">README</a></li>`
  );
  const shipped = state.shipped.map(
    (box) =>
      `<li>${escapeHtml(box.name)} — ${box.deckCount} decks — <a href="/box/${encodeURIComponent(
        box.name
      )}/BOX-MANIFEST.md">manifest</a></li>`
  );
  return `<!doctype html><html><head><meta charset="utf-8"><title>Warboard Box — remote view</title>
<style>body{background:#0b0d0c;color:#d7ffe9;font:14px/1.5 Consolas,monospace;padding:24px;max-width:900px;margin:auto}
h1{color:#4dff9e}b{color:#fff}a{color:#7fd4ff}ul{padding-left:18px}small{color:#6a8f7c}</style></head>
<body><h1>WARBOARD BOX — read-only remote view</h1>
<p>Box: <b>${state.box.count}/${state.box.target}</b> decks · data root <code>${escapeHtml(
    state.root
  )}</code></p>
<h2>Locked decks</h2><ul>${decks.join("") || "<li>none</li>"}</ul>
<h2>Shipped boxes</h2><ul>${shipped.join("") || "<li>none</li>"}</ul>
<h2>Warboards</h2><ul>${state.warboards.map(row).join("") || "<li>none</li>"}</ul>
<p><small>Read-only. Served on 127.0.0.1 and meant to be reached through <code>tailscale serve</code>.
This page can read; it cannot write, unlock, delete, or run anything.</small></p>
</body></html>`;
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function stopRemoteServer() {
  if (remoteServer) {
    try {
      remoteServer.close();
    } catch {
      // ignore
    }
    remoteServer = null;
  }
  remoteState = { running: false, port: null, error: null };
}

function startRemoteServer() {
  stopRemoteServer();
  if (!store.getConfig().remoteView) {
    return remoteState;
  }
  const port = Number.parseInt(store.getConfig().remotePort, 10) || 8795;
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const send = (code, body, type) => {
      response.writeHead(code, {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      response.end(body);
    };
    try {
      if (url.pathname === "/" || url.pathname === "/index.html") {
        return send(200, renderRemotePage(), "text/html; charset=utf-8");
      }
      if (url.pathname === "/api/state") {
        return send(200, JSON.stringify(store.getState(), null, 2), "application/json; charset=utf-8");
      }
      const deckMatch = /^\/deck\/([a-z0-9-]+)\/([^/]+)$/.exec(url.pathname);
      if (deckMatch) {
        const [, deckId, rawName] = deckMatch;
        const name = decodeURIComponent(rawName);
        const allowed = CORE_FILES.includes(name) || name.startsWith("attachments/");
        if (!allowed) return send(403, "forbidden", "text/plain");
        const deckDir = path.join(store.root, "decks", deckId);
        const target = path.resolve(deckDir, name);
        if (!isInside(deckDir, target) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
          return send(404, "not found", "text/plain");
        }
        return send(200, fs.readFileSync(target), "text/plain; charset=utf-8");
      }
      const boxMatch = /^\/box\/([A-Za-z0-9._-]+)\/(BOX-MANIFEST\.md)$/.exec(url.pathname);
      if (boxMatch) {
        const [, boxName] = boxMatch;
        const target = path.resolve(store.root, "boxes", "shipped", boxName, "BOX-MANIFEST.md");
        if (!isInside(path.join(store.root, "boxes", "shipped"), target) || !fs.existsSync(target)) {
          return send(404, "not found", "text/plain");
        }
        return send(200, fs.readFileSync(target), "text/plain; charset=utf-8");
      }
      return send(404, "not found", "text/plain");
    } catch (issue) {
      return send(500, String(issue && issue.message ? issue.message : issue), "text/plain");
    }
  });
  server.on("error", (issue) => {
    remoteState = { running: false, port, error: issue.message };
  });
  server.listen(port, "127.0.0.1", () => {
    remoteState = { running: true, port, error: null };
  });
  remoteServer = server;
  return remoteState;
}

/* ------------------------------------------------------------------ window */

function createWindow() {
  win = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#0b0d0c",
    title: "Warboard Box",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(APP_ROOT, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.loadFile(path.join(APP_ROOT, "src", "renderer", "index.html"));
  win.on("closed", () => {
    win = null;
  });
}

/* --------------------------------------------------------------- IPC wiring */

function registerIpc() {
  handle("state:get", () => store.getState());
  handle("app:meta", () => ({
    app: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    root: store.root,
    docs: DOCS,
  }));

  handle("config:save", (patch) => {
    const before = store.getConfig();
    const config = store.saveConfig(patch);
    if (before.remoteView !== config.remoteView || before.remotePort !== config.remotePort) {
      startRemoteServer();
    }
    return { config, state: store.getState() };
  });

  handle("warboard:create", ({ title }) => store.createWarboard(title));
  handle("warboard:get", ({ id }) => store.getWarboard(id));
  handle("warboard:notes", ({ id, text }) => store.saveNotes(id, text));
  handle("warboard:addPaths", ({ id, paths }) => store.addAttachments(id, paths));
  handle("warboard:removeAttachment", ({ id, name }) => store.removeAttachment(id, name));
  handle("warboard:convert", ({ id }) => store.convertWarboard(id));

  handle("deck:get", ({ id }) => store.getDeck(id));
  handle("deck:write", ({ id, name, content }) => store.writeDeckFile(id, name, content));
  handle("deck:confirm", ({ id }) => store.confirmDeck(id));
  handle("deck:unlock", ({ id }) => store.unlockDeck(id));
  handle("deck:delete", ({ id }) => {
    const meta = store.getDeck(id);
    if (meta.locked) throw new Error("unlock the deck before deleting it");
    require("node:fs").rmSync(path.join(store.root, "decks", id), { recursive: true, force: true });
    store.log("deck.deleted", { deck: id });
    return store.getState();
  });

  handle("box:setTarget", ({ target }) => store.setBoxTarget(target));
  handle("box:seal", () => store.sealBox());
  handle("box:unseal", () => store.unsealBox());
  handle("box:ship", ({ nextTarget }) => store.shipBox({ nextTarget }));
  handle("shipped:list", () => store.listShipped());

  handle("dialog:pickFiles", async () => {
    const result = await dialog.showOpenDialog(win, {
      title: "Attach files or folders to this warboard",
      properties: ["openFile", "openDirectory", "multiSelections"],
    });
    return result.canceled ? [] : result.filePaths;
  });
  handle("dialog:pickDataRoot", async () => {
    const result = await dialog.showOpenDialog(win, {
      title: "Choose the Warboard Box data folder",
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  handle("dialog:pickDocs", async () => {
    await shell.openPath(DOCS);
    return DOCS;
  });

  handle("shell:openPath", async ({ target }) => {
    const resolved = path.resolve(String(target || ""));
    const allowed = isInside(store.root, resolved) || isInside(APP_ROOT, resolved);
    if (!allowed) throw new Error("refusing to open a path outside the app data root");
    const result = await shell.openPath(resolved);
    if (result) throw new Error(result);
    return true;
  });

  handle("folder:deck", ({ id }) => {
    if (!/^[a-z0-9-]+$/.test(String(id || ""))) throw new Error("invalid deck id");
    const dir = path.join(store.root, "decks", id);
    if (!fs.existsSync(dir)) throw new Error("deck folder does not exist");
    return dir;
  });
  handle("folder:warboard", ({ id }) => {
    if (!/^[a-z0-9-]+$/.test(String(id || ""))) throw new Error("invalid warboard id");
    const dir = path.join(store.root, "warboards", id);
    if (!fs.existsSync(dir)) throw new Error("warboard folder does not exist");
    return dir;
  });
  handle("folder:shipped", ({ name }) => {
    if (!/^[A-Za-z0-9._-]+$/.test(String(name || ""))) throw new Error("invalid box name");
    const dir = path.join(store.root, "boxes", "shipped", name);
    if (!fs.existsSync(dir)) throw new Error("shipped box does not exist");
    return dir;
  });

  handle("remote:status", () => ({
    ...remoteState,
    enabled: store.getConfig().remoteView,
    port: store.getConfig().remotePort,
  }));
  handle("remote:start", () => {
    startRemoteServer();
    return remoteState;
  });
  handle("remote:stop", () => {
    stopRemoteServer();
    return remoteState;
  });

  handle("activity:recent", () => {
    const file = path.join(store.root, "logs", "activity.log");
    if (!fs.existsSync(file)) return [];
    return fs
      .readFileSync(file, "utf8")
      .trim()
      .split("\n")
      .slice(-12)
      .reverse()
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { at: "", event: "log", detail: line };
        }
      });
  });
}

/* ------------------------------------------------------------------- boot */

if (SELFTEST) {
  // Headless smoke: prove the core boots against this install without a window.
  app.whenReady().then(() => {
    try {
      const probe = new WarboardStore({
        appRoot: APP_ROOT,
        configPath: path.join(APP_ROOT, "config", "settings.selftest.json"),
      });
      probe.config.dataRoot = path.join(APP_ROOT, ".tmp-selftest");
      probe.root = path.resolve(probe.config.dataRoot);
      probe.init();
      const warboard = probe.createWarboard("selftest");
      probe.saveNotes(warboard.id, "TODO: prove the pipeline\n");
      const { deck } = probe.convertWarboard(warboard.id);
      const state = probe.getState();
      console.log(
        JSON.stringify({
          ok: true,
          deck: deck.id,
          files: Object.keys(deck.files),
          box: { count: state.box.count, target: state.box.target },
          root: probe.root,
        })
      );
      fs.rmSync(path.join(APP_ROOT, ".tmp-selftest"), { recursive: true, force: true });
      fs.rmSync(path.join(APP_ROOT, "config", "settings.selftest.json"), { force: true });
      app.exit(0);
    } catch (issue) {
      console.error("SELFTEST FAILED:", issue);
      app.exit(1);
    }
  });
} else {
  app.whenReady().then(() => {
    initStore();
    registerIpc();
    startRemoteServer();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    stopRemoteServer();
    if (process.platform !== "darwin") app.quit();
  });
}
