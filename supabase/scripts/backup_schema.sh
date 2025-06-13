#!/bin/bash
# Schema Backup Script
# Usage: SUPABASE_DB_PASSWORD='your_password' ./backup_schema.sh

BACKUP_DIR="supabase/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/schema_backup_$(date +%Y%m%d%H%M%S).sql"

echo "Backing up schema to $BACKUP_FILE..."
PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump \
  -h lefvtgqockzqkasylzwb.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  --schema-only \
  --no-owner \
  --no-privileges \
  --file="$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "Backup completed successfully"
  echo "File saved to: $BACKUP_FILE"
else
  echo "Backup failed" >&2
  exit 1
fi
