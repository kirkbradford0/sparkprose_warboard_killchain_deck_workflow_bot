"use strict";

/**
 * Mutation tests for the security program.
 *
 *   node security/self-test.js
 *
 * A scanner that cannot be made to fail its own test is decoration. Every rule
 * gets a known-bad sample that must fire, and a known-good sample that must not.
 * The integrity chain is tested by changing real files in a throwaway tree.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { RULES } = require("./rules");
const {
  checkBinaries,
  checkCsp,
  checkElectron,
  checkPathContainment,
  checkRemoteView,
  checkSafeHtml,
  checkShellGuard,
  checkSupplyChain,
  scanText,
} = require("./scan");
const attest = require("./attest");

const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, "security", ".tmp-selftest");

function makeTmp(name) {
  const dir = path.join(TMP, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function write(dir, rel, content) {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function inMemory(files) {
  const map = new Map(Object.entries(files));
  return {
    files: new Set(map.keys()),
    read: (rel) => map.get(rel) || "",
    findings: [],
  };
}

function ruleFired(rel, content, ruleId) {
  return scanText(rel, content).some((finding) => finding.ruleId === ruleId);
}

test.after(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

/* ------------------------------------------------------------ regex rules */

test("SEC001 catches credential-shaped strings and leaves prose alone", () => {
  assert.equal(ruleFired("src/core/x.js", 'const key = "AKIAABCDEFGHIJKLMNOP";', "SEC001"), true);
  assert.equal(ruleFired("src/core/x.js", 'const key = "not-a-real-key-here";', "SEC001"), false);
  assert.equal(ruleFired("docs/NOTES.md", "-----BEGIN RSA PRIVATE KEY-----", "SEC001"), true);
});

test("SEC002 catches dynamic code and not the word in prose", () => {
  assert.equal(ruleFired("src/core/x.js", "eval(input)", "SEC002"), true);
  assert.equal(ruleFired("src/core/x.js", "new Function('return 1')", "SEC002"), true);
  assert.equal(ruleFired("src/core/x.js", "vm.runInNewContext(code)", "SEC002"), true);
  assert.equal(ruleFired("src/core/x.js", "// we never eval user input", "SEC002"), false);
});

test("SEC003 catches network clients in app code", () => {
  assert.equal(ruleFired("src/renderer/app.js", "await fetch('/x')", "SEC003"), true);
  assert.equal(ruleFired("src/core/x.js", "https.get(url)", "SEC003"), true);
  assert.equal(ruleFired("src/core/x.js", "const label = 'fetched';", "SEC003"), false);
});

test("SEC004 catches shell execution", () => {
  assert.equal(ruleFired("main.js", 'require("node:child_process")', "SEC004"), true);
  assert.equal(ruleFired("src/core/x.js", "execSync(cmd)", "SEC004"), true);
  assert.equal(ruleFired("main.js", "// child_process intentionally absent", "SEC004"), false);
});

test("SEC006 catches remote assets", () => {
  assert.equal(ruleFired("src/renderer/index.html", '<script src="https://evil/x.js"></script>', "SEC006"), true);
  assert.equal(ruleFired("src/renderer/styles.css", "@import url('https://evil/x.css');", "SEC006"), true);
  assert.equal(ruleFired("src/renderer/index.html", '<script src="app.js"></script>', "SEC006"), false);
});

test("SEC013 catches weakened Electron switches", () => {
  assert.equal(ruleFired("main.js", "webSecurity: false", "SEC013"), true);
  assert.equal(ruleFired("main.js", "shell.openExternal(url)", "SEC013"), true);
  assert.equal(ruleFired("main.js", "webSecurity: true", "SEC013"), false);
});

test("every rule has an id, severity, message and remediation", () => {
  for (const rule of RULES) {
    assert.match(rule.id, /^SEC\d{3}$/);
    assert.ok(["HIGH", "MED", "LOW"].includes(rule.severity));
    assert.ok(rule.name && rule.message && rule.remediation);
  }
});

/* ------------------------------------------------------- structural checks */

test("SEC005 flags unescaped innerHTML and accepts esc()", () => {
  const bad = inMemory({
    "src/renderer/app.js": "el.innerHTML = `<b>${title}</b>`;",
  });
  checkSafeHtml(bad.files, bad.read, bad.findings);
  assert.equal(bad.findings.some((f) => f.ruleId === "SEC005"), true);

  const good = inMemory({
    "src/renderer/app.js": "el.innerHTML = `<b>${esc(title)}</b>`;",
  });
  checkSafeHtml(good.files, good.read, good.findings);
  assert.equal(good.findings.some((f) => f.ruleId === "SEC005"), false);
});

test("SEC005 flags document.write and insertAdjacentHTML", () => {
  const bad = inMemory({ "src/renderer/app.js": "document.write(x);" });
  checkSafeHtml(bad.files, bad.read, bad.findings);
  assert.equal(bad.findings.some((f) => f.ruleId === "SEC005"), true);
});

test("SEC007 requires a real CSP", () => {
  const missing = inMemory({ "src/renderer/index.html": "<html></html>" });
  checkCsp(missing.files, missing.read, missing.findings);
  assert.equal(missing.findings.some((f) => f.ruleId === "SEC007"), true);

  const good = inMemory({
    "src/renderer/index.html":
      '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\';">',
  });
  checkCsp(good.files, good.read, good.findings);
  assert.equal(good.findings.length, 0);

  const weak = inMemory({
    "src/renderer/index.html":
      '<meta http-equiv="Content-Security-Policy" content="default-src *; script-src \'self\' \'unsafe-inline\';">',
  });
  checkCsp(weak.files, weak.read, weak.findings);
  assert.ok(weak.findings.length >= 1);
});

test("SEC008 requires Electron hardening", () => {
  const bad = inMemory({
    "main.js": "new BrowserWindow({ webPreferences: { nodeIntegration: true } });",
  });
  checkElectron(bad.files, bad.read, bad.findings);
  assert.equal(bad.findings.some((f) => f.ruleId === "SEC008"), true);

  const good = inMemory({
    "main.js":
      'new BrowserWindow({ webPreferences: { preload: path.join(__dirname, "preload.js"), nodeIntegration: false, contextIsolation: true } });',
  });
  checkElectron(good.files, good.read, good.findings);
  assert.equal(good.findings.length, 0);
});

test("SEC009 requires the shell containment guard", () => {
  const bad = inMemory({ "main.js": "shell.openPath(target);" });
  checkShellGuard(bad.files, bad.read, bad.findings);
  assert.equal(bad.findings.some((f) => f.ruleId === "SEC009"), true);

  const good = inMemory({
    "main.js":
      'if (!isInside(store.root, resolved)) throw new Error("refusing to open a path outside the app data root");',
  });
  checkShellGuard(good.files, good.read, good.findings);
  assert.equal(good.findings.length, 0);
});

test("SEC010 blocks install hooks and runtime dependencies", () => {
  const bad = inMemory({
    "package.json": JSON.stringify({
      scripts: { postinstall: "node evil.js" },
      dependencies: { leftpad: "1.0.0" },
    }),
  });
  checkSupplyChain(bad.files, bad.read, bad.findings);
  const ids = bad.findings.map((f) => f.ruleId);
  assert.ok(ids.includes("SEC010"));
  assert.equal(bad.findings.filter((f) => f.severity === "HIGH").length >= 2, true);

  const good = inMemory({
    "package.json": JSON.stringify({
      scripts: { start: "electron ." },
      devDependencies: { electron: "44.9.0" },
    }),
  });
  checkSupplyChain(good.files, good.read, good.findings);
  assert.equal(good.findings.length, 0);
});

test("SEC011 keeps the remote view loopback-only and GET-only", () => {
  const bad = inMemory({
    "main.js":
      'if (request.method === "POST") { write(); }\nserver.listen(port, "0.0.0.0");',
  });
  checkRemoteView(bad.files, bad.read, bad.findings);
  assert.equal(bad.findings.filter((f) => f.ruleId === "SEC011").length, 2);

  const good = inMemory({
    "main.js": 'server.listen(port, "127.0.0.1", () => {});',
  });
  checkRemoteView(good.files, good.read, good.findings);
  assert.equal(good.findings.length, 0);
});

test("SEC012 requires store path containment", () => {
  const bad = inMemory({ "src/core/store.js": "fs.writeFileSync(file, x);" });
  checkPathContainment(bad.files, bad.read, bad.findings);
  assert.equal(bad.findings.some((f) => f.ruleId === "SEC012"), true);

  const good = inMemory({ "src/core/store.js": "util.assertInside(this.root, target);" });
  checkPathContainment(good.files, good.read, good.findings);
  assert.equal(good.findings.length, 0);
});

test("SEC015 flags binaries but allows the reviewed launcher", () => {
  const findings = [];
  checkBinaries(["tool.exe", "START-WARBOARD-BOX.cmd", "src/app.js"], findings);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, "tool.exe");
});

/* --------------------------------------------------------- integrity chain */

test("the chain changes when any byte changes", () => {
  const dir = makeTmp("chain");
  write(dir, "a.txt", "one");
  write(dir, "b.txt", "two");
  const first = attest.snapshot(dir);
  write(dir, "b.txt", "three");
  const second = attest.snapshot(dir);
  assert.notEqual(first.chainRoot, second.chainRoot);
  assert.equal(first.fileCount, 2);
  assert.ok(first.hashes["a.txt"]);
});

test("baseline detects modified app code as HIGH and docs as MED", () => {
  const dir = makeTmp("drift");
  write(dir, "main.js", "nodeIntegration: false");
  write(dir, "docs/x.md", "hello");
  const baseline = attest.writeBaseline(dir);

  write(dir, "main.js", "nodeIntegration: true");
  write(dir, "docs/x.md", "hello world");
  const compared = attest.compareToBaseline(dir, baseline);
  const appDrift = compared.drift.find((entry) => entry.path === "main.js");
  const docDrift = compared.drift.find((entry) => entry.path === "docs/x.md");
  assert.equal(appDrift.severity, "HIGH");
  assert.equal(docDrift.severity, "MED");
});

test("tooling tamper is a HIGH baseline finding", () => {
  const dir = makeTmp("tooling");
  write(dir, "security/rules.js", "module.exports = [];");
  write(dir, "security/scan.js", "module.exports = {};");
  write(dir, "security/attest.js", "module.exports = {};");
  write(dir, "security/run.js", "// runner");
  write(dir, "main.js", "safe");
  const baseline = attest.writeBaseline(dir);
  write(dir, "security/rules.js", "module.exports = [ /* loosened */ ];");
  const compared = attest.compareToBaseline(dir, baseline);
  assert.equal(compared.toolingChanged, true);
  assert.ok(compared.drift.some((entry) => entry.kind === "tooling-changed" && entry.severity === "HIGH"));
});

test("the real project passes its own scan with zero HIGH findings", () => {
  const scan = require("./scan").scanProject(ROOT);
  const high = scan.findings.filter((finding) => finding.severity === "HIGH");
  assert.deepEqual(
    high.map((finding) => `${finding.ruleId} ${finding.file} ${finding.message}`),
    [],
    "the project must pass its own security gate"
  );
});
