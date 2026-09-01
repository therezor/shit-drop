#!/bin/sh
# Double-click me.
#
# This site uses ES modules, which browsers refuse to load over file:// —
# every local file counts as its own opaque origin, so the imports get
# blocked by CORS. So it has to be served over HTTP. That's all this does.
cd "$(dirname "$0")" || exit 1
PORT=8080
while nc -z localhost $PORT 2>/dev/null; do PORT=$((PORT + 1)); done
echo "💩 SHIT DROP → http://localhost:$PORT"
echo "   (close this window to stop the server)"
(sleep 1 && open "http://localhost:$PORT") &
exec python3 -m http.server $PORT
