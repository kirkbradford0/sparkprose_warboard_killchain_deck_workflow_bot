"use strict";

/**
 * Deck completeness rules.
 *
 * A deck is never half-done: all four core files must exist, be non-empty, and
 * carry the minimum structure a later reader needs. These rules are enforced
 * at lock time (and re-checked at ship time), not just in the UI.
 */

const CORE_FILES = [
  "00-README.md",
  "01-source-notes.md",
  "02-structured.md",
  "03-actions.md",
];

const MIN_README_BODY = 40;

function validateDeckFiles(files) {
  const errors = [];

  for (const name of CORE_FILES) {
    const content = typeof files[name] === "string" ? files[name] : "";
    if (!content.trim()) {
      errors.push(`${name} is missing or empty`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, files: CORE_FILES };
  }

  const readme = files["00-README.md"];
  if (!/^#\s+\S/m.test(readme)) {
    errors.push("00-README.md needs a markdown heading (# Title)");
  }
  const readmeBody = readme.replace(/^#.*$/m, "").trim();
  if (readmeBody.length < MIN_README_BODY) {
    errors.push(
      `00-README.md needs a purpose summary of at least ${MIN_README_BODY} characters`
    );
  }

  const actions = files["03-actions.md"];
  if (!/^\s*[-*]\s+\S/m.test(actions)) {
    errors.push('03-actions.md needs at least one action line ("- [ ] ...")');
  }

  return { ok: errors.length === 0, errors, files: CORE_FILES };
}

module.exports = { CORE_FILES, MIN_README_BODY, validateDeckFiles };
