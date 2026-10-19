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
echo   the decks, or the boxes. Nothing deploys from a push
echo   to this repo (no deploy workflow is configured).
echo.
echo ------------------------------------------------------------
echo  CURRENT STATE
echo ------------------------------------------------------------
git status -sb
echo.
echo Commits waiting to go up:
git rev-list --count origin/main..HEAD 2>nul
if errorlevel 1 echo   (could not read origin/main - run this from the warboard-box folder)
echo.
echo ------------------------------------------------------------
echo  WHAT WILL HAPPEN
echo ------------------------------------------------------------
echo   git push -u origin main
echo.
echo   If a login window appears, sign in to GitHub once.
echo   That is Git Credential Manager. It remembers you after.
echo.
set /p go=Type PUSH and press Enter to send it (anything else cancels): 
if /i not "%go%"=="PUSH" (
  echo.
  echo Cancelled. Nothing was pushed.
  pause
  exit /b 1
)

echo.
echo Pushing...
git push -u origin main
if errorlevel 1 (
  echo.
  echo ============================================================
  echo   PUSH FAILED - read the error text above.
  echo   Common fixes:
  echo     1) No login window: run  git config --global credential.helper manager
  echo        then run this file again.
  echo     2) Wrong account: Windows Credential Manager -^> remove github.com,
  echo        then run this file again.
  echo     3) Network/TLS: try again on Wi-Fi, or ask DS1.
  echo ============================================================
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   PUSH OK
echo ============================================================
echo   Verify here (refresh the page):
echo   https://github.com/kirkbradford0/sparkprose_warboard_killchain_deck_workflow_bot/commits/main
echo.
echo   You should see the newest commit at the top.
echo.
pause
exit /b 0
