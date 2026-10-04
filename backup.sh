#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${PACKERA_DATA_DIR:-/srv/pakera-data}"
BACKUP_DIR="$DATA_DIR/backups"
umask 077

mkdir -p "$BACKUP_DIR"
TEMP_DIR=$(mktemp -d "$BACKUP_DIR/.backup_${TIMESTAMP}.XXXXXX")
TEMP_ARCHIVE="$BACKUP_DIR/.backup_${TIMESTAMP}.tar.gz"
trap 'rm -rf "$TEMP_DIR"; rm -f "$TEMP_ARCHIVE"' EXIT

docker exec packera_db pg_dump -U packera -d packera > "$TEMP_DIR/database.sql"
test -s "$TEMP_DIR/database.sql"
test -d "$DATA_DIR/products"
tar -czf "$TEMP_ARCHIVE" -C "$TEMP_DIR" database.sql -C "$DATA_DIR" products
test -s "$TEMP_ARCHIVE"
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.tar.gz"
mv "$TEMP_ARCHIVE" "$BACKUP_FILE"
rm -rf "$TEMP_DIR"
trap - EXIT

echo "Backup created: $BACKUP_FILE"

# Eski backuplarni o'chirish (14 kundan eski)
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "backup_*.sql" -o -name "backup_*.tar.gz" \) -mtime +14 -delete
echo "Old backups cleaned up"
