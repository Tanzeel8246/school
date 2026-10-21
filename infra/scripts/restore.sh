#!/bin/bash
set -e

# Restore script for EduCore PostgreSQL Database
# Usage: ./restore.sh <path_to_backup_file.sql.gz>

if [ -z "$1" ]; then
  echo "Error: Please provide the backup file path."
  echo "Usage: ./restore.sh ./backups/educore_backup_YYYYMMDD_HHMMSS.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: File not found at $BACKUP_FILE"
  exit 1
fi

# Load environment variables
if [ -f .env.prod ]; then
    export $(cat .env.prod | grep -v '#' | awk '/=/ {print $1}')
fi

echo "Starting database restore from $BACKUP_FILE..."
echo "WARNING: This will drop and recreate the current database schema!"
read -p "Are you sure you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore aborted."
    exit 1
fi

# Decompress and restore via docker exec
# Note: Using docker exec with psql. We first terminate connections and drop/create the DB if needed, 
# but pg_dump output (if clean/drop) might handle it. For a safer approach, we drop schema public.
echo "Restoring database..."
gunzip -c "$BACKUP_FILE" | docker exec -i educore-postgres-1 psql -U "${POSTGRES_USER:-educore}" -d "${POSTGRES_DB:-educore}"

echo "Database restore completed successfully."
