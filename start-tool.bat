@echo off
setlocal
cd /d "%~dp0"
REM ============================================================
REM  dumpsys visualizer launcher (Windows)
REM  Runs the adb bridge: node adb-bridge.js
REM  Close this window (or Ctrl+C) to stop the bridge.
REM  Keep this window open while using the tool page.
REM ============================================================

set "BRIDGE=%~dp0adb-bridge.js"
set "NODE="

REM ---- 1. find node: bundled (node\node.exe) > PATH > common install paths ----
if exist "%~dp0node\node.exe" set "NODE=%~dp0node\node.exe"
if not defined NODE (
  where node >nul 2>&1
  if %ERRORLEVEL%==0 set "NODE=node"
)
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"

if not defined NODE (
  echo [ERROR] Node.js not found.
  echo   Install Node.js, or put a portable node.exe into the "node" folder.
  pause
  exit /b 1
)

echo [OK] Node.js: %NODE%
where adb >nul 2>&1
if %ERRORLEVEL%==0 (
  echo [OK] adb ready - "Grab from device" is available.
) else (
  echo [HINT] adb not found in PATH - device grab will not work.
)

echo.
echo Starting adb bridge... Keep this window open. Close it to stop.
echo The tool page opens automatically once the bridge is ready.
echo If it does not pop up, visit http://127.0.0.1:7788/ manually.
echo.
REM NOTE: do NOT open the browser here as well - adb-bridge.js opens it
REM itself with the REAL port (which may be shifted if 7788 is taken).
REM Opening in both places was the "two index tabs" bug.
"%NODE%" "%BRIDGE%"
set "BRIDGE_RC=%ERRORLEVEL%"
if not "%BRIDGE_RC%"=="0" (
  echo.
  echo [WARN] Bridge failed to start ^(exit code %BRIDGE_RC%^).
  if exist "%~dp0index.html" (
    echo [FALLBACK] Opening the local page in degraded mode ^(device grab unavailable^)...
    start "" "%~dp0index.html" >nul 2>&1
  ) else (
    echo [ERROR] index.html not found next to this script.
  )
) else (
  echo.
  echo [STOPPED] Bridge stopped normally.
)
echo.
echo Press any key to close...
pause >nul
exit /b 0
