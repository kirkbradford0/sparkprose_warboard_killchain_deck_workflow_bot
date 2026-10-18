"use strict";

/**
 * Seed Warboard Box with the real warboards from this build.
 *
 *   node scripts/seed-warboards.js
 *
 * Idempotent: a warboard whose title already exists is skipped, so running it
 * twice does not duplicate anything. Writes only under the app data root.
 */

const fs = require("node:fs");
const path = require("node:path");

const { WarboardStore } = require("../src/core/store");

const APP_ROOT = path.resolve(__dirname, "..");
const SEED_TMP = path.join(APP_ROOT, ".tmp-seed");

const WARBOARDS = [
  {
    title: "DECK-01 — SparkProse Deck OS",
    notes: `# deck os

The deck is the unit of shipping. A warboard is the messy room; a deck is the clean artifact; a box is the batch that leaves the building.

Rules that must hold in the app, not in the README:
- four core files: 00-README, 01-source-notes, 02-structured, 03-actions
- nothing locks until a human says they reviewed all four
- locked means locked; unlocking pulls it out of the box
- no half-done deck ever ships
- shipping is a copy + BOX-MANIFEST with SHA-256, never a move

Open questions:
TODO: decide default box target (4?) and whether ship keeps or asks
TODO: decide whether shipped decks should also get a zip beside the folder
- [ ] write the deck standard as a one-page doc for the app's Settings tab
- [ ] pick the first three warboards to convert into decks this week

Success test: open SparkProse, see the box fill, ship one real box, hand the folder to a person who was never in the conversation and have them understand it.`,
  },
  {
    title: "SEC-01 — Recursive Security Program (AI Virus Defense)",
    notes: `# recursive security

Threat, stated plainly: the next incident is not a person breaking in. It is generated code or generated text that gets trusted because it looks normal. AI virus = prompt injection + supply chain + self-modifying automation + exfiltration, arriving inside things that pass review because nobody reads them.

Design: security that checks itself, recursively.
1. rules file defines what is forbidden
2. scanner hashes itself and the rules before it runs
3. a baseline pins every file hash + the scanner/rules hash + a chain root
4. a run verifies its own integrity, then scans, then re-hashes. If the tree changed mid-scan, that is a HIGH finding (TOCTOU)
5. mutation tests deliberately inject each violation and prove the scanner catches it. A scanner that cannot fail its own test is decoration

Rules to encode:
- secrets in source (private keys, cloud keys, provider tokens)
- eval / new Function / vm.runIn
- outbound network in app code (the app is offline-first)
- child_process in renderer/preload
- innerHTML without escaping
- remote scripts/styles in renderer
- missing CSP, nodeIntegration on, contextIsolation off
- package postinstall scripts and unexpected dependencies
- shell.openPath outside the data root
- remote view server accepting writes

Gates:
- [ ] run security before every launch and before tests
- [ ] fail closed on HIGH, print exact file + rule + fix
- [ ] keep a deliberate --baseline command for legitimate changes
- [ ] add a documented SKIP_SECURITY escape hatch for emergencies only

TODO: add a signed report later (hash the report, chain it)
TODO: expand rules to the canon repo after it lands here`,
  },
  {
    title: "MEMBRANE-01 — Sparky / Nikola / Harbor",
    notes: `# role membrane

One harness, roles per call. The role is a request parameter, not an endpoint.

Sparky = front door, therapeutic and court-adjacent voice, one usable next move.
Nikola = employment, proof-for-work, systems, the pattern under the pressure.
Harbor = acute moments and court friction; crisis overrides the requested role server-side.

The boundary is projection, not prompt wording:
- forbidden context keys are removed BEFORE the prompt exists
- Nikola never receives shame, charges, substance detail, or raw transcripts
- consent must be explicitly true
- auth is server-derived; body userId is ignored
- unsafe replies are replaced by the role's deterministic fallback

Open items:
- [ ] decide whether court/PINS-adjacent work is Sparky or Harbor (code says Harbor for crisis)
- [ ] write the user-facing one-liner: "who am I talking to and why"
TODO: white-label to a facility has NO spec on disk. Do not build it on a guess.
TODO: CBT/CBI as a named artifact does not exist in the tree yet; module runway does.

Next: migrate the old routes one adapter at a time; keep the tests pinned.`,
  },
  {
    title: "PINS-01 — Pinterest Lane",
    notes: `# pins

PINS = Pinterest marketing. Not court PINS. Kirk corrected this on 10-17.

Doctrine on disk: robot prepares in bulk, a human approves every pin, no auto-post. Pinterest is a small experiment, not the primary acquisition dependency.

Assets that exist:
- 3 pin drafts in LAUNCH_CONTENT.md (titles + descriptions)
- a template-only PIN_LEDGER
- a doctrine doc

What is missing (all Kirk gates):
- [ ] account truth: business account, handle, owner
- [ ] felonsmelon.com domain claim
- [ ] Pinterest Tag
- [ ] dedicated landing page (doctrine says not /letter)
- [ ] 1000x1500 graphics
- [ ] first real ledger row

Rule: Kirk presses publish, every time. The app can queue, never post.`,
  },
  {
    title: "RAP-01 — Live Openings Ship",
    notes: `# rap live openings

RAP = Resume Auto-Pilot. Built and proven: 5 robots-cleared feeds (Remote OK, Himalayas, RemoteJobs.org, Working Nomads, We Work Remotely), 273 pulled, 30 ranked, 1.3s.

Remotive is refused: its robots.txt says Disallow: /api/*. The UI reports it OFF with the reason. That refusal is the proof the guard works.

Audience filter: entry-level/warehouse/support wording boosted, seniority penalized, doctorate/MBA/licence/clearance/executive titles excluded, counts returned.

Staged in rap-wiring, canon untouched:
- [ ] apply on branch fm-rap-live-jobs after Kirk's word
- [ ] run npm run build + npm test before opening a PR
- [ ] do not merge: a merge to main deploys
- [ ] decide /job-board vs /jobs naming (canon calls it a live signal layer)

TODO: confirm job-feed scraping is outside the area-A credential stop condition
TODO: tune the audience block list after the first live week`,
  },
  {
    title: "COCKPIT-01 — Truth Pane",
    notes: `# cockpit truth

The cockpit already existed (sparkpost-cockpit, 10-05). Revived it instead of installing a fourth stack.

TRUTH pane is read-only by construction: no writes, no subprocess, no socket, no secret file opened. Reads pair files, .git/HEAD, watcher snapshot, RAP cache, ledgers, deck SQLite (ro), Hermes job_tracker (ro).

Shows: pair REV sync, canon branch/dirty/unpushed, RAP feed health, gates (credentials UNKNOWN, Stripe/Supabase RED, email sends RED 0, pins AMBER, merge AMBER), live routes, pins queue, decision deck, jobs, watcher age.

Research corrections:
- "Hermes Marketing Dashboard" is a skill listing, not an installable app
- Tailscale installed but tailscaled NOT running
- Datasette/Grafana not installed; Grafana is a fourth stack, deferred

- [ ] start tailscaled and prove the remote view over tailscale serve
- [ ] add the canonical security report card to TRUTH after SEC-01 lands`,
  },
  {
    title: "GTM-01 — 100 Users by Christmas",
    notes: `# 100 users

The goal is 100 real users by Christmas, with felonsmelon.com monetizing and Kirk earning remote income during the build.

Wave 1: /interview and /letter are live and honest. Do not market the job board until it says live openings.

Email: zero real sends ever. Phase 1 is manual Gmail from staged drafts, Kirk presses send. Never import a bought or scraped list. Project-ender #4 stays.

The roster question is unresolved and it is the legal switch: the denylist implies some jail rosters are usable; project-ender #4 says no third-party address enters the CRM for marketing. One must change, by Kirk.

- [ ] pick wave-1 channel and write the first post in Kirk's voice
- [ ] stage batch 0 drafts for Kirk to send by hand
- [ ] count real users in a way we can defend (not signups, users)
TODO: decide whether the free-launch branch merges before or after wave 1`,
  },
];

function seedAttachments(store, warboard) {
  fs.mkdirSync(SEED_TMP, { recursive: true });
  if (warboard.title.startsWith("SEC-01")) {
    const dump = path.join(SEED_TMP, "security-source-dump.txt");
    fs.writeFileSync(
      dump,
      [
        "raw security thinking, pasted from the warboard",
        "",
        "- the scanner must fail its own mutation test or it is theater",
        "- hash the scanner and rules before and after the scan",
        "- a scan that changes the tree it is scanning is a finding",
        "- baseline drift is a finding, not a convenience",
        "",
      ].join("\n"),
      "utf8"
    );
    store.addAttachments(warboard.id, [dump]);
  }
  if (warboard.title.startsWith("DECK-01")) {
    const spec = path.join(SEED_TMP, "deck-file-contract.txt");
    fs.writeFileSync(
      spec,
      "00-README: summary + purpose\n01-source-notes: verbatim\n02-structured: cleaned\n03-actions: checklist\n",
      "utf8"
    );
    store.addAttachments(warboard.id, [spec]);
  }
}

function main() {
  const store = new WarboardStore({ appRoot: APP_ROOT });
  store.init();

  const existing = new Set(store.listWarboards().map((item) => item.title));
  let created = 0;
  let skipped = 0;

  for (const entry of WARBOARDS) {
    if (existing.has(entry.title)) {
      skipped += 1;
      continue;
    }
    const warboard = store.createWarboard(entry.title);
    store.saveNotes(warboard.id, entry.notes);
    seedAttachments(store, warboard);
    created += 1;
    console.log(`created  ${warboard.id}  ${entry.title}`);
  }

  fs.rmSync(SEED_TMP, { recursive: true, force: true });

  const state = store.getState();
  console.log("");
  console.log(`seeded ${created}, skipped ${skipped} (already present)`);
  console.log(`data root: ${state.root}`);
  console.log(`warboards: ${state.warboards.length} · decks: ${state.decks.length} · box: ${state.box.count}/${state.box.target}`);
  for (const warboard of state.warboards) {
    console.log(`  [${warboard.status}] ${warboard.title}  (${warboard.notesChars} chars, ${warboard.attachmentCount} files)`);
  }
}

main();
