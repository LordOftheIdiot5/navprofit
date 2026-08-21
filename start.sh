#!/bin/sh
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "NavProfit needs Node.js. Install the LTS build from https://nodejs.org"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing NavProfit once..."
  npm install
fi

echo "NavProfit is starting at http://localhost:3000"
echo "Leave this window open. Ctrl+C to stop."

open_browser() {
  sleep 1
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:3000" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "http://localhost:3000" >/dev/null 2>&1 || true
  fi
}

open_browser &
exec node server.js
