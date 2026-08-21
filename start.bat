@echo off
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  NavProfit needs Node.js on this PC.
  echo  Install the LTS build from https://nodejs.org then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing NavProfit once...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo  NavProfit is starting at http://localhost:3000
echo  Leave this window open. Close it to stop.
echo.
start "" "http://localhost:3000"
node server.js
pause
