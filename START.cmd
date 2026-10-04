@echo off
cd /d "%~dp0"
set "RING_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "RING_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
echo Last Standing 1 ONLINE
echo Open http://127.0.0.1:4080 in your browser.
echo Keep this window open while playing. Press Ctrl+C to stop.
"%RING_NODE%" server.mjs
pause
