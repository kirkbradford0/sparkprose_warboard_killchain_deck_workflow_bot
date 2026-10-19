@echo off
REM SHOW DECKS - where the decks are, on disk and in the app.
setlocal
cd /d "%~dp0"

echo.
echo ============================================================
echo  WARBOARD BOX - DECKS
echo ============================================================
echo  data root: %CD%\data
echo  decks    : %CD%\data\decks
echo  box      : %CD%\data\boxes\current\box.json
echo.
echo  Each deck folder contains:
echo    00-README.md  01-source-notes.md  02-structured.md
echo    03-actions.md  deck.json  attachments\
echo.
echo  IN THE APP: top bar - WARBOARDS ^| DECKS ^| BOX ^| SHIPPED ^| SETTINGS
echo  Click DECKS, pick a deck, read the four files, tick the box,
echo  then CONFIRM ^& LOCK DECK.
echo.
echo ------------------------------------------------------------
if exist node.exe (
  node "scripts\state-summary.js"
) else (
  dir /b "data\decks"
)
echo ------------------------------------------------------------
echo.
echo Opening the decks folder in Explorer...
start "" "%CD%\data\decks"
echo.
echo To open the app: START-WARBOARD-BOX.cmd
echo To fix a missing runtime first: powershell -NoProfile -ExecutionPolicy Bypass -File DOCTOR.ps1 -Fix -Launch
echo.
pause
