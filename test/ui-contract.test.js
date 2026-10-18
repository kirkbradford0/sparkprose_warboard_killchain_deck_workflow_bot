"use strict";

/**
 * UI contract tests — static wiring checks, no browser.
 *
 *   node test/ui-contract.test.js
 *
 * These catch the class of bug that only shows up when a human clicks:
 * an element id that does not exist, an IPC method the preload never exposes,
 * or a channel the main process never handles.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "src", "renderer", "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT, "src", "renderer", "app.js"), "utf8");
const preloadJs = fs.readFileSync(path.join(ROOT, "preload.js"), "utf8");
const mainJs = fs.readFileSync(path.join(ROOT, "main.js"), "utf8");

function idsInHtml() {
  const ids = new Set();
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) ids.add(match[1]);
  return ids;
}

function byIdRefs() {
  const refs = new Set();
  for (const match of appJs.matchAll(/byId\("([^"]+)"\)/g)) refs.add(match[1]);
  return refs;
}

function preloadMethods() {
  const methods = new Set();
  const block = preloadJs.slice(preloadJs.indexOf("exposeInMainWorld"));
  for (const match of block.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*):/gm)) methods.add(match[1]);
  return methods;
}

function apiRefs() {
  const refs = new Set();
  for (const match of appJs.matchAll(/\bapi\.([a-zA-Z][a-zA-Z0-9]*)\(/g)) refs.add(match[1]);
  return refs;
}

function preloadChannels() {
  const channels = new Set();
  for (const match of preloadJs.matchAll(/call\("([^"]+)"/g)) channels.add(match[1]);
  return channels;
}

function mainHandledChannels() {
  const channels = new Set();
  for (const match of mainJs.matchAll(/handle\("([^"]+)"/g)) channels.add(match[1]);
  return channels;
}

test("every byId() reference exists in index.html", () => {
  const ids = idsInHtml();
  const missing = [...byIdRefs()].filter((id) => !ids.has(id));
  assert.deepEqual(missing, [], `missing element ids: ${missing.join(", ")}`);
});

test("every tab view has a matching section", () => {
  const views = [...html.matchAll(/data-view="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(views.length >= 5);
  for (const view of views) {
    assert.ok(html.includes(`id="view-${view}"`), `missing section view-${view}`);
  }
});

test("every API method used by the renderer is exposed by preload", () => {
  const exposed = preloadMethods();
  const used = [...apiRefs()];
  const missing = used.filter((name) => !exposed.has(name));
  assert.deepEqual(missing, [], `preload does not expose: ${missing.join(", ")}`);
});

test("every channel invoked by preload is handled by main", () => {
  const invoked = preloadChannels();
  const handled = mainHandledChannels();
  const missing = [...invoked].filter((channel) => !handled.has(channel));
  assert.deepEqual(missing, [], `main does not handle: ${missing.join(", ")}`);
});

test("the renderer has no remote script or stylesheet (offline-first)", () => {
  const remoteScript = /<script[^>]+src="https?:\/\//i.test(html);
  const remoteStyle = /<link[^>]+href="https?:\/\//i.test(html);
  assert.equal(remoteScript, false, "renderer loads a remote script");
  assert.equal(remoteStyle, false, "renderer loads a remote stylesheet");
  assert.ok(html.includes("Content-Security-Policy"));
});

test("no Node integration is exposed to the window", () => {
  assert.match(mainJs, /nodeIntegration:\s*false/);
  assert.match(mainJs, /contextIsolation:\s*true/);
  assert.match(mainJs, /preload:/);
});

test("the remote view server binds loopback only and is read-only", () => {
  assert.match(mainJs, /server\.listen\(port, "127\.0\.0\.1"/);
  assert.equal(/method\s*===\s*"POST"/.test(mainJs), false, "remote server must not accept POST");
  const remoteBlock = mainJs.slice(mainJs.indexOf("function startRemoteServer"));
  assert.match(mainJs, /read-only|read only/i);
  assert.match(remoteBlock, /renderRemotePage\(\)/);
});

test("dangerous shell access is refused outside the app roots", () => {
  assert.match(mainJs, /refusing to open a path outside the app data root/);
  assert.match(mainJs, /isInside\(store\.root, resolved\)/);
});

test("the launcher runs the recursive security gate before Electron", () => {
  const launcher = fs.readFileSync(path.join(ROOT, "START-WARBOARD-BOX.cmd"), "utf8");
  assert.match(launcher, /security\\run\.js/);
  assert.match(launcher, /SKIP_SECURITY/);
  assert.ok(launcher.indexOf("security\\run.js") < launcher.indexOf("electron.exe"));
});

test("build and launch hooks are gated by security", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.match(pkg.scripts.pretest, /security\/run\.js --gate/);
  assert.match(pkg.scripts.prestart, /security\/run\.js --gate/);
  assert.match(pkg.scripts.security, /security\/run\.js --gate/);
  assert.match(pkg.scripts["security:baseline"], /--baseline/);
  for (const file of [
    "security/rules.js",
    "security/scan.js",
    "security/attest.js",
    "security/run.js",
    "security/BASELINE.json",
  ]) {
    assert.equal(fs.existsSync(path.join(ROOT, file)), true, `missing ${file}`);
  }
});
