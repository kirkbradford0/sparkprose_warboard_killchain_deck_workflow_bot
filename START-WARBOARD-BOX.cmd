@echo off
setlocal
REM WARBOARD BOX - one-click launch.
REM This must never inherit a Node-mode Electron flag from another console.
set ELECTRON_RUN_AS_NODE=
set NODE_OPTIONS=
cd /d "%~dp0"

REM RECURSIVE SECURITY GATE. Fails closed.
if not "%SKIP_SECURITY%"=="1" (
  node "security\run.js" --gate --quiet
  if errorlevel 1 (
    echo.
    echo SECURITY GATE FAILED. See security\report.json for the finding.
    echo Fix it, or re-baseline after review: node security\run.js --baseline
    echo Emergency only: set SKIP_SECURITY=1 and SKIP_SECURITY_REASON=...
    pause
    exit /b 1
  )
) else (
  REM A bypass must be authorized (reason) and logged; it cannot be silent.
  node "security\log-bypass.js"
  if errorlevel 1 (
    echo.
    echo BYPASS REFUSED: SKIP_SECURITY=1 requires SKIP_SECURITY_REASON (8+ chars).
    echo The gate stays closed.
    pause
    exit /b 1
  )
  echo.
  echo ************************************************************
  echo SECURITY GATE BYPASSED - logged to security\bypass.log
  echo This is an emergency path, not a production shortcut.
  echo ************************************************************
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron runtime not installed yet. Running one-time install...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo npm install failed. Check your internet connection, then run this file again.
    pause
    exit /b 1
  )
  node "node_modules\electron\install.js"
  if errorlevel 1 (
    echo.
    echo Electron runtime download failed. Check your internet connection, then run this file again.
    pause
    exit /b 1
  )
)

start "" "node_modules\electron\dist\electron.exe" "%~dp0."
exit /b 0
