"use strict";

/**
 * The scanner.
 *
 * Two layers:
 *   1. regex rules from rules.js over the app's text files
 *   2. structural checks that must hold for the app to be what it claims
 *      (CSP, Electron hardening, path containment, supply chain, safe HTML)
 *
 * The scanner never executes project code. It reads bytes and matches patterns.
 */

const fs = require("node:fs");
const path = require("node:path");

const { RULES, matchesAny } = require("./rules");
const { walkProject } = require("./attest");

const TEXT_EXTENSIONS = new Set([
  ".js", ".cjs", ".mjs", ".ts", ".html", ".css", ".json",
  ".md", ".cmd", ".txt", ".yml", ".yaml",
]);

const TOOLING_PREFIX = "security/";

function lineOf(content, index) {
  return content.slice(0, index).split("\n").length;
}

function makeFinding(rule, relPath, content, index, messageOverride) {
  return {
    ruleId: rule.id,
    severity: rule.severity,
    name: rule.name,
    file: relPath,
    line: index === null ? null : lineOf(content, index),
    message: messageOverride || rule.message,
    remediation: rule.remediation,
  };
}

/** Apply the regex rules to one text file. */
function scanText(relPath, content) {
  const findings = [];
  for (const rule of RULES) {
    if (!rule.pattern || rule.pattern.source === "$^") continue;
    if (!matchesAny(rule.globs, relPath)) continue;
    const match = rule.pattern.exec(content);
    if (match && match.index !== undefined) {
      findings.push(makeFinding(rule, relPath, content, match.index));
    }
  }
  return findings;
}

function addStructural(findings, id, severity, name, file, message, remediation) {
  findings.push({ ruleId: id, severity, name, file, line: null, message, remediation });
}

function checkCsp(files, read, findings) {
  const rel = "src/renderer/index.html";
  if (!files.has(rel)) {
    return addStructural(findings, "SEC007", "HIGH", "renderer missing", rel, "index.html is missing.", "Restore the renderer.");
  }
  const content = read(rel);
  if (!content.includes("Content-Security-Policy")) {
    return addStructural(findings, "SEC007", "HIGH", "missing CSP", rel, "Renderer has no Content-Security-Policy meta tag.", "Add default-src 'self' and disallow inline/remote code.");
  }
  if (!/default-src\s+'self'/.test(content)) {
    addStructural(findings, "SEC007", "HIGH", "weak CSP", rel, "CSP does not pin default-src to 'self'.", "Set default-src 'self'.");
  }
  if (/script-src[^;]*'unsafe-inline'/.test(content)) {
    addStructural(findings, "SEC007", "HIGH", "inline script allowed", rel, "CSP allows inline scripts.", "Remove 'unsafe-inline' from script-src.");
  }
}

function checkElectron(files, read, findings) {
  const rel = "main.js";
  if (!files.has(rel)) {
    return addStructural(findings, "SEC008", "HIGH", "main missing", rel, "main.js is missing.", "Restore the Electron main process.");
  }
  const content = read(rel);
  const checks = [
    [/nodeIntegration:\s*false/, "nodeIntegration must be false"],
    [/contextIsolation:\s*true/, "contextIsolation must be true"],
    [/preload:\s*path\.join/, "a preload script must be set"],
  ];
  for (const [pattern, message] of checks) {
    if (!pattern.test(content)) {
      addStructural(findings, "SEC008", "HIGH", "electron hardening", rel, message, "Restore the secure BrowserWindow settings.");
    }
  }
  if (/nodeIntegration:\s*true/.test(content)) {
    addStructural(findings, "SEC008", "HIGH", "node integration on", rel, "nodeIntegration is true.", "Set it to false and use preload.");
  }
}

function checkShellGuard(files, read, findings) {
  const rel = "main.js";
  const content = read(rel);
  if (!content.includes("refusing to open a path outside")) {
    addStructural(findings, "SEC009", "HIGH", "shell guard missing", rel, "shell.openPath has no containment guard.", "Check isInside(store.root, resolved) before opening.");
  }
  if (!content.includes("isInside(store.root, resolved)")) {
    addStructural(findings, "SEC009", "HIGH", "shell containment check missing", rel, "No isInside check before shell.openPath.", "Add the containment check.");
  }
}

function checkSupplyChain(files, read, findings) {
  const rel = "package.json";
  if (!files.has(rel)) return;
  let manifest;
  try {
    manifest = JSON.parse(read(rel));
  } catch {
    return addStructural(findings, "SEC010", "HIGH", "package.json unreadable", rel, "package.json is not valid JSON.", "Fix the manifest.");
  }
  const scripts = manifest.scripts || {};
  for (const hook of ["preinstall", "install", "postinstall", "postprepare", "prepare"]) {
    if (scripts[hook]) {
      addStructural(findings, "SEC010", "HIGH", "install hook", rel, `package.json runs a '${hook}' script.`, "Remove install hooks; they execute on every install.");
    }
  }
  const deps = Object.keys(manifest.dependencies || {});
  if (deps.length > 0) {
    addStructural(findings, "SEC010", "HIGH", "runtime dependencies", rel, `Runtime dependencies present: ${deps.join(", ")}.`, "Keep runtime deps empty; Electron is a devDependency.");
  }
  const allowedDev = new Set(["electron"]);
  const unexpectedDev = Object.keys(manifest.devDependencies || {}).filter((name) => !allowedDev.has(name));
  if (unexpectedDev.length > 0) {
    addStructural(findings, "SEC010", "MED", "unexpected dev dependency", rel, `Dev dependencies outside the allowlist: ${unexpectedDev.join(", ")}.`, "Review and add to the allowlist deliberately.");
  }
}

function checkRemoteView(files, read, findings) {
  const rel = "main.js";
  const content = read(rel);
  if (/request\.method|req\.method/.test(content)) {
    addStructural(findings, "SEC011", "HIGH", "remote view may accept writes", rel, "The remote view server inspects the HTTP method, which implies write handling.", "Keep the remote view GET-only; no method branching.");
  }
  if (!content.includes('server.listen(port, "127.0.0.1"')) {
    addStructural(findings, "SEC011", "HIGH", "remote view not loopback", rel, "The remote view server is not pinned to 127.0.0.1.", "Bind loopback; reach it through tailscale serve.");
  }
}

function checkPathContainment(files, read, findings) {
  const rel = "src/core/store.js";
  if (!files.has(rel)) return;
  if (!read(rel).includes("assertInside(")) {
    addStructural(findings, "SEC012", "HIGH", "store path guard missing", rel, "The store does not call assertInside.", "Every write path must be proven inside the data root.");
  }
}

function checkSafeHtml(files, read, findings) {
  const rel = "src/renderer/app.js";
  if (!files.has(rel)) return;
  const content = read(rel);
  const forbidden = [
    [/document\.write\s*\(/, "document.write"],
    [/insertAdjacentHTML\s*\(/, "insertAdjacentHTML"],
  ];
  for (const [pattern, name] of forbidden) {
    const match = pattern.exec(content);
    if (match) {
      addStructural(findings, "SEC005", "HIGH", "unsafe HTML sink", rel, `${name} bypasses escaping.`, "Build DOM nodes or set textContent.");
    }
  }
  let index = content.indexOf(".innerHTML");
  let unsafe = 0;
  while (index !== -1) {
    const windowText = content.slice(index, index + 700);
    const escaped = windowText.includes("esc(") || /=\s*""/.test(windowText);
    if (!escaped) unsafe += 1;
    index = content.indexOf(".innerHTML", index + 1);
  }
  if (unsafe > 0) {
    addStructural(findings, "SEC005", "HIGH", "unescaped innerHTML", rel, `${unsafe} innerHTML assignment(s) do not visibly escape their data.`, "Use esc() on every interpolated value.");
  }
}

function checkBinaries(files, findings) {
  const banned = /\.(exe|dll|msi|scr|pif|com|bat|cmd|ps1|vbs|jar|msix)$/i;
  // Two reviewed scripts are allowed: the launcher and the publish helper.
  // Everything else executable is a finding until it is reviewed and added here.
  const allowed = new Set(["START-WARBOARD-BOX.cmd", "scripts/publish-to-github.ps1", "DOCTOR.ps1", "SHOW-DECKS.cmd", "PUSH-TO-GITHUB.cmd"]);
  for (const rel of files) {
    if (!banned.test(rel)) continue;
    if (allowed.has(rel.replace(/\\/g, "/"))) continue;
    addStructural(findings, "SEC015", "MED", "executable in project", rel, "A script/binary that can execute is tracked.", "Remove it or document and allowlist it explicitly.");
  }
}

/** Whole-project scan. Returns findings plus the file list that was scanned. */
function scanProject(root) {
  const relFiles = walkProject(root);
  const fileSet = new Set(relFiles);
  const findings = [];
  const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

  for (const rel of relFiles) {
    if (rel.replace(/\\/g, "/").startsWith(TOOLING_PREFIX)) continue;
    if (rel.replace(/\\/g, "/").startsWith("examples/")) continue;
    const ext = path.extname(rel).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    let content;
    try {
      content = read(rel);
    } catch {
      continue;
    }
    if (content.length > 2_000_000) continue;
    findings.push(...scanText(rel, content));
  }

  checkCsp(fileSet, read, findings);
  checkElectron(fileSet, read, findings);
  checkShellGuard(fileSet, read, findings);
  checkSupplyChain(fileSet, read, findings);
  checkRemoteView(fileSet, read, findings);
  checkPathContainment(fileSet, read, findings);
  checkSafeHtml(fileSet, read, findings);
  checkBinaries(relFiles, findings);

  const deduped = [];
  const seen = new Set();
  for (const finding of findings) {
    const key = `${finding.ruleId}|${finding.file}|${finding.line}|${finding.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(finding);
  }

  return { findings: deduped, scannedFiles: relFiles.length };
}

module.exports = {
  TEXT_EXTENSIONS,
  checkBinaries,
  checkCsp,
  checkElectron,
  checkPathContainment,
  checkRemoteView,
  checkSafeHtml,
  checkShellGuard,
  checkSupplyChain,
  lineOf,
  scanProject,
  scanText,
};
