#!/usr/bin/env bash
# Browser tests: the admin area (sign in, forms, uploads, approval, users, Hindi screens, phone layout)
# and a villager's journey (register, verification, directory numbers, recording a story, /en pages).
# Needs: MongoDB on this computer, Node 22, Python 3 with Playwright (pip install playwright && playwright install chromium).
#
#   e2e/run.sh
#
# It uses a new throw-away database and deletes it afterwards. Screenshots land in $E2E_OUT (default: a temp folder).
set -euo pipefail
cd "$(dirname "$0")/.."
root="$(pwd)"

PORT="${E2E_PORT:-5055}"
DB="ainwan_e2e_$(date +%s)"
OUT="${E2E_OUT:-$(mktemp -d)}"
export E2E_OUT="$OUT" E2E_BASE="http://localhost:$PORT"
export MONGO_URI="${E2E_MONGO_HOST:-mongodb://127.0.0.1:27017}/$DB"
export PORT PUBLIC_URL="$E2E_BASE" CLIENT_DIST="$root/client/dist" UPLOAD_DIR="$OUT/uploads" LOG_LEVEL=warn NODE_ENV=development

[ -f client/dist/index.html ] || { echo "Building the website first..."; npm --prefix client run build; }
mkdir -p "$OUT"

cd server
ADMIN_EMAIL=mukhiya@ainwan.test ADMIN_NAME="Ramesh Singh" ADMIN_PASSWORD='Temp-Start-2026' node src/scripts/seed-admin.js >/dev/null
node src/scripts/seed-demo.js >/dev/null

node src/index.js > "$OUT/server.log" 2>&1 &
server_pid=$!
cleanup() {
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  node --input-type=module -e "import m from 'mongoose'; await m.connect(process.env.MONGO_URI); await m.connection.dropDatabase(); await m.disconnect();" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 40); do curl -fs "$E2E_BASE/api/health" >/dev/null 2>&1 && break; sleep 0.5; done
curl -fs "$E2E_BASE/api/health" >/dev/null || { echo "The server did not start. See $OUT/server.log"; exit 1; }

cd "$root"
status=0
python3 -u e2e/admin.e2e.py || status=$?
echo
echo "--- villager journey (phone size) ---"
python3 -u e2e/villager.e2e.py || status=$?
echo "Screenshots: $OUT/shots"
exit $status
