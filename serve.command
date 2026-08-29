#!/bin/bash
# Double-click this file to serve the prep library at http://localhost:8090
cd "$(dirname "$0")" || exit 1

PORT=8090
if lsof -i :$PORT >/dev/null 2>&1; then
  echo "Port $PORT is already in use."
  echo "If that is this server already running, just open http://localhost:$PORT"
  echo "Otherwise free the port, or edit PORT in this file."
  echo
  read -r -p "Press Enter to close..."
  exit 1
fi

echo "Serving $(pwd)"
echo "  -> http://localhost:$PORT"
echo
echo "Press Ctrl+C to stop."
echo

sleep 1 && open "http://localhost:$PORT" &
python3 -m http.server $PORT
