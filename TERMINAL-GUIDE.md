# TERMINAL GUIDE — SparkProse / Warboard Box

One page. Copy-paste. No guessing. Windows PowerShell (the normal blue/black
window), not the DSH sandbox.

---

## 0. Open in the right place

```powershell
cd C:\c\Users\kirkb\Sparkypost\DeepSeekLENOVO\warboard-box
```

Check where you are and what is broken:

```powershell
.\DOCTOR.ps1
```

Fix the runtime and launch:

```powershell
.\DOCTOR.ps1 -Fix -Launch
```

If PowerShell blocks local scripts:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\DOCTOR.ps1 -Fix -Launch
```

---

## 1. Git — get caught up, then push

```powershell
# where am I?
git status
git log --oneline -5

# bring down anything new (read-only)
git fetch origin

# if you are behind and the tree is clean
git pull --rebase origin main

# push the local commits (this is the one that needs your login)
git push -u origin main
```

**What "caught up" looks like:** `git status` says `Your branch is up to date with
'origin/main'`. The remote record can be checked without git:

```powershell
node -e "const https=require('https');https.get('https://api.github.com/repos/kirkbradford0/sparkprose_warboard_killchain_deck_workflow_bot/commits?per_page=5',{headers:{'User-Agent':'check'}},r=>{let b='';r.on('data',d=>b+=d);r.on('end',()=>console.log(JSON.parse(b).map(c=>c.sha.slice(0,7)+' '+c.commit.message.split('\n')[0]).join('\n')))})"
```

### If `git push` asks for credentials and fails

Git for Windows uses **Git Credential Manager** (GCM). The first push should pop a
browser/login window. If it does not:

```powershell
git config --global credential.helper manager
git push -u origin main
```

If you use a Personal Access Token instead of the browser flow, GitHub accepts it
as the password when the username is your GitHub username. Do not paste tokens
into chats or files in this repo.

Other useful git:

```powershell
git diff                 # what changed
git log --oneline --graph -10
git remote -v
git branch -a
git stash push -m "wip"  # park uncommitted work
git stash pop
```

---

## 2. NPM cheat sheet (this project)

| Command | What it does |
|---|---|
| `npm install` | installs Electron once (needs internet) |
| `npm start` | runs the security gate, then launches Warboard Box |
| `npm test` | security gate, then security tests (20), core (16), wiring (10) |
| `npm run security` | the recursive security gate only |
| `npm run security:baseline` | accept the reviewed tree (after intentional changes) |
| `npm run security:json` | gate report as JSON |
| `npm run seed` | load the seven original warboards (idempotent) |
| `npm run seed:ethical` | (script exists) load the 8 ethical launch draft decks |
| `npm run demo` | generate `examples/` with a real shipped box |
| `npm run publish:github` | checked push script (asks first) |
| `npm run selftest` | headless Electron smoke (may fail inside a restricted shell) |

Generic npm you might want:

```powershell
npm ls --depth=0        # what is installed
npm outdated            # updates available
npm cache clean --force # only if installs misbehave
node --version          # must be 22+ (this box has 25.x ready)
npm --version
```

Notes:
- `prestart` and `pretest` run the security gate automatically. If the gate
  fails, nothing launches; read `security\report.json`.
- The gate is a **static preflight**, not antivirus. Fix findings rather than
  bypassing them.
- Emergency bypass requires a reason and is logged:
  ```powershell
  set SKIP_SECURITY=1
  set SKIP_SECURITY_REASON=install is broken, rebuilding runtime
  START-WARBOARD-BOX.cmd
  ```

---

## 3. SparkProse — two different apps, do not mix them up

### A. Warboard Box (Electron, NEON-90) — the warboard -> deck -> box app

This is the one with the seven warboards and nine draft decks.

- Double-click **`START-WARBOARD-BOX.cmd`**
- or `.\DOCTOR.ps1 -Launch`
- or `npm start`

If the window does not appear:
1. `.\DOCTOR.ps1` — read the [FAIL] lines.
2. Check for an existing process: `Get-Process electron -ErrorAction SilentlyContinue`
3. Run from a terminal to see errors: `node_modules\electron\dist\electron.exe .`
4. If the security gate failed, the app will not launch by design.

### B. SparkProse Deck (Python, decision deck) — the local war-board/deck console

- Double-click `C:\c\Users\kirkb\Sparkypost\DeepSeekLENOVO\SparkProseDeck\START-DECK.cmd`
  (or run `python backend\deck_server.py --port 8780 --open` in that folder).
- It is a separate, working app: 16 tests, no repo dependency.
- If Python is missing: `python --version`; install Python 3.12+.

---

## 4. What the state should look like when it is working

```powershell
.\DOCTOR.ps1
```

Expected lines:

```
[OK] node v25...
[OK] electron.exe present
[OK] security gate passed
warboards=16 decks=9 locked=0 box=0/8 shipped=0
[OK] branch main at 9cfd052
```

`locked=0 box=0/8` is **correct** until you review and lock decks. It is not a bug.

To fill and ship the box (in the app):
1. DECKS tab -> open DECK-00 -> read all four files -> tick the review box ->
   **CONFIRM & LOCK DECK**.
2. Repeat for each deck. The BOX tab shows X/8.
3. At 8/8 (or after **SEAL EARLY**) press **SHIP BOX**.
4. Copy the `BOX-MANIFEST.md` path/content back to DS1.

---

## 5. Where everything lives

| Thing | Path |
|---|---|
| App repo | `warboard-box\` |
| Your data | `warboard-box\data\` (gitignored) |
| Decks | `warboard-box\data\decks\<id>\` |
| Box | `warboard-box\data\boxes\current\box.json` |
| Shipped boxes | `warboard-box\data\boxes\shipped\BOX-...` |
| Security | `warboard-box\security\` (`BASELINE.json`, `report.json`, `bypass.log`) |
| Patriarch | `patriarch\` (`bin\patriarch.js`, `docs`, `state`) |
| Cockpit | `sparkpost-cockpit\` (`START-COCKPIT.cmd`, TRUTH at `/truth`) |
| Mission pair | `A19_DSH_SNOWSTRIKE_MD` / `_TXT` |

---

## 6. Tailscale quick card (when you need it)

```powershell
& "C:\Program Files\Tailscale\tailscale.exe" status
& "C:\Program Files\Tailscale\tailscale.exe" up
& "C:\Program Files\Tailscale\tailscale.exe" serve --bg http://127.0.0.1:8795
& "C:\Program Files\Tailscale\tailscale.exe" serve status
& "C:\Program Files\Tailscale\tailscale.exe" serve reset
```

The remote view is read-only and must be enabled in Warboard Box Settings first.
Never use `funnel`.

---

## 7. Ten commands to remember

```powershell
cd C:\c\Users\kirkb\Sparkypost\DeepSeekLENOVO\warboard-box
.\DOCTOR.ps1
.\DOCTOR.ps1 -Fix -Launch
git status
git pull --rebase origin main
git push -u origin main
npm test
npm run security
node patriarch\bin\patriarch.js demo
Start-Process .\START-WARBOARD-BOX.cmd
```
