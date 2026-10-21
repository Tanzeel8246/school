#!/bin/bash
set -e

# Backup script for EduCore PostgreSQL Database
# Usage: ./backup.sh

# Load environment variables
if [ -f .env.prod ]; then
    export $(cat .env.prod | grep -v '#' | awk '/=/ {print $1}')
fi

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/educore_backup_$TIMESTAMP.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting database backup at $TIMESTAMP..."

# Dump the database
# We use docker exec to run pg_dump inside the postgres container
docker exec educore-postgres-1 pg_dump -U "${POSTGRES_USER:-educore}" -d "${POSTGRES_DB:-educore}" | gzip > "$BACKUP_FILE"

echo "Backup completed: $BACKUP_FILE"

# Clean up old backups (older than 7 days)
echo "Cleaning up backups older than 7 days..."
find "$BACKUP_DIR" -name "educore_backup_*.sql.gz" -type f -mtime +7 -exec rm {} \;

echo "Backup process finished successfully."
