#!/usr/bin/env bash
# Saves the database AND every uploaded photo, audio file and PDF into one file:
#   backups/ainwan-YYYY-MM-DD-HHMM.tar.gz
#
#   ./scripts/backup.sh                     run by hand, or from cron (see DEPLOYMENT.md)
#   KEEP=30 ./scripts/backup.sh             keep the newest 30 instead of 14
#
# IMPORTANT: a backup that stays on the same server is not enough. If the server or its disk is
# lost, the backups go with it. Copy the newest file somewhere else regularly (see DEPLOYMENT.md).
set -euo pipefail
cd "$(dirname "$0")/.."

KEEP="${KEEP:-14}"
stamp="$(date +%Y-%m-%d-%H%M)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p backups

echo "1/3 Saving the database..."
docker compose exec -T mongo sh -c \
  'mongodump --quiet --username root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db "$APP_DB_NAME" --archive --gzip' \
  > "$work/database.archive.gz"

echo "2/3 Saving uploaded files..."
docker compose exec -T app tar -C /data -cf - uploads > "$work/uploads.tar"

# An empty file means one of the steps failed quietly. Better to stop than to keep a useless backup.
[ -s "$work/database.archive.gz" ] || { echo "ERROR: the database backup is empty. Nothing was saved." >&2; exit 1; }
[ -s "$work/uploads.tar" ] || { echo "ERROR: the files backup is empty. Nothing was saved." >&2; exit 1; }

echo "3/3 Packing..."
out="backups/ainwan-$stamp.tar.gz"
tar -C "$work" -czf "$out" database.archive.gz uploads.tar

# Delete the oldest ones, keep the newest $KEEP.
ls -1t backups/ainwan-*.tar.gz | tail -n +"$((KEEP + 1))" | xargs -r rm --

echo "Done: $out ($(du -h "$out" | cut -f1))"
