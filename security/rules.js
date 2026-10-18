"use strict";

/**
 * Security rules. Data only.
 *
 * Each rule is a pattern that must never appear in files matching `globs`.
 * The scanner hashes this file before and after a run; if it changes during a
 * scan, that is a finding. Editing rules legitimately means re-baselining.
 *
 * Severity:
 *   HIGH - gate fails (build/launch blocked)
 *   MED  - reported, does not fail the gate by itself
 *   LOW  - reported only in the full report
 */

function globToRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "\u0001")
    .replace(/\*\*/g, "\u0002")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0001/g, "(?:.*/)?")
    .replace(/\u0002/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesAny(globs, relPath) {
  const normalized = relPath.replace(/\\/g, "/");
  return globs.some((glob) => globToRegex(glob).test(normalized));
}

/** Files the regex rules apply to by default. Tooling is hashed, not scanned. */
const APP_GLOBS = [
  "main.js",
  "preload.js",
  "package.json",
  "src/**/*.js",
  "src/**/*.html",
  "src/**/*.css",
  "src/**/*.json",
  "scripts/**/*.js",
  "docs/**/*.md",
  "README.md",
  "START-WARBOARD-BOX.cmd",
];

const RULES = [
  {
    id: "SEC001",
    severity: "HIGH",
    name: "secret material in source",
    message: "A credential-shaped string is in a tracked file. Secrets do not belong in this repo.",
    remediation: "Remove it, rotate it, and store it outside the repo (the vault, or an env file that is never committed).",
    globs: APP_GLOBS,
    pattern: /(-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{20,}|sk_live_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35})/,
  },
  {
    id: "SEC002",
    severity: "HIGH",
    name: "dynamic code execution",
    message: "eval / new Function / vm.runIn lets data become code. That is the AI-virus door.",
    remediation: "Parse JSON, use a fixed schema, or add an explicit rule-allowlist entry with a reason.",
    globs: ["main.js", "preload.js", "src/**/*.js", "scripts/**/*.js"],
    pattern: /(\beval\s*\(|new\s+Function\s*\(|vm\.runIn(Context|NewContext|ThisContext)\s*\()/,
  },
  {
    id: "SEC003",
    severity: "HIGH",
    name: "outbound network in app code",
    message: "Warboard Box is offline-first. App code must not call the network.",
    remediation: "Keep network paths in docs and external tools. The only server is the loopback read-only view.",
    globs: ["main.js", "preload.js", "src/**/*.js", "scripts/**/*.js"],
    pattern: /(\bfetch\s*\(|https?\.request\s*\(|https?\.get\s*\(|net\.connect\s*\(|new\s+WebSocket\s*\()/,
  },
  {
    id: "SEC004",
    severity: "HIGH",
    name: "child process / shell execution",
    message: "The app must not spawn processes. A shell is how generated code becomes system access.",
    remediation: "Remove it. Use Electron dialogs/shell.openPath for files, or a documented external tool.",
    globs: ["main.js", "preload.js", "src/**/*.js"],
    pattern: /(require\(["']node:child_process["']\)|require\(["']child_process["']\)|\bexecSync\s*\(|\bspawnSync\s*\(|\bos\.system\s*\()/,
  },
  {
    id: "SEC006",
    severity: "HIGH",
    name: "remote script, style, or import",
    message: "The renderer must not load code or styles from the network.",
    remediation: "Vendor the asset locally or draw it in CSS.",
    globs: ["src/**/*.html", "src/**/*.css"],
    pattern: /((?:src|href)\s*=\s*["']https?:\/\/|@import\s+url\(\s*["']?https?:\/\/)/,
  },
  {
    id: "SEC013",
    severity: "HIGH",
    name: "Electron security switch weakened",
    message: "webSecurity/allowRunningInsecureContent/openExternal off the leash.",
    remediation: "Restore the secure defaults; do not disable Chromium protections for convenience.",
    globs: ["main.js", "preload.js"],
    pattern: /(webSecurity\s*:\s*false|allowRunningInsecureContent\s*:\s*true|shell\.openExternal\s*\()/,
  },
  {
    id: "SEC015",
    severity: "MED",
    name: "binary or installer file in the project",
    message: "Executables, DLLs and installers are supply-chain payloads.",
    remediation: "Keep binaries out of the repo; reference them by hash from a controlled location.",
    globs: ["**/*"],
    pattern: /$^/, // structural check in scan.js; kept for registry completeness
  },
  {
    id: "SEC016",
    severity: "MED",
    name: "large embedded blob",
    message: "A very large base64-ish blob in source can hide a payload.",
    remediation: "Move data to a reviewed file with a hash, or split it.",
    globs: APP_GLOBS,
    pattern: /([A-Za-z0-9+/]{8000,}={0,2})/,
  },
];

module.exports = { APP_GLOBS, RULES, globToRegex, matchesAny };
