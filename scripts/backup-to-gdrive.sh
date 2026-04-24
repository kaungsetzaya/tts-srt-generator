#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# LUMIX — Daily MySQL Database Backup to Google Drive
# ═══════════════════════════════════════════════════════════════
#
# SETUP:
# 1. Install rclone: curl https://rclone.org/install.sh | bash
# 2. Configure Google Drive remote:
#    rclone config
#    → Choose "n" for new remote
#    → Name: "gdrive"
#    → Choose "Google Drive"
#    → Follow OAuth flow OR use service account
# 3. Set environment variables in .env or crontab
# 4. Add to crontab:
#    crontab -e
#    0 3 * * * /path/to/tts-srt-generator/scripts/backup-to-gdrive.sh >> /var/log/lumix-backup.log 2>&1
#
# ═══════════════════════════════════════════════════════════════

set -e

# ── Configuration ──
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-tts_generator}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive}"
GDRIVE_FOLDER="${GDRIVE_FOLDER:-LUMIX_Backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# ── Paths ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="lumix_db_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# ── Create backup directory ──
mkdir -p "${BACKUP_DIR}"

echo "═══════════════════════════════════════════"
echo "LUMIX DB Backup — ${TIMESTAMP}"
echo "═══════════════════════════════════════════"

# ── Step 1: Dump database ──
echo "[1/4] Dumping MySQL database: ${DB_NAME}..."
if [ -n "${DB_PASS}" ]; then
  mysqldump -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASS}" \
    --single-transaction --routines --triggers --events \
    "${DB_NAME}" | gzip > "${BACKUP_PATH}"
else
  mysqldump -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" \
    --single-transaction --routines --triggers --events \
    "${DB_NAME}" | gzip > "${BACKUP_PATH}"
fi

BACKUP_SIZE=$(du -sh "${BACKUP_PATH}" | cut -f1)
echo "   ✅ Dump complete: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ── Step 2: Verify backup ──
echo "[2/4] Verifying backup integrity..."
if gzip -t "${BACKUP_PATH}" 2>/dev/null; then
  echo "   ✅ Backup integrity verified"
else
  echo "   ❌ Backup file is corrupted!"
  rm -f "${BACKUP_PATH}"
  exit 1
fi

# ── Step 3: Upload to Google Drive ──
echo "[3/4] Uploading to Google Drive: ${RCLONE_REMOTE}:${GDRIVE_FOLDER}/..."

# Check if rclone is installed
if ! command -v rclone &>/dev/null; then
  echo "   ⚠️ rclone not installed. Attempting install..."
  curl -s https://rclone.org/install.sh | bash
fi

# Check if remote is configured
if ! rclone listremotes | grep -q "^${RCLONE_REMOTE}:$"; then
  echo "   ❌ rclone remote '${RCLONE_REMOTE}' not configured!"
  echo "   Run: rclone config"
  echo "   Backup saved locally: ${BACKUP_PATH}"
  exit 1
fi

# Create folder if not exists
rclone mkdir "${RCLONE_REMOTE}:${GDRIVE_FOLDER}" 2>/dev/null || true

# Upload
rclone copy "${BACKUP_PATH}" "${RCLONE_REMOTE}:${GDRIVE_FOLDER}/" \
  --progress --transfers=1 --checkers=1

echo "   ✅ Uploaded to Google Drive"

# ── Step 4: Cleanup old backups ──
echo "[4/4] Cleaning up old backups (${RETENTION_DAYS}+ days)..."

# Local cleanup
LOCAL_CLEANED=0
find "${BACKUP_DIR}" -name "lumix_db_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null && \
  LOCAL_CLEANED=$(find "${BACKUP_DIR}" -name "lumix_db_*.sql.gz" -mtime "+${RETENTION_DAYS}" 2>/dev/null | wc -l) || true
echo "   Local: cleaned ${LOCAL_CLEANED} old files"

# Google Drive cleanup (delete files older than RETENTION_DAYS)
GDRIVE_CLEANED=0
rclone delete "${RCLONE_REMOTE}:${GDRIVE_FOLDER}/" \
  --min-age "${RETENTION_DAYS}d" \
  --include "lumix_db_*.sql.gz" 2>/dev/null && \
  GDRIVE_CLEANED=1 || true
echo "   Drive: cleanup done"

# ── Summary ──
echo ""
echo "═══════════════════════════════════════════"
echo "✅ Backup Complete!"
echo "   File: ${BACKUP_FILE}"
echo "   Size: ${BACKUP_SIZE}"
echo "   Local: ${BACKUP_PATH}"
echo "   Drive: ${RCLONE_REMOTE}:${GDRIVE_FOLDER}/${BACKUP_FILE}"
echo "   Time: $(date '+%Y-%m-%d %I:%M:%S %p')"
echo "═══════════════════════════════════════════"
