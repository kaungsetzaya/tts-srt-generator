#!/bin/bash
# ═══════════════════════════════════════════
# LUMIX — Quick Update Script for VPS
# ═══════════════════════════════════════════

set -e

APP_DIR="/home/tts-generator"
echo "🔄 LUMIX VPS Update Started..."

# Step 1: Pull latest code
echo "[1/5] Pulling latest code..."
cd $APP_DIR
git pull origin main

# Step 2: Install any new dependencies
echo "[2/5] Installing dependencies..."
pnpm install

# Step 3: Run DB migration (add payment_method + payment_slip columns)
echo "[3/5] Running database migration..."
mysql -u tts_user -ptts_password_123 tts_generator -e "
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method varchar(30) DEFAULT NULL;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_slip text DEFAULT NULL;
" 2>/dev/null || echo "  → Columns may already exist, skipping..."

# Step 4: Build
echo "[4/5] Building application..."
pnpm build

# Step 5: Restart PM2
echo "[5/5] Restarting application..."
pm2 restart tts-generator

echo ""
echo "═══════════════════════════════════════════"
echo "✅ Update Complete!"
echo "═══════════════════════════════════════════"
echo ""
echo "Check status: pm2 status"
echo "Check logs:   pm2 logs tts-generator -f"
