# Architecture

## Decision

Electron, chosen against the alternatives on this machine, not in the abstract.

| Candidate | What was checked | Result |
|---|---|---|
| Tauri | `rustc --version`, `cargo --version` | not installed → a whole toolchain added for a single-user local app |
| Python + customtkinter | Tk 8.6 present; native OS drag-and-drop needs `tkinterdnd2`; `pip install --target` and `venv` both failed under the sandbox | cannot guarantee the core interaction from the brief |
| Python + pywebview | module absent; install path failed | extra dependency before the first window |
| Electron | Node 25 + npm present; Electron 44.9 runtime downloaded (247 MB binary) and `electron.exe` executed | works; native window; OS drag-and-drop; file dialogs; no build step |

The app is deliberately small: one window, one preload bridge, one model.

## Process model

```
main.js (Node)
  ├─ BrowserWindow  ->  src/renderer/index.html + app.js + styles.css
  ├─ preload.js     ->  window.warboardBox (named operations only)
  ├─ src/core/store.js  (pure Node; also runs under `node test/core.test.js`)
  └─ optional http server on 127.0.0.1:<port>  (read-only remote view)
```

- The renderer has **no Node**, no `require`, no network fetch. Every operation
  is an `ipcRenderer.invoke` handled in main.
- `src/core/*` never imports Electron. That is what makes the full flow testable
  without a GUI.
- Filesystem writes happen only in main, through the store, which calls
  `assertInside(dataRoot, …)` before writing.

## Data model — folders are the API

| Entity | Location | Metadata | Content |
|---|---|---|---|
| Warboard | `warboards/<id>/` | `warboard.json` | `notes.md`, `attachments/` |
| Deck | `decks/<id>/` | `deck.json`, `.locked` marker | `00-README.md`, `01-source-notes.md`, `02-structured.md`, `03-actions.md`, `attachments/` |
| Box (open) | `boxes/current/box.json` | `box.json` | points at deck ids |
| Box (shipped) | `boxes/shipped/BOX-<date>-<nnn>/` | `box.json` | `BOX-MANIFEST.md`, `decks/<id>/…` |
| History | `logs/activity.log` | — | append-only JSONL |

There is **no database**. Every deck is a folder a human can read, copy, zip, or
hand to another tool. Metadata JSON is a convenience index, not a source of truth
for content.

Ids are `w-…`, `d-…`, `box-…` + timestamp + slug. Nothing user-typed becomes a
path without `slugify()`; a path that resolves outside the data root is refused.

## Invariants (enforced in the store, not the UI)

1. Deck lock requires four non-empty core files, a README heading + purpose, and
   at least one action line.
2. `writeDeckFile` refuses when `deck.json.locked` is true.
3. Locking adds the deck id to `boxes/current/box.json`.
4. Unlocking clears `locked`, removes the `.locked` marker, removes the deck from
   the current box, and re-opens editing.
5. Shipping validates every box deck is locked; zero decks cannot ship; below
   target requires `sealed: true`.
6. Shipping copies deck folders (never moves), writes `BOX-MANIFEST.md` with
   SHA-256 of each core file, archives `box.json`, and creates a fresh current
   box with the same target.
7. The shipped copy is immutable history: the app never edits it again.

## IPC surface

`state:get`, `app:meta`, `config:save`, `warboard:*`, `deck:*`, `box:*`,
`shipped:list`, `dialog:*`, `shell:openPath`, `folder:*`, `remote:*`,
`activity:recent`. Every handler returns `{ok:true,data}` or
`{ok:false,error}` — no exception crosses the bridge.

Security notes:

- `nodeIntegration:false`, `contextIsolation:true`, a preload allowlist.
- `shell.openPath` refuses targets outside the data root or app folder.
- The remote view server is GET-only, binds loopback, serves four-file reads and
  the manifest; there is no write route and no command route.
- CSP in the renderer forbids remote scripts/styles; the app is offline-first.

## Convert / validate split

- `convert.js` is deterministic: normalize markdown, extract actions by pattern,
  compose the four files, copy attachments. Same input → same output.
- `validate.js` is the gate: it can pass or fail a set of files without knowing
  where they came from, so the same rules run at lock time and ship time.

No LLM is called. This is intentional: a deck must be reproducible offline from
the notes the user actually saved. Human review is the judgment layer.

## Test strategy

- `test/core.test.js` (16 tests) exercises the real store against throwaway data
  roots: full flow, incomplete-deck refusal, lock/unlock, box target, early seal,
  draft-smuggling block, shipping copy semantics, manifest checksums, attachment
  collisions, path traversal, id sanitisation, activity log.
- `test/ui-contract.test.js` (8 tests) statically checks renderer ↔ preload ↔ main
  wiring: every `byId` exists, every `api.*` method is exposed, every channel is
  handled, CSP present, loopback-only server, no POST on the remote view.
- The GUI itself is not machine-visible (no browser/pixels rule). The Electron
  runtime cannot start inside the DSH sandbox (access violation); launch from a
  normal desktop shell.

## Security program (SEC-01)

A second, independent layer sits outside the app: `security/`. It is a static,
deterministic preflight with a self-integrity check.

```
rules.js -> scan.js -> attest.js -> run.js --gate
                         ^              |
                         +-- BASELINE.json (chain + tooling hash)
```

- **Recursion:** the scanner hashes the rules + itself before and after each run;
  the tree is chain-hashed before and after. Any mid-run change is a HIGH
  finding (TOCTOU). A baseline pins the accepted chain; drift is classified
  (app code = HIGH, docs/config = MED) and must be reviewed, then re-baselined.
- **Mutation-tested:** `self-test.js` injects each violation and asserts the rule
  fires, and that clean samples pass. 20 tests.
- **Gates:** `pretest`, `prestart`, and the one-click launcher run
  `node security/run.js --gate`. `SKIP_SECURITY=1` is the documented emergency
  hatch.
- **Scope:** static only. It does not sandbox the runtime, monitor memory, or
  inspect network traffic. Electron's hardening + path containment remain the
  runtime boundary. Full threat model: `docs/SECURITY.md`.
