"use strict";

/**
 * Deterministic warboard -> deck conversion.
 *
 * This is deliberately not an LLM call. A deck must be reproducible offline,
 * from the exact notes the user saved. "Structured" means normalized markdown;
 * the human review step is what adds judgment, not the converter.
 */

const { dateOnly } = require("./util");

const ACTION_PATTERNS = [
  /^\s*[-*]\s+\[[ xX]\]\s+(.+)$/,
  /^\s*(?:todo|next|action|step|follow[- ]?up)\s*[:\-]\s*(.+)$/i,
  /^\s*(?:i\s+)?(?:need to|must|should|have to)\s+(.+)$/i,
];

function cleanLine(line) {
  return line.replace(/\s+$/g, "");
}

function normalizeMarkdown(raw) {
  const lines = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .split("\n");

  const out = [];
  let inCode = false;
  for (const original of lines) {
    let line = cleanLine(original);
    if (/^\s*```/.test(line)) {
      inCode = !inCode;
      out.push(line);
      continue;
    }
    if (!inCode) {
      line = line.replace(/^\s*[*+]\s+/, "- ").replace(/^\s{0,3}#{1,6}\s+/g, (m) => m.trim() + " ");
    }
    out.push(line);
  }

  const collapsed = [];
  for (const line of out) {
    if (/^\s*$/.test(line) && collapsed.length && /^\s*$/.test(collapsed[collapsed.length - 1])) {
      continue;
    }
    collapsed.push(line);
  }
  return collapsed.join("\n").trim();
}

function firstMeaningfulLine(notes) {
  const lines = String(notes || "").split(/\r?\n/);
  let fallback = "";
  for (const line of lines) {
    // A heading usually repeats the deck title; it is not a purpose sentence.
    if (/^\s*#{1,6}\s/.test(line)) continue;
    const trimmed = line.replace(/^[>*\-\s]+/, "").replace(/\s+/g, " ").trim();
    if (!trimmed) continue;
    if (/^\[[ xX]\]/.test(trimmed)) continue;
    if (/^(todo|next|action|step)\b[:\-]/i.test(trimmed)) {
      if (!fallback) fallback = trimmed;
      continue;
    }
    // Prefer a real sentence for the README purpose.
    if (trimmed.length >= 30) return trimmed;
    if (!fallback && trimmed.length >= 8) fallback = trimmed;
  }
  return fallback;
}

function buildStructured({ title, notes }) {
  const body = normalizeMarkdown(notes);
  const header = [
    `# Structured notes — ${title}`,
    "",
    `_Normalized from the warboard on ${dateOnly()}. This is a draft: edit it before locking._`,
    "",
  ];

  if (!body) {
    return [...header, "## Empty warboard", "", "No notes were captured. Add the raw thinking first.", ""].join("\n");
  }

  return [...header, body, ""].join("\n");
}

function extractActions(notes) {
  const lines = String(notes || "").split(/\r?\n/);
  const found = [];
  const seen = new Set();

  for (const line of lines) {
    for (const pattern of ACTION_PATTERNS) {
      const match = pattern.exec(line);
      if (!match) continue;
      let text = match[1].trim().replace(/\s+/g, " ");
      if (text.length < 4) continue;
      text = text.replace(/^[-*]\s+/, "").replace(/[.;]\s*$/, "");
      const key = text.toLowerCase();
      if (seen.has(key)) break;
      seen.add(key);
      found.push(text);
      break;
    }
  }

  return found.slice(0, 25);
}

function buildActions({ notes, title }) {
  const actions = extractActions(notes);
  const header = [
    `# Actions — ${title}`,
    "",
    `_Checklist extracted from the warboard on ${dateOnly()}. Rewrite anything vague before locking._`,
    "",
  ];

  if (actions.length === 0) {
    return [
      ...header,
      "- [ ] Review 02-structured.md and write the first concrete action",
      "- [ ] Name the owner and the date this action is due",
      "",
    ].join("\n");
  }

  return [...header, ...actions.map((text) => `- [ ] ${text}`), ""].join("\n");
}

function buildReadme({ title, notes, warboardId, attachmentNames }) {
  const purpose = firstMeaningfulLine(notes);
  const attachments = attachmentNames && attachmentNames.length
    ? attachmentNames.map((name) => `- \`attachments/${name}\``).join("\n")
    : "- none";

  return [
    `# ${title}`,
    "",
    "## Purpose",
    "",
    purpose
      ? `${purpose}`
      : "[REVIEW: write one sentence on what this deck is for.]",
    "",
    "_Sharpen the sentence above so a reader who never saw the warboard knows why this deck exists._",
    "",
    "## Source",
    "",
    `- Warboard: \`${warboardId}\``,
    `- Converted: ${dateOnly()}`,
    `- Raw material: 01-source-notes.md (verbatim)`,
    `- Cleaned: 02-structured.md`,
    `- Next steps: 03-actions.md`,
    "",
    "## Attachments",
    "",
    attachments,
    "",
    "## Lock rule",
    "",
    "Once this deck is confirmed it is locked. Unlocking removes it from the current box.",
    "",
  ].join("\n");
}

/**
 * Build every deck file in memory.
 * `attachmentNames` are the names that will exist under deck/attachments/.
 */
function buildDeckFiles(input) {
  const title = String(input.title || "Untitled warboard").trim() || "Untitled warboard";
  const notes = String(input.notes || "");
  const attachmentNames = Array.isArray(input.attachmentNames) ? input.attachmentNames : [];

  return {
    "00-README.md": buildReadme({
      title,
      notes,
      warboardId: input.warboardId || "unknown",
      attachmentNames,
    }),
    "01-source-notes.md": [
      `# Source notes — ${title}`,
      "",
      `_Verbatim warboard material, captured ${dateOnly()}. Never edit this file; it is the evidence._`,
      "",
      "---",
      "",
      notes.trim() || "(no notes were captured)",
      "",
    ].join("\n"),
    "02-structured.md": buildStructured({ title, notes }),
    "03-actions.md": buildActions({ title, notes }),
  };
}

module.exports = {
  ACTION_PATTERNS,
  buildActions,
  buildDeckFiles,
  buildReadme,
  buildStructured,
  extractActions,
  firstMeaningfulLine,
  normalizeMarkdown,
};
