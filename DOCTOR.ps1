<#
.SYNOPSIS
  SPARKPROSE DOCTOR - check, fix, sync, and launch Warboard Box.

.DESCRIPTION
  One script instead of guessing. It checks the toolchain, the Electron runtime,
  the recursive security gate, the git state, and the deck/box data. With -Fix it
  installs the runtime if missing. With -Sync it fetches and (only when clean and
  behind) pulls. It NEVER pushes: push is Kirk's credential gate and the script
  prints the exact command.

.EXAMPLES
  powershell -NoProfile -ExecutionPolicy Bypass -File .\DOCTOR.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File .\DOCTOR.ps1 -Fix
  powershell -NoProfile -ExecutionPolicy Bypass -File .\DOCTOR.ps1 -Sync
  powershell -NoProfile -ExecutionPolicy Bypass -File .\DOCTOR.ps1 -Fix -Launch

.NOTES
  ASCII only (Windows PowerShell 5.1 reads .ps1 as ANSI).
#>

[CmdletBinding()]
param(
  [switch]$Fix,
  [switch]$Sync,
  [switch]$Launch,
  [switch]$NoLaunch
)

$ErrorActionPreference = 'Continue'
$Repo = $PSScriptRoot
$problems = 0

function Line([string]$text) { Write-Host $text }
function OK([string]$text) { Write-Host ("  [OK]   " + $text) -ForegroundColor Green }
function WARN([string]$text) { Write-Host ("  [WARN] " + $text) -ForegroundColor Yellow }
function BAD([string]$text) { Write-Host ("  [FAIL] " + $text) -ForegroundColor Red; $script:problems += 1 }
function Head([string]$text) { Write-Host ""; Write-Host ("=== " + $text + " ===") -ForegroundColor Cyan }

Line ""
Line "============================================================"
Line " SPARKPROSE DOCTOR - Warboard Box"
Line (" repo: " + $Repo)
Line "============================================================"

# ---------------------------------------------------------------- toolchain
Head "1. TOOLCHAIN"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  BAD "node is not on PATH. Install Node.js 22+ from nodejs.org, reopen the terminal."
} else {
  $nodeVersionText = (& node --version 2>&1 | Out-String).Trim()
  $nodeVersion = $nodeVersionText -replace '^v', ''
  try {
    $major = [int](($nodeVersion -split '\.')[0])
    if ($major -ge 22) { OK ("node " + $nodeVersionText) }
    else { WARN ("node " + $nodeVersionText + " - 22+ is recommended") }
  } catch {
    WARN ("node version could not be parsed: " + $nodeVersionText)
  }
}

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) { BAD "npm is not on PATH (it ships with Node.js)." } else { OK "npm present" }

if ($env:ELECTRON_RUN_AS_NODE) {
  WARN "ELECTRON_RUN_AS_NODE is set in this shell; clearing it for launch (inherited from another tool)."
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------- runtime
Head "2. ELECTRON RUNTIME"
$electronExe = Join-Path $Repo "node_modules\electron\dist\electron.exe"
if (Test-Path -LiteralPath $electronExe) {
  $mb = [math]::Round((Get-Item -LiteralPath $electronExe).Length / 1MB)
  OK ("electron.exe present (" + $mb + " MB)")
} else {
  if ($Fix) {
    Line "  runtime missing - installing (one time, needs internet)..."
    Push-Location $Repo
    try {
      & npm install --no-audit --no-fund
      if ($LASTEXITCODE -ne 0) { BAD "npm install failed (exit $LASTEXITCODE)." }
      else {
        & node "node_modules\electron\install.js"
        if ($LASTEXITCODE -ne 0) { BAD "electron runtime download failed (exit $LASTEXITCODE)." }
        elseif (Test-Path -LiteralPath $electronExe) { OK "electron runtime installed" }
        else { BAD "electron.exe still missing after install." }
      }
    } finally { Pop-Location }
  } else {
    BAD "electron runtime missing. Re-run with -Fix to install it."
  }
}

# ---------------------------------------------------------------- security
Head "3. RECURSIVE SECURITY GATE"
Push-Location $Repo
try {
  & node "security\run.js" --gate --quiet
  $gateExit = $LASTEXITCODE
  if ($gateExit -eq 0) { OK "security gate passed" }
  else {
    BAD "security gate FAILED (exit $gateExit). Details: security\report.json"
    Line "        If the change was intentional and reviewed: node security\run.js --baseline"
    Line "        Emergency only: set SKIP_SECURITY=1 and SKIP_SECURITY_REASON=... (logged)"
  }
} finally { Pop-Location }

# ---------------------------------------------------------------- app data
Head "4. DECK / BOX DATA"
Push-Location $Repo
try {
  $state = (& node "scripts\state-summary.js" 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) {
    BAD "could not read app state (node exited $LASTEXITCODE)"
  } else {
    foreach ($stateLine in ($state -split "`n")) { Line ("  " + $stateLine.TrimEnd()) }
    if ($state -match "decks=0") { WARN "no decks yet - open the app and convert a warboard" }
    if ($state -match "locked=0") { WARN "no locked decks yet - review and lock a deck to fill the box" }
  }
} catch {
  BAD ("could not read app state: " + $_.Exception.Message)
} finally { Pop-Location }

# ---------------------------------------------------------------- git
Head "5. GIT STATE"
Push-Location $Repo
try {
  $branch = (& git rev-parse --abbrev-ref HEAD 2>&1 | Out-String).Trim()
  $head = (& git rev-parse --short HEAD 2>&1 | Out-String).Trim()
  $dirty = (& git status --porcelain 2>&1 | Out-String).Trim()
  OK ("branch " + $branch + " at " + $head)
  if ($dirty) { WARN "working tree has uncommitted changes" } else { OK "working tree clean" }

  $fetchOk = $false
  if ($Sync) {
    & git fetch origin 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $fetchOk = $true; OK "fetched origin" }
    else {
      & git -c http.sslBackend=openssl fetch origin 2>&1 | Out-Null
      if ($LASTEXITCODE -eq 0) { $fetchOk = $true; OK "fetched origin (openssl backend)" }
      else { WARN "fetch failed - check your network or Git Credential Manager" }
    }
  }

  $originMain = (& git rev-parse --short origin/main 2>&1 | Out-String).Trim()
  Line ("  origin/main: " + $originMain)

  if ($fetchOk) {
    $counts = (& git rev-list --left-right --count origin/main...HEAD 2>&1 | Out-String).Trim()
    Line ("  behind/ahead of origin/main: " + $counts)
    $parts = $counts -split '\s+'
    $behind = 0; $ahead = 0
    if ($parts.Count -ge 2) { $behind = [int]$parts[0]; $ahead = [int]$parts[1] }

    if ($behind -gt 0) {
      if ($dirty) {
        WARN "you are behind but the tree is dirty - commit or stash before pulling"
      } else {
        Line "  pulling with rebase..."
        & git pull --rebase origin main 2>&1 | ForEach-Object { Line ("  " + $_) }
        if ($LASTEXITCODE -eq 0) { OK "pulled" } else { BAD "pull failed - resolve conflicts, then rerun" }
      }
    } elseif ($ahead -gt 0) {
      Line ""
      Line ("  >>> " + $ahead + " local commit(s) not on GitHub. Push is your credential gate:")
      Line ('      git -C "' + $Repo + '" push -u origin main')
      Line ""
    } else {
      OK "local and origin/main are in sync"
    }
  }
} finally { Pop-Location }

# ---------------------------------------------------------------- launch
Head "6. LAUNCH"
if ($Launch -and -not $NoLaunch) {
  if (-not (Test-Path -LiteralPath $electronExe)) {
    BAD "cannot launch: electron runtime missing"
  } elseif ($problems -gt 0) {
    BAD "refusing to launch with problems above - fix them first"
  } else {
    Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    Start-Process -FilePath $electronExe -ArgumentList @($Repo) -WorkingDirectory $Repo
    OK "Warboard Box launched"
  }
} else {
  Line "  Not launched. Run with -Launch, or double-click START-WARBOARD-BOX.cmd"
}

# ---------------------------------------------------------------- summary
Head "SUMMARY"
if ($problems -eq 0) {
  Line "  No blocking problems found." -ForegroundColor Green
  Line "  Launch:  .\DOCTOR.ps1 -Launch    or    START-WARBOARD-BOX.cmd"
  Line "  Tests :  npm test"
  Line "  Docs  :  TERMINAL-GUIDE.md"
} else {
  Line ("  " + $problems + " blocking problem(s). Fix the [FAIL] lines above.") -ForegroundColor Red
  Line "  Then rerun: .\DOCTOR.ps1"
}
Line ""
exit ([int]($problems -gt 0))
