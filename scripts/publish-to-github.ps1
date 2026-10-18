# Publish the prepared commit to GitHub.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\publish-to-github.ps1
#
# The history is already prepared as a fast-forward on top of the repo's initial
# commit. This script re-checks security, shows exactly what will go out, asks
# once, then runs `git push -u origin main`. It never force-pushes.

$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
$Url = "https://github.com/kirkbradford0/sparkprose_warboard_killchain_deck_workflow_bot.git"

Set-Location $Repo

Write-Host ""
Write-Host "============================================================"
Write-Host " WARBOARD BOX -> GITHUB (fast-forward, no force)"
Write-Host "============================================================"
Write-Host " repo   : $Url"
Write-Host " folder : $Repo"
Write-Host ""

# 1. Security gate first. Never publish a tree that fails its own gate.
Write-Host "[1/4] recursive security gate"
node "security\run.js" --gate --quiet
if ($LASTEXITCODE -ne 0) {
  Write-Host "GATE FAILED. Fix or review then re-baseline; nothing was pushed." -ForegroundColor Red
  exit 1
}
Write-Host "      pass"

# 2. Show the local state.
Write-Host "[2/4] local state"
git status --short --branch
Write-Host ""
Write-Host "commits ahead of origin/main:"
git log --oneline "origin/main..HEAD" 2>$null
Write-Host ""

# 3. Confirm.
Write-Host "[3/4] confirm"
$answer = Read-Host "Push this commit to origin/main? (y/N)"
if ($answer -notin @("y", "Y", "yes", "YES")) {
  Write-Host "cancelled; nothing was pushed."
  exit 0
}

# 4. Push. Git Credential Manager will ask on this machine.
Write-Host "[4/4] push"
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Push did not complete. If the remote moved, run:" -ForegroundColor Yellow
  Write-Host "  git -C `"$Repo`" pull --rebase origin main"
  Write-Host "  git -C `"$Repo`" push -u origin main"
  exit 1
}

Write-Host ""
Write-Host "Pushed. Verify with: git -C `"$Repo`" status"
Write-Host "Make the repo private when you are ready: Settings -> General -> Danger Zone."
