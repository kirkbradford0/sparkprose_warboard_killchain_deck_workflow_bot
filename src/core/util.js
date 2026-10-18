"use strict";

/**
 * Small filesystem helpers. No dependencies.
 *
 * Every path the app touches is proven to live inside the data root before a
 * write happens (assertInside). Deck and box ids are slugs; nothing a user
 * types becomes a path without passing through slugify().
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function exists(target) {
  try {
    fs.accessSync(target);
    return true;
  } catch {
    return false;
  }
}

function isInside(parent, child) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  if (rel === "") return true;
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

function assertInside(parent, child) {
  const resolved = path.resolve(child);
  if (!isInside(parent, resolved)) {
    throw new Error(`refused: path escapes the data root (${resolved})`);
  }
  return resolved;
}

function slugify(text, fallback = "item") {
  const slug = String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function stamp(date = new Date()) {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function dateOnly(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isoNow(date = new Date()) {
  return date.toISOString();
}

function uniqueChild(dir, baseName) {
  const parsed = path.parse(baseName);
  let candidate = path.join(dir, baseName);
  let counter = 2;
  while (exists(candidate)) {
    const name = parsed.ext
      ? `${parsed.name}-${counter}${parsed.ext}`
      : `${parsed.name}-${counter}`;
    candidate = path.join(dir, name);
    counter += 1;
  }
  return candidate;
}

function writeTextFile(file, text) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, String(text).replace(/\r\n/g, "\n"), "utf8");
  return file;
}

function readTextFile(file, fallback = "") {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  return writeTextFile(file, JSON.stringify(value, null, 2) + "\n");
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

/**
 * Copy a file or a whole folder into destDir, never overwriting a sibling.
 * Returns the destination path.
 */
function copyPathInto(sourcePath, destDir) {
  const stat = fs.statSync(sourcePath);
  ensureDir(destDir);
  const destination = uniqueChild(destDir, path.basename(sourcePath));
  if (stat.isDirectory()) {
    fs.cpSync(sourcePath, destination, { recursive: true, force: true });
  } else {
    fs.copyFileSync(sourcePath, destination);
  }
  return destination;
}

function listDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function removePath(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function countChars(text) {
  return String(text || "").length;
}

module.exports = {
  assertInside,
  copyPathInto,
  countChars,
  dateOnly,
  ensureDir,
  exists,
  isInside,
  isoNow,
  listDir,
  readJson,
  readTextFile,
  removePath,
  sha256File,
  slugify,
  stamp,
  uniqueChild,
  writeJson,
  writeTextFile,
};
