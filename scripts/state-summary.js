"use strict";

/** Smaller, dependency-free state summary used by DOCTOR.ps1 and the guide. */
const path = require("node:path");
const { WarboardStore } = require("../src/core/store");

const store = new WarboardStore({ appRoot: path.resolve(__dirname, "..") });
store.init();
const state = store.getState();
const locked = state.decks.filter((deck) => deck.locked).length;
console.log(
  `warboards=${state.warboards.length} decks=${state.decks.length} locked=${locked} ` +
    `box=${state.box.count}/${state.box.target} shipped=${state.shipped.length}`
);
console.log(`root=${state.root}`);
for (const deck of state.decks) {
  console.log(`  ${deck.status.padEnd(6)} ${deck.title}`);
}
