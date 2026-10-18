"use strict";

/**
 * Integrity chain + baseline.
 *
 * The chain is not a blockchain and does not pretend to be. It is a deterministic
 * rolling hash over sorted path + file hash pairs. It answers one question:
 * "did anything in this project change since the last accepted state, and did
 * the security tooling itself change?"
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SECURITY_DIR = "security";
const TOOLING_FILES = [
  "security/rules.js",
  "security/scan.js",
  "security/attest.js",
  "security/run.js",
];
const BASELINE_PATH = "security/BASELINE.json";
const REPORT_PATH = "security/report.json";

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "data",
  "examples",
  ".tmp-test",
  ".tmp-selftest",
  ".tmp-shot",
  ".tmp-seed",
  ".tmp-npm",
  ".tmp-electron",
]);

const EXCLUDED_FILES = new Set([
  BASELINE_PATH,
  REPORT_PATH,
  "package-lock.json",
  "config/settings.json",
  "config/settings.selftest.json",
]);

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function isExcluded(relPath) {
  const normalized = relPath.replace(/\\/g, "/");
  if (EXCLUDED_FILES.has(normalized)) return true;
  if (normalized.endsWith(".log")) return true;
  const parts = normalized.split("/");
  return parts.some((part) => EXCLUDED_DIRS.has(part) || part.startsWith(".tmp-"));
}

/** Every tracked file under root, sorted, with a hash each. */
function walkProject(root) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).replace(/\\/g, "/");
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name) || entry.name.startsWith(".tmp-")) continue;
        walk(full);
      } else if (entry.isFile() && !isExcluded(rel)) {
        files.push(rel);
      }
    }
  }
  walk(root);
  files.sort();
  return files;
}

function hashFiles(root, relFiles) {
  const map = {};
  for (const rel of relFiles) {
    map[rel] = sha256(fs.readFileSync(path.join(root, rel)));
  }
  return map;
}

/** Rolling chain over sorted "path:hash" strings. */
function chainRoot(fileHashes) {
  let rolling = sha256("warboard-box/chain/v1");
  for (const rel of Object.keys(fileHashes).sort()) {
    rolling = sha256(`${rolling}:${rel}:${fileHashes[rel]}`);
  }
  return rolling;
}

function toolingHash(root) {
  const parts = [];
  for (const rel of TOOLING_FILES) {
    const full = path.join(root, rel);
    parts.push(rel + ":" + (fs.existsSync(full) ? sha256(fs.readFileSync(full)) : "missing"));
  }
  return sha256(parts.join("|"));
}

function snapshot(root) {
  const files = walkProject(root);
  const hashes = hashFiles(root, files);
  return {
    version: 1,
    files,
    hashes,
    chainRoot: chainRoot(hashes),
    toolingHash: toolingHash(root),
    fileCount: files.length,
  };
}

/** What a previous baseline can tell us about the current tree. */
function compareToBaseline(root, baseline) {
  const current = snapshot(root);
  const drift = [];

  if (!baseline || !baseline.hashes) {
    return {
      current,
      drift: [{ kind: "no-baseline", severity: "HIGH", detail: "no baseline file; run --baseline" }],
      toolingChanged: true,
    };
  }

  const toolingChanged = current.toolingHash !== baseline.toolingHash;
  if (toolingChanged) {
    drift.push({
      kind: "tooling-changed",
      severity: "HIGH",
      detail: "security tooling changed since baseline; re-baseline after review",
    });
  }

  const baselineFiles = new Set(Object.keys(baseline.hashes));
  const currentFiles = new Set(Object.keys(current.hashes));

  for (const rel of baselineFiles) {
    if (!currentFiles.has(rel)) {
      drift.push({ kind: "removed", severity: "HIGH", path: rel, detail: "tracked file is gone" });
      continue;
    }
    if (baseline.hashes[rel] !== current.hashes[rel]) {
      const appCode = /^(main\.js|preload\.js|src\/)/.test(rel);
      drift.push({
        kind: "modified",
        severity: appCode ? "HIGH" : "MED",
        path: rel,
        detail: appCode ? "app code changed since baseline" : "non-app file changed since baseline",
      });
    }
  }

  for (const rel of currentFiles) {
    if (!baselineFiles.has(rel)) {
      drift.push({ kind: "added", severity: "MED", path: rel, detail: "file added since baseline" });
    }
  }

  return { current, drift, toolingChanged };
}

function readBaseline(root) {
  const file = path.join(root, BASELINE_PATH);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeBaseline(root, extra = {}) {
  const snap = snapshot(root);
  const baseline = {
    version: 1,
    generatedAt: new Date().toISOString(),
    note: "Hash chain of the accepted tree. Re-run security:baseline after an intentional change.",
    chainRoot: snap.chainRoot,
    toolingHash: snap.toolingHash,
    fileCount: snap.fileCount,
    hashes: snap.hashes,
    ...extra,
  };
  const file = path.join(root, BASELINE_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(baseline, null, 2) + "\n", "utf8");
  return baseline;
}

function writeReport(root, report) {
  const file = path.join(root, REPORT_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + "\n", "utf8");
  return file;
}

module.exports = {
  BASELINE_PATH,
  EXCLUDED_DIRS,
  EXCLUDED_FILES,
  REPORT_PATH,
  TOOLING_FILES,
  chainRoot,
  compareToBaseline,
  hashFiles,
  isExcluded,
  readBaseline,
  sha256,
  snapshot,
  toolingHash,
  walkProject,
  writeBaseline,
  writeReport,
};
