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
echo Tool page: http://127.0.0.1:7788/
echo.
start "" "http://127.0.0.1:7788/" >nul 2>&1
"%NODE%" "%BRIDGE%"
echo.
echo [STOPPED] Press any key to close...
pause >nul
exit /b 0
