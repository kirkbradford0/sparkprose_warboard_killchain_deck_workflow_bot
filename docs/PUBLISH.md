# Publishing to GitHub

**Repo:** https://github.com/kirkbradford0/sparkprose_warboard_killchain_deck_workflow_bot
**State on 2026-10-18 06:35 MT:** exists, **public**, default branch `main`.
The remote is **not empty**: it has one initial commit `f5db174` containing a
224-byte README placeholder (the repo description) and a small `.gitattributes`.

A local commit is already prepared **on top of that initial commit** (fast-forward,
no force push). The push itself is the one step the build agent cannot do:
git-over-HTTPS upload needs your Windows credential prompt (Git Credential
Manager), and the sandbox has no interactive terminal and no GitHub token.
Anonymous *read* from the sandbox works only with `-c http.sslBackend=openssl`;
the default schannel path fails with `SEC_E_NO_CREDENTIALS` — that is the
confinement, not the repo.

---

## 1. Decide visibility first

The repo is public right now. This commit contains internal strategy notes
(warboards), local paths in `examples/`, and the security design. If you want it
private, **make it private before the first push**:

- GitHub → repo → **Settings** → **General** → bottom **Danger Zone** →
  **Change repository visibility** → **Private**.
- Or, with GitHub CLI authenticated:
  `gh repo edit kirkbradford0/sparkprose_warboard_killchain_deck_workflow_bot --visibility private --accept-visibility-change-consequences`

If you meant "private when the work is done," flip it at the end instead — the
repo will simply be public in between.

## 2. Push (one command, from a normal PowerShell window)

```powershell
git -C "C:\c\Users\kirkb\Sparkypost\DeepSeekLENOVO\warboard-box" push -u origin main
```

Or run the checked script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\c\Users\kirkb\Sparkypost\DeepSeekLENOVO\warboard-box\scripts\publish-to-github.ps1"
```

A Git Credential Manager window will ask for your GitHub account (browser or
token). Approve it once; GCM caches it. **This is a normal fast-forward push; no
force is needed and none is used.**

The remote README placeholder is superseded by this project's README (the
placeholder text remains in the remote's initial commit history, so nothing is
lost).

If the push is rejected because the remote moved in the meantime:

```powershell
git -C "C:\c\Users\kirkb\Sparkypost\DeepSeekLENOVO\warboard-box" pull --rebase origin main
git -C "C:\c\Users\kirkb\Sparkypost\DeepSeekLENOVO\warboard-box" push -u origin main
```

## 3. Verify

```powershell
git -C "C:\c\Users\kirkb\Sparkypost\DeepSeekLENOVO\warboard-box" status
git -C "C:\c\Users\kirkb\Sparkypost\DeepSeekLENOVO\warboard-box" log --oneline -3
git -C "C:\c\Users\kirkb\Sparkypost\DeepSeekLENOVO\warboard-box" remote -v
```

On GitHub: the `verify` workflow should start on push. It runs the recursive
security gate, the 20 security mutation tests, 16 core tests, and 10 UI wiring
tests on Windows with Node 22.

## 4. What is committed and what is not

Committed: source, tests, security tooling + `BASELINE.json`, docs, scripts,
examples, README, launcher.

Excluded by `.gitignore`: `node_modules/`, `data/` (your real warboards and
decks), `security/report.json`, local settings, temp folders, logs.

**Byte pinning:** `.gitattributes` sets `* -text`. Do not let an editor rewrite
line endings on this repo: the gate hash-chains exact bytes, and EOL conversion
would look like tampering.

## 5. After the push

- `npm install` on another machine re-downloads Electron (dev dependency). CI
  sets `ELECTRON_SKIP_BINARY_DOWNLOAD=1` because tests do not need the window.
- Re-baseline only after a reviewed change:
  `node security/run.js --baseline`
- The emergency launch hatch stays local: `set SKIP_SECURITY=1`.

## Why the agent could not push

Standing fleet rule: `git push` is Kirk's gate. The sandbox can commit locally,
but it has no TTY for Git Credential Manager and no token may be read into the
session. Everything up to `git push` is done; that one command is yours.
