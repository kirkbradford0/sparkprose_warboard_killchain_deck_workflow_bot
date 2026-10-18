# Warboard Box — NEON-90

**Messy thinking in. Locked decks out.**

A desktop app that turns AI brainstorming "warboards" into clean, complete,
shippable decks — then ships those decks in sealed, dated boxes. Plain files on
disk. No database. No cloud. No account.

**Look:** 90s cyberpunk OS chrome — perspective grid horizon, neon cyan/magenta,
CRT scanlines, beveled window controls, terminal boot — wrapped around a modern,
readable layout. Internal build name: **NEON-90**.
**Security:** a recursive, self-checking gate runs before launch and before tests.
**Seeded:** seven real warboards from this build are already loaded for deck creation.

---

## 1. What it does

```
NEW WARBOARD  ->  notes + dropped files  ->  CONVERT TO DECK
      ->  review four files  ->  CONFIRM & LOCK  ->  box fills
      ->  SHIP BOX  ->  dated folder + BOX-MANIFEST.md  ->  new empty box
```

- A **warboard** is the messy room: notes, chat logs, ideas, dropped files.
- A **deck** is the clean artifact: four markdown files + attachments.
- A **box** holds completed decks. Its target is set per box; ship when it
  reaches the target or when you deliberately seal it early.
- A shipped box is a **dated copy** with a manifest and SHA-256 per file. Editing
  the source decks later does not rewrite history.

## 2. Architecture

**Chosen: Electron.** Evidence, from this machine:

| Option | Verdict |
|---|---|
| **Tauri** | Rejected — no Rust toolchain (`rustc`/`cargo` absent). |
| **Python + customtkinter** | Rejected — Tk 8.6 exists, but native OS drag-and-drop needs an extra package and every pip/venv path was blocked; the brief's core interaction is drop-a-folder. |
| **Python + pywebview** | Rejected — not installed, install path failed, another dependency layer. |
| **Electron** | **Chosen** — Node 25 + npm present, Electron 44.9 runtime downloaded and running on this box; real native window, OS drag-and-drop, file dialogs, no build step. |

Process model: `main.js` (window, IPC, read-only remote view, dialogs) →
`preload.js` allowlist → plain HTML/CSS/JS renderer. All deck/box logic lives in
`src/core/` with **no Electron imports**, so the entire flow runs under plain
Node in tests.

Security boundaries: `contextIsolation:true`, `nodeIntegration:false`, a preload
allowlist, every write path proven inside the data root, the remote view binds
loopback only and is GET-only, and no outbound network calls exist in app code.

## 3. Install & run

Requirements: Windows, Node.js 22+ (this box has 25.8).

```powershell
cd C:\c\Users\kirkb\Sparkypost\DeepSeekLENOVO\warboard-box
npm install          # only if node_modules is missing
npm start            # runs the security gate first, then Electron
```

**One-click:** double-click **`START-WARBOARD-BOX.cmd`** — it runs the security
gate, clears inherited `ELECTRON_RUN_AS_NODE`, installs the runtime once if
missing, then launches.

**Publishing:** the repo is `kirkbradford0/sparkprose_warboard_killchain_deck_workflow_bot`.
A local commit is prepared as a fast-forward; see [`docs/PUBLISH.md`](docs/PUBLISH.md)
or run `scripts\publish-to-github.ps1`. The push needs your GitHub credential prompt.

Tests:

```powershell
npm test    # security mutation tests + 16 core + 8 UI wiring (gate runs first)
```

## 4. First run

- Data lives in **`warboard-box\data\`** by default:
  `warboards/`, `decks/`, `boxes/current/`, `boxes/shipped/`, `logs/activity.log`.
- Settings: `config\settings.json` (created on first run).
- Change the data folder in **Settings → DATA FOLDER** — point it at a synced or
  Tailscale-reachable folder if you want the files elsewhere.
- **Seven warboards are pre-loaded** from this build: DECK-01, SEC-01,
  MEMBRANE-01, PINS-01, RAP-01, COCKPIT-01, GTM-01. Open the app and they are in
  the left rail, ready to convert.
- Re-seed (idempotent): `npm run seed`.

Config template (`config\settings.example.json`):

```json
{
  "dataRoot": "",
  "boxTarget": 4,
  "keepTargetOnShip": true,
  "remoteView": false,
  "remotePort": 8795
}
```

## 5. The rules the app enforces (not just the UI)

1. **A deck is never half-done.** All four files exist, are non-empty, the README
   has a heading + purpose, and `03-actions.md` has at least one action line.
2. **Locked decks cannot be edited.** Writes are refused in the store layer.
3. **Unlocking removes the deck from the current box** and re-opens it.
4. **No incomplete or unlocked deck can ship.** Ship re-validates every deck.
5. **A box ships at target or on a deliberate early seal.** The manifest records which.
6. **Shipping is a copy.** Dated snapshot + SHA-256 per file; source edits never
   rewrite history.
7. **A new empty box starts automatically** after a ship, with the same target.

## 6. Deck file contract

| File | Purpose | Rule |
|---|---|---|
| `00-README.md` | summary + purpose + source + attachments | heading + purpose required |
| `01-source-notes.md` | the warboard material, verbatim | evidence; don't edit |
| `02-structured.md` | deterministic cleaned markdown | editable draft |
| `03-actions.md` | concrete next steps as a checklist | at least one action line |
| `attachments/` | dropped files and folders, never overwritten | optional |

Conversion is **deterministic and offline** — not an LLM. Same warboard always
converts to the same deck; the human review adds judgment.

## 7. Recursive security program (SEC-01)

Built in, gating, and documented in [`docs/SECURITY.md`](docs/SECURITY.md).

```powershell
node security/run.js --gate        # what launch/test run
node security/run.js --baseline    # accept the reviewed tree
node security/self-test.js         # 20 mutation tests
```

What makes it recursive:

1. rules define what is forbidden;
2. the scanner hashes **itself and the rules** before and after each run;
3. a baseline pins every file hash plus the tooling hash as a rolling chain;
4. a mid-scan change is a HIGH finding (TOCTOU);
5. mutation tests deliberately inject each violation and prove the rule fires.

It blocks: secrets in source, dynamic code, outbound network in app code, child
processes, install hooks/unexpected deps, remote assets, weakened Electron
switches, unsafe `innerHTML`, writable remote view, path escapes, binaries, and
baseline/tooling tamper. It is a static preflight — not antivirus, not a sandbox,
not proof of innocence. [Full threat model →](docs/SECURITY.md)

## 8. Tailscale

Documented step by step in [`docs/TAILSCALE.md`](docs/TAILSCALE.md): built-in
read-only remote view + `tailscale serve` (never `funnel`), or folder sync with an
external tool bound to Tailnet IPs. `tailscaled` is not currently running on this
box, so starting the service is step one.

## 9. Folder structure

A real example lives in [`examples/`](examples/) — generated by `npm run demo`.
Annotated trees: [`docs/FOLDER-STRUCTURE.md`](docs/FOLDER-STRUCTURE.md).

```
data/
  boxes/current/box.json
  boxes/shipped/BOX-2026-10-18-001/
    BOX-MANIFEST.md · box.json · decks/<id>/{00..03, deck.json, attachments/}
  warboards/<id>/warboard.json, notes.md, attachments/
  decks/<id>/{deck.json, 00-README.md, 01-source-notes.md,
             02-structured.md, 03-actions.md, attachments/, .locked}
  logs/activity.log
security/BASELINE.json          accepted hash chain
security/report.json            last run (git-ignored)
```

## 10. Honest limits

- **The window was not visually verified by the build agent** (no pixels rule).
  The design is built to spec and machine-checked structurally; layout gets one
  human look on first launch. Electron also cannot start inside the DSH sandbox
  (confinement), so launch from a normal desktop shell.
- Folder shipping, not zip — the brief allowed either; a folder keeps the manifest
  readable. Zip it yourself if you want one.
- No OCR, no LLM cleaning. Deterministic conversion is the design.
- Windows paths only were exercised.
- Security is static and local: no AV, no runtime memory/network monitoring, no
  cloud feed. Human review is still the last gate.

## 11. File map

```
warboard-box/
  START-WARBOARD-BOX.cmd     one-click: security gate -> launch
  main.js                    Electron main: window, IPC, read-only remote view
  preload.js                 contextBridge allowlist
  package.json
  src/core/                  model (no Electron imports)
    store.js                 warboards, decks, boxes, ship, manifest
    convert.js               deterministic warboard -> deck files
    validate.js              deck completeness rules
    util.js                  paths, slugs, copy, hashing
  src/renderer/              NEON-90 UI (plain HTML/CSS/JS)
  security/
    rules.js                 forbidden patterns
    scan.js                  regex + structural checks
    attest.js                hash chain + baseline
    run.js                   gate CLI (--gate / --baseline / --json)
    self-test.js             20 mutation tests
    BASELINE.json            accepted tree
  test/core.test.js          16 model tests
  test/ui-contract.test.js   8 wiring tests (+ security wiring)
  scripts/demo.js            generated example deck + shipped box
  scripts/seed-warboards.js  seeds the seven build warboards
  docs/ARCHITECTURE.md · SECURITY.md · TAILSCALE.md · FOLDER-STRUCTURE.md
  examples/                  real generated deck + shipped box
```
