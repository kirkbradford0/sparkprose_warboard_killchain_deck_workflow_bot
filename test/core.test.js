"use strict";

/**
 * Core tests — no Electron, no window, no network.
 *
 *   node test/core.test.js
 *
 * Every test builds a throwaway data root under the app folder and removes it
 * afterwards. The full flow is exercised: New Warboard -> notes + attachments
 * -> Convert to Deck -> review -> lock -> box target -> ship -> new box.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { WarboardStore } = require("../src/core/store");
const { validateDeckFiles, CORE_FILES } = require("../src/core/validate");
const { buildDeckFiles, extractActions } = require("../src/core/convert");
const { slugify, isInside } = require("../src/core/util");

const APP_ROOT = path.resolve(__dirname, "..");
const TMP_ROOT = path.join(APP_ROOT, ".tmp-test");
let counter = 0;

function makeStore() {
  const dir = path.join(TMP_ROOT, `case-${process.pid}-${++counter}`);
  fs.mkdirSync(dir, { recursive: true });
  const store = new WarboardStore({
    appRoot: dir,
    configPath: path.join(dir, "config", "settings.json"),
  });
  store.config.dataRoot = path.join(dir, "data");
  store.root = path.resolve(store.config.dataRoot);
  store.init();
  return { store, dir };
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function fillDeck(store, deckId) {
  store.writeDeckFile(
    deckId,
    "00-README.md",
    "# Test deck\n\n## Purpose\n\nThis deck exists to prove the lock rule works end to end.\n"
  );
  store.writeDeckFile(deckId, "01-source-notes.md", "raw notes about the thing\n");
  store.writeDeckFile(deckId, "02-structured.md", "# Structured\n\n- one\n- two\n");
  store.writeDeckFile(deckId, "03-actions.md", "# Actions\n\n- [ ] do the thing\n");
}

test("init creates the folder layout and an empty current box", () => {
  const { store, dir } = makeStore();
  try {
    for (const rel of ["warboards", "decks", "boxes/current", "boxes/shipped", "logs"]) {
      assert.equal(fs.existsSync(path.join(store.root, rel)), true, rel);
    }
    const box = store.getBox();
    assert.equal(box.count, 0);
    assert.equal(box.target, 4);
    assert.equal(box.canShip, false);
    assert.equal(store.getState().root, store.root);
  } finally {
    cleanup(dir);
  }
});

test("new warboard -> notes + attachments -> convert produces the four files", () => {
  const { store, dir } = makeStore();
  try {
    const warboard = store.createWarboard("Reentry housing ideas");
    assert.match(warboard.id, /^w-\d{8}-\d{6}-reentry-housing-ideas$/);

    store.saveNotes(
      warboard.id,
      "# housing\n\nTODO: call the landlord\n- [ ] gather two references\nNeed to check the deposit\n"
    );

    const fileA = path.join(dir, "note.txt");
    fs.writeFileSync(fileA, "hello", "utf8");
    const folder = path.join(dir, "references");
    fs.mkdirSync(folder);
    fs.writeFileSync(path.join(folder, "inside.txt"), "x", "utf8");

    const added = store.addAttachments(warboard.id, [fileA, folder]);
    assert.equal(added.added.length, 2);

    const { deck, existing } = store.convertWarboard(warboard.id);
    assert.equal(existing, false);
    assert.equal(deck.locked, false);
    assert.equal(deck.status, "draft");
    for (const name of CORE_FILES) {
      assert.equal(fs.existsSync(path.join(store.root, "decks", deck.id, name)), true, name);
      assert.ok(deck.files[name].length > 0, name);
    }
    assert.equal(fs.existsSync(path.join(store.root, "decks", deck.id, "attachments", "note.txt")), true);
    assert.equal(fs.existsSync(path.join(store.root, "decks", deck.id, "attachments", "references", "inside.txt")), true);

    assert.match(deck.files["02-structured.md"], /- \[ \] gather two references/);
    assert.match(deck.files["03-actions.md"], /- \[ \] call the landlord/);
    assert.match(deck.files["03-actions.md"], /- \[ \] gather two references/);

    const again = store.convertWarboard(warboard.id);
    assert.equal(again.existing, true);
    assert.equal(again.deck.id, deck.id);
  } finally {
    cleanup(dir);
  }
});

test("conversion is deterministic and never invents a fact", () => {
  const warboardNotes = "## idea\n\n- bullet one\n* star bullet\n\nTODO: ship it\n";
  const files = buildDeckFiles({ title: "Deterministic", notes: warboardNotes, warboardId: "w-1" });
  assert.match(files["02-structured.md"], /## idea/);
  assert.match(files["02-structured.md"], /- star bullet/);
  assert.match(files["03-actions.md"], /- \[ \] ship it/);
  assert.equal(files["01-source-notes.md"].includes(warboardNotes.trim()), true);
  const again = buildDeckFiles({ title: "Deterministic", notes: warboardNotes, warboardId: "w-1" });
  assert.deepEqual(files, again);
});

test("actions extractor: checkboxes, TODO, need-to, dedupe, cap", () => {
  const actions = extractActions(
    "- [ ] one thing\nTODO: two thing\nI need to call three\n- [ ] one thing\n"
  );
  assert.deepEqual(actions, ["one thing", "two thing", "call three"]);
});

test("an incomplete deck cannot lock and never reaches the box", () => {
  const { store, dir } = makeStore();
  try {
    const warboard = store.createWarboard("Incomplete");
    store.saveNotes(warboard.id, "short");
    const { deck } = store.convertWarboard(warboard.id);
    // Deliberately break the deck: blank the actions file.
    store.writeDeckFile(deck.id, "03-actions.md", "");
    const result = store.confirmDeck(deck.id);
    assert.equal(result.confirmed, false);
    assert.ok(result.errors.some((error) => /03-actions.md/.test(error)));
    assert.equal(store.getBox().count, 0);
  } finally {
    cleanup(dir);
  }
});

test("confirm locks the deck, marks read-only, and counts it in the box", () => {
  const { store, dir } = makeStore();
  try {
    const warboard = store.createWarboard("Complete deck");
    store.saveNotes(warboard.id, "short");
    const { deck } = store.convertWarboard(warboard.id);
    fillDeck(store, deck.id);

    const confirmed = store.confirmDeck(deck.id);
    assert.equal(confirmed.confirmed, true);
    assert.equal(confirmed.locked, true);
    assert.equal(store.getBox().count, 1);
    assert.equal(fs.existsSync(path.join(store.root, "decks", deck.id, ".locked")), true);

    assert.throws(
      () => store.writeDeckFile(deck.id, "00-README.md", "# changed"),
      /locked/
    );
  } finally {
    cleanup(dir);
  }
});

test("unlocking removes the deck from the current box and re-enables editing", () => {
  const { store, dir } = makeStore();
  try {
    const warboard = store.createWarboard("Unlock me");
    store.saveNotes(warboard.id, "short");
    const { deck } = store.convertWarboard(warboard.id);
    fillDeck(store, deck.id);
    store.confirmDeck(deck.id);
    assert.equal(store.getBox().count, 1);

    store.unlockDeck(deck.id);
    assert.equal(store.getBox().count, 0);
    assert.equal(store.getDeck(deck.id).locked, false);
    assert.equal(fs.existsSync(path.join(store.root, "decks", deck.id, ".locked")), false);

    const updated = store.writeDeckFile(deck.id, "02-structured.md", "# edited\n");
    assert.match(updated.files["02-structured.md"], /edited/);
  } finally {
    cleanup(dir);
  }
});

test("ship refuses below target unless the box is sealed, then creates manifest + new box", () => {
  const { store, dir } = makeStore();
  try {
    store.setBoxTarget(2);
    const a = store.createWarboard("Deck A");
    const b = store.createWarboard("Deck B");
    for (const warboard of [a, b]) {
      store.saveNotes(warboard.id, "short");
      const { deck } = store.convertWarboard(warboard.id);
      fillDeck(store, deck.id);
      store.confirmDeck(deck.id);
    }
    const box = store.getBox();
    assert.equal(box.count, 2);
    assert.equal(box.reached, true);
    assert.equal(box.canShip, true);

    const shipped = store.shipBox();
    assert.match(shipped.name, /^BOX-\d{4}-\d{2}-\d{2}-001$/);
    assert.equal(shipped.sealedEarly, false);
    assert.equal(shipped.decks.length, 2);

    const manifest = fs.readFileSync(shipped.manifestPath, "utf8");
    assert.match(manifest, /# BOX-MANIFEST/);
    assert.match(manifest, /Deck A/);
    assert.match(manifest, /SHA-256/);
    assert.equal(fs.existsSync(path.join(shipped.dir, "decks", shipped.decks[0].id, "00-README.md")), true);
    assert.equal(fs.existsSync(path.join(shipped.dir, "box.json")), true);

    const next = store.getBox();
    assert.equal(next.count, 0);
    assert.equal(next.target, 2);
    assert.notEqual(next.id, box.id);

    assert.equal(store.listShipped().length, 1);
  } finally {
    cleanup(dir);
  }
});

test("manual seal lets a short box ship and the manifest records it", () => {
  const { store, dir } = makeStore();
  try {
    store.setBoxTarget(4);
    const warboard = store.createWarboard("Only one");
    store.saveNotes(warboard.id, "short");
    const { deck } = store.convertWarboard(warboard.id);
    fillDeck(store, deck.id);
    store.confirmDeck(deck.id);

    assert.throws(() => store.shipBox(), /Reach the target/);
    store.sealBox();
    assert.equal(store.getBox().canShip, true);
    const shipped = store.shipBox();
    assert.equal(shipped.sealedEarly, true);
    assert.match(fs.readFileSync(shipped.manifestPath, "utf8"), /Sealed early: YES/);
  } finally {
    cleanup(dir);
  }
});

test("a draft deck smuggled into the box blocks shipping", () => {
  const { store, dir } = makeStore();
  try {
    const lockedWarboard = store.createWarboard("Locked");
    store.saveNotes(lockedWarboard.id, "short");
    const { deck: lockedDeck } = store.convertWarboard(lockedWarboard.id);
    fillDeck(store, lockedDeck.id);
    store.confirmDeck(lockedDeck.id);

    const draftWarboard = store.createWarboard("Draft");
    store.saveNotes(draftWarboard.id, "short");
    const { deck: draftDeck } = store.convertWarboard(draftWarboard.id);
    fillDeck(store, draftDeck.id);

    const box = store.getBoxRaw();
    box.deck_ids.push(draftDeck.id);
    fs.writeFileSync(path.join(store.root, "boxes", "current", "box.json"), JSON.stringify(box));

    store.setBoxTarget(1);
    assert.throws(() => store.shipBox(), /not locked/);
  } finally {
    cleanup(dir);
  }
});

test("shipping is a copy: later edits to the source deck do not rewrite history", () => {
  const { store, dir } = makeStore();
  try {
    const warboard = store.createWarboard("History");
    store.saveNotes(warboard.id, "short");
    const { deck } = store.convertWarboard(warboard.id);
    fillDeck(store, deck.id);
    store.confirmDeck(deck.id);
    store.setBoxTarget(1);
    const shipped = store.shipBox();

    store.unlockDeck(deck.id);
    store.writeDeckFile(deck.id, "00-README.md", "# changed after ship\n\nThis is a different body entirely.\n");

    const shippedFile = path.join(shipped.dir, "decks", deck.id, "00-README.md");
    assert.match(fs.readFileSync(shippedFile, "utf8"), /Test deck/);
  } finally {
    cleanup(dir);
  }
});

test("attachments never overwrite each other", () => {
  const { store, dir } = makeStore();
  try {
    const warboard = store.createWarboard("Duplicates");
    const file = path.join(dir, "same.txt");
    fs.writeFileSync(file, "one", "utf8");
    const first = store.addAttachments(warboard.id, [file]);
    const second = store.addAttachments(warboard.id, [file]);
    assert.deepEqual(first.added, ["same.txt"]);
    assert.deepEqual(second.added, ["same-2.txt"]);
  } finally {
    cleanup(dir);
  }
});

test("path traversal and bad ids are refused", () => {
  const { store, dir } = makeStore();
  try {
    assert.throws(() => store.getDeck("../escape"), /not found|invalid id/);
    assert.throws(() => store.getWarboard("..\\escape"), /not found|invalid id/);
    const warboard = store.createWarboard("Safe");
    const { deck } = store.convertWarboard(warboard.id);
    assert.throws(() => store.writeDeckFile(deck.id, "../evil.md", "x"), /not an editable deck file/);
    assert.throws(() => store.readDeckFile(deck.id, "deck.json"), /not an editable deck file/);
    assert.equal(isInside(store.root, path.join(store.root, "decks")), true);
    assert.equal(isInside(store.root, path.join(store.root, "..", "escape")), false);
  } finally {
    cleanup(dir);
  }
});

test("titles are sanitised into safe ids", () => {
  const { store, dir } = makeStore();
  try {
    const warboard = store.createWarboard("  Housing: deposits & ID cards / 2026  ");
    assert.equal(warboard.title, "Housing: deposits & ID cards / 2026");
    assert.match(warboard.id, /^w-\d{8}-\d{6}-housing-deposits-id-cards-2026$/);
    assert.equal(slugify("!!!", "fallback"), "fallback");
  } finally {
    cleanup(dir);
  }
});

test("validateDeckFiles reports every missing piece", () => {
  const result = validateDeckFiles({});
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 4);
});

test("activity log is plain JSONL and grows", () => {
  const { store, dir } = makeStore();
  try {
    store.createWarboard("Logged");
    const logPath = path.join(store.root, "logs", "activity.log");
    const text = fs.readFileSync(logPath, "utf8");
    const lines = text.trim().split("\n");
    const last = JSON.parse(lines[lines.length - 1]);
    assert.equal(last.event, "warboard.created");
  } finally {
    cleanup(dir);
  }
});

test.after(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});
