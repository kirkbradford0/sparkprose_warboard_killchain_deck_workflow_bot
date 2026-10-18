# Recursive Security Program (SEC-01)

**Status:** built and gating. 20 mutation tests. The gate runs before launch and
before tests.

The threat is not a stranger at the keyboard. It is **generated code and generated
text that arrives looking normal** — a dependency that runs on install, a dropped
file that contains instructions, a helper that suddenly makes network calls, a
"small fix" that loosens the sandbox. That is what "AI virus" means here in
concrete terms:

| Vector | What it looks like | What this program does |
|---|---|---|
| Prompt injection | Notes or dropped files contain "ignore previous instructions" | Content is data: it is escaped, rendered as text, never executed. The scanner forbids code sinks that would let content become code. |
| Supply chain | A new dependency with an install hook, or a postinstall script | SEC010: no runtime dependencies, no install hooks, dev deps allowlisted. |
| Self-modifying rules | The scanner's own rules get loosened so bad code passes | Tooling hash is pinned in the baseline; any change to rules/scanner is a HIGH finding until re-baselined. |
| Dynamic code | `eval`, `new Function`, `vm.runIn*` | SEC002 blocks it in app code; mutation test proves the rule fires. |
| Exfiltration | A helper adds a network call "for analytics" | SEC003: app code must not call the network at all. The only server is loopback. |
| Privilege creep | Renderer gets Node, shell opens arbitrary paths, remote view accepts writes | SEC008/SEC009/SEC011 assert the Electron and server boundaries. |
| Malicious HTML | Unescaped interpolation of dropped content | SEC005 checks every `innerHTML` sink for escaping and bans `document.write`/`insertAdjacentHTML`. |
| Binary payload | A "tool" or installer added to the repo | SEC015 flags executables and scripts outside the one reviewed launcher. |
| Tampering mid-run | Files change while the scan is running | The run hashes the tree and tooling before and after; a change is a HIGH finding (TOCTOU). |

## The recursion, precisely

1. **Rules** (`security/rules.js`) define what must never appear.
2. **Scanner** (`security/scan.js`) reads bytes and applies rules + structural checks. It never executes project code.
3. **Integrity** (`security/attest.js`) builds a deterministic rolling hash over every tracked file: `chain = H(chain, path, fileHash)` in sorted order. It also hashes the security tooling itself.
4. **Baseline** (`security/BASELINE.json`) pins the accepted chain, tooling hash, and every file hash.
5. **Run** (`security/run.js`) verifies:
   - baseline exists and tooling hash matches (rules were not loosened)
   - the tree matches the baseline (drift classified: app code = HIGH, docs/config = MED)
   - the before/after chain roots are identical (nothing changed mid-scan)
6. **Mutation tests** (`security/self-test.js`) deliberately inject every violation and prove each rule fires. A scanner that cannot fail its own test is decoration.

**Drift is a finding, not a nuisance.** If app code changed, the gate fails until
a human reviews and re-baselines. That is the point: the baseline is the accepted
state, not whatever exists.

## Commands

```powershell
node security/run.js --gate           # fail on HIGH (used by pretest/prestart/launcher)
node security/run.js --baseline       # accept the current tree AFTER review
node security/run.js --json           # machine-readable report
node security/run.js --quiet          # only speak when failing
node security/run.js --allow-drift    # development mode: drift becomes MED
node security/self-test.js            # 20 mutation tests
```

Every run writes `security/report.json` (git-ignored) with chain roots, tooling
hash, counts, and per-finding remediation.

## Gates

- `npm test` → `pretest` runs the gate, then `self-test` + core (16) + UI wiring (8).
- `npm start` → `prestart` runs the gate.
- `START-WARBOARD-BOX.cmd` → runs the gate before launching Electron.
- Emergency hatch: `set SKIP_SECURITY=1` for a broken install. Documented, not
  encouraged, and the report still records what was skipped.

## Adding a rule

1. Add a rule object to `security/rules.js` (`id`, `severity`, `name`, `message`,
   `remediation`, `globs`, `pattern`) or a structural check in `security/scan.js`.
2. Add a mutation test in `security/self-test.js`: the bad sample must fire, the
   good sample must not.
3. Run `node security/self-test.js`.
4. Run `node security/run.js --baseline` to accept the new tooling (tooling hash
   changes by definition), review the drift list first.

## What this is NOT

- **Not antivirus.** It does not inspect running processes, memory, or network
  traffic. It is a static, deterministic preflight for this repository.
- **Not a sandbox.** Runtime isolation is Electron's job (contextIsolation, no
  nodeIntegration, loopback-only server, path containment). The scanner checks
  that those settings still exist; it does not enforce them at runtime.
- **Not a signature feed.** Rules are local and reviewed. No cloud, no telemetry.
- **Not proof of innocence.** It catches known shapes. A novel obfuscation can
  pass a regex. The baseline + mutation tests raise the cost; they do not make
  the risk zero. Human review remains the last gate.
- **Windows-first.** Path and launcher rules assume this machine.

## First incident runbook

1. Gate fails: read `security/report.json`.
2. If it is baseline drift you caused: review the diff, then `--baseline`.
3. If it is a real finding: fix the file, do **not** baseline around it.
4. If it is "tooling-changed": someone modified the scanner. Diff
   `security/rules.js`/`scan.js`/`attest.js`/`run.js` before accepting anything.
5. If it is "tree changed during scan": stop all writers, close the app, re-run.
