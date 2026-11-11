@echo off
setlocal
cd /d "%~dp0"
set "CROWNFALL_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  set "CROWNFALL_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if not exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    echo Node.js 18 or newer is required for LAN play.
    echo You can still open index.html directly to play against AI.
    pause
    exit /b 1
  )
)
echo Opening Crownfall at http://localhost:3210
echo Keep this window open while playing over LAN.
start "" "http://localhost:3210"
"%CROWNFALL_NODE%" server.cjs
pause
