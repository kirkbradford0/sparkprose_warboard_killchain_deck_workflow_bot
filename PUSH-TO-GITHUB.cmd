@echo off
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo   PUSH WARBOARD BOX TO GITHUB
echo ============================================================
echo   folder : %CD%
echo   repo   : https://github.com/kirkbradford0/sparkprose_warboard_killchain_deck_workflow_bot
echo   branch : main
echo.
echo   This pushes the APP CODE on this PC to GitHub.
echo   It does NOT touch D:\Kinloa Slate II, the predeck,
echo   the decks, or the boxes. No deploy workflow exists.
echo.
echo ------------------------------------------------------------
echo  CURRENT STATE
echo ------------------------------------------------------------
git status -sb
echo.
echo Commits waiting to go up:
git rev-list --count origin/main..HEAD 2>nul
if errorlevel 1 echo   (could not read origin/main - is this the warboard-box folder?)
echo.
echo ------------------------------------------------------------
echo  WHAT WILL HAPPEN
echo ------------------------------------------------------------
echo   git push -u origin main
echo.
echo   If a login window appears, sign in ONCE as kirkbradford0.
echo   That is Git Credential Manager. It remembers you after.
echo   The full output is saved to PUSH-LOG.txt either way.
echo.
set /p go=Type PUSH and press Enter to send it (anything else cancels): 
if /i not "%go%"=="PUSH" (
  echo.
  echo Cancelled. Nothing was pushed.
  pause
  exit /b 1
)

echo.
echo Pushing... (wait - do not close this window)
git push -u origin main > "%~dp0PUSH-LOG.txt" 2>&1
set GITEXIT=%errorlevel%
type "%~dp0PUSH-LOG.txt"
echo.
echo ------------------------------------------------------------
echo  RESULT
echo ------------------------------------------------------------
if not "%GITEXIT%"=="0" (
  echo   PUSH FAILED. Full text saved to:
  echo   %~dp0PUSH-LOG.txt
  echo.
  echo   Paste that file to DS1, or try:
  echo     git config --global credential.helper manager
  echo     cmdkey /delete:git:https://github.com
  echo     then run this file again.
  pause
  exit /b 1
)

echo   PUSH OK.
echo   Log saved to: %~dp0PUSH-LOG.txt
echo.
echo   Opening the GitHub commits page - refresh it if it is already open.
start "" "https://github.com/kirkbradford0/sparkprose_warboard_killchain_deck_workflow_bot/commits/main"
echo.
echo   Expected newest commit at the top: 4569f43 or newer.
echo   If it still shows "Initial commit f5db174", the push
echo   did not land - paste PUSH-LOG.txt to DS1.
echo.
pause
exit /b 0
