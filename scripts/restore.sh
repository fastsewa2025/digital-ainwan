#!/usr/bin/env bash
# Puts a backup made by backup.sh back. THIS REPLACES everything that is on the website now
# (all content, accounts and uploaded files).
#
#   ./scripts/restore.sh backups/ainwan-2026-11-02-0200.tar.gz
#
# Moving to a new server: install Docker, copy the project folder and your ".env" there,
# run "docker compose up -d --build", then run this script with the backup file.
set -euo pipefail
cd "$(dirname "$0")/.."

file="${1:-}"
if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "Usage: $0 backups/ainwan-YYYY-MM-DD-HHMM.tar.gz" >&2
  exit 1
fi

read -r -p "This REPLACES the live website data with the contents of $file. Type YES to continue: " answer
[ "$answer" = "YES" ] || { echo "Cancelled. Nothing was changed."; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
tar -C "$work" -xzf "$file" 2>/dev/null || { echo "ERROR: $file is not a readable backup file. Nothing was changed." >&2; exit 1; }
if [ ! -s "$work/database.archive.gz" ] || [ ! -s "$work/uploads.tar" ]; then
  echo "ERROR: this does not look like a file made by backup.sh. Nothing was changed." >&2
  exit 1
fi

echo "1/3 Pausing the website (visitors see a short outage)..."
docker compose stop caddy app

echo "2/3 Restoring the database..."
docker compose up -d mongo
docker compose exec -T mongo sh -c \
  'mongorestore --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --nsInclude "$APP_DB_NAME.*" --drop --archive --gzip' \
  < "$work/database.archive.gz"

echo "3/3 Restoring uploaded files..."
# Runs as the website's own user ("node"), so the restored files belong to it. (The app container
# has no extra Linux powers, so a root user here could not hand the files over afterwards.)
docker compose run --rm --no-deps -T --entrypoint sh app -c \
  'rm -rf /data/uploads/* && tar -C /data -xf -' \
  < "$work/uploads.tar"

echo "Starting the website again..."
docker compose up -d
echo "Done. Check the website, then sign in to the admin area."
