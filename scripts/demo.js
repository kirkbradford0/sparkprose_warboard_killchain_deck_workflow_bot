"use strict";

/**
 * Generate a real, complete example under examples/.
 *
 *   node scripts/demo.js
 *
 * This exercises the same store the app uses. It is not a mock: the deck files,
 * the lock markers, the shipped box, and the manifests are the real artifacts.
 */

const fs = require("node:fs");
const path = require("node:path");

const { WarboardStore } = require("../src/core/store");

const APP_ROOT = path.resolve(__dirname, "..");
const EXAMPLES = path.join(APP_ROOT, "examples");
const DATA = path.join(EXAMPLES, "data");
const SOURCES = path.join(EXAMPLES, "source-files");

function reset() {
  fs.rmSync(EXAMPLES, { recursive: true, force: true });
  fs.mkdirSync(SOURCES, { recursive: true });
  fs.writeFileSync(
    path.join(SOURCES, "landlord-letter-draft.txt"),
    "Draft paragraph the user wrote during the warboard.\n",
    "utf8"
  );
  fs.mkdirSync(path.join(SOURCES, "references"), { recursive: true });
  fs.writeFileSync(
    path.join(SOURCES, "references", "case-manager.txt"),
    "Case manager name and phone go here (not a real person).\n",
    "utf8"
  );
}

function tree(dir, base = dir, depth = 0, lines = []) {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).replace(/\\/g, "/");
    lines.push(`${"  ".repeat(depth)}${entry.name}${entry.isDirectory() ? "/" : ""}  (${rel})`);
    if (entry.isDirectory()) tree(full, base, depth + 1, lines);
  }
  return lines;
}

function main() {
  reset();

  const store = new WarboardStore({
    appRoot: APP_ROOT,
    configPath: path.join(EXAMPLES, "settings.json"),
  });
  store.config.dataRoot = DATA;
  store.root = path.resolve(DATA);
  store.init();
  store.setBoxTarget(2);

  const input = (title, notes, attachments) => {
    const warboard = store.createWarboard(title);
    store.saveNotes(warboard.id, notes);
    if (attachments && attachments.length) store.addAttachments(warboard.id, attachments);
    const { deck } = store.convertWarboard(warboard.id);
    const locked = store.confirmDeck(deck.id);
    if (locked.confirmed !== true) {
      throw new Error(`deck failed validation: ${(locked.errors || []).join("; ")}`);
    }
    console.log(`locked ${deck.id} (${deck.title})`);
    return deck;
  };

  input(
    "Reentry housing letters",
    [
      "# housing packet",
      "",
      "Need a clean packet for the landlord: two references, the deposit conversation, and the sentence about the gap.",
      "",
      "- [ ] call the landlord",
      "- [ ] gather two references",
      "TODO: check the deposit",
      "I need to write one honest sentence about the gap.",
    ].join("\n"),
    [path.join(SOURCES, "landlord-letter-draft.txt"), path.join(SOURCES, "references")]
  );

  input(
    "Interview follow-up system",
    [
      "# interview follow-up",
      "",
      "Same-day thank-you template, a day-3 nudge, and a log so nothing gets forgotten.",
      "",
      "- [ ] write the same-day thank-you template",
      "- [ ] build the day-3 nudge",
      "- [ ] log every interview in the tracker",
    ].join("\n")
  );

  const shipped = store.shipBox();
  console.log(`shipped ${shipped.name} with ${shipped.decks.length} decks`);

  // Show an open box too: lock a third deck into the fresh box.
  input(
    "Court packet checklist",
    [
      "# court packet",
      "",
      "Checklist for the support packet the court can read without a lawyer translating it.",
      "",
      "- [ ] list every document we already have",
      "- [ ] write the one-paragraph context",
      "- [ ] confirm the delivery address",
    ].join("\n")
  );

  const state = store.getState();
  console.log("");
  console.log("BOX:", `${state.box.count}/${state.box.target}`, "canShip:", state.box.canShip);
  console.log("SHIPPED:", state.shipped.map((box) => box.name).join(", "));
  console.log("");
  console.log("examples/ tree:");
  console.log(tree(EXAMPLES).join("\n"));
  console.log("");
  console.log("manifest head:");
  console.log(
    fs
      .readFileSync(path.join(shipped.dir, "BOX-MANIFEST.md"), "utf8")
      .split("\n")
      .slice(0, 10)
      .join("\n")
  );
}

main();
