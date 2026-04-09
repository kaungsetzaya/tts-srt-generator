#!/bin/bash

# TTS to SRT Generator - Automated VPS Deployment

set -e

VPS_IP="217.76.48.32"
VPS_USER="root"

echo "=========================================="
echo "TTS to SRT Generator - VPS Deployment"
echo "=========================================="
echo ""

# Step 1: System Update
echo "[1/15] System Update..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "apt update && apt upgrade -y" &
wait

# Step 2-8: Install packages
echo "[2/15] Installing Node.js..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && apt install -y nodejs" &
wait

echo "[3/15] Installing Git..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "apt install -y git" &
wait

echo "[4/15] Installing MySQL..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "apt install -y mysql-server" &
wait

echo "[5/15] Installing FFmpeg..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "apt install -y ffmpeg" &
wait

echo "[6/15] Installing PM2..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "npm install -g pm2" &
wait

echo "[7/15] Installing Nginx..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "apt install -y nginx" &
wait

echo "[8/15] Installing pnpm..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "npm install -g pnpm" &
wait

echo "[9/15] Creating MySQL Database..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "mysql -u root -e 'CREATE DATABASE IF NOT EXISTS tts_generator; CREATE USER IF NOT EXISTS \"tts_user\"@\"localhost\" IDENTIFIED BY \"tts_password_123\"; GRANT ALL PRIVILEGES ON tts_generator.* TO \"tts_user\"@\"localhost\"; FLUSH PRIVILEGES;'" &
wait

echo "[10/15] Cloning Project..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "cd /home && git clone https://github.com/amonkamel5/tts-srt-generator.git tts-generator 2>/dev/null || (cd tts-generator && git pull)" &
wait

echo "[11/15] Creating Environment File..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "cat > /home/tts-generator/.env.production << 'ENVFILE'
DATABASE_URL=mysql://tts_user:tts_password_123@localhost:3306/tts_generator
NODE_ENV=production
PORT=3000
JWT_SECRET=your_random_jwt_secret_key_here_change_this_12345
VPS_TTS_API_URL=http://217.76.48.32:5000/generate
VPS_TTS_AUDIO_BASE_URL=http://217.76.48.32:5000/audio/
VPS_TTS_HEALTH_CHECK_URL=http://217.76.48.32:5000/health
ENVFILE" &
wait

echo "[12/15] Installing Dependencies..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "cd /home/tts-generator && pnpm install" &
wait

echo "[13/15] Building Application..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "cd /home/tts-generator && pnpm build" &
wait

echo "[14/15] Running Database Migration..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "cd /home/tts-generator && pnpm drizzle-kit migrate" &
wait

echo "[15/15] Starting Application with PM2..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "cd /home/tts-generator && pm2 stop tts-generator 2>/dev/null || true && pm2 delete tts-generator 2>/dev/null || true && pm2 start 'pnpm start' --name 'tts-generator' && pm2 save && pm2 startup" &
wait

echo "[NGINX] Configuring Nginx..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "cat > /etc/nginx/sites-available/tts-generator << 'NGINXCONF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINXCONF
ln -sf /etc/nginx/sites-available/tts-generator /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t
systemctl restart nginx" &
wait

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Your application is running at:"
echo "http://217.76.48.32"
echo ""
echo "Useful Commands:"
echo "  ssh root@217.76.48.32"
echo "  pm2 status"
echo "  pm2 logs tts-generator -f"
echo "  pm2 restart tts-generator"
echo ""

