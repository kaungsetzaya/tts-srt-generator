#!/bin/bash

# TTS to SRT Generator - VPS Deployment Script
# This script automates the deployment process on a VPS

set -e

echo "=========================================="
echo "TTS to SRT Generator - VPS Deployment"
echo "=========================================="

# Step 1: System Update
echo ""
echo "[1/10] Updating system packages..."
apt update && apt upgrade -y

# Step 2: Install Node.js
echo ""
echo "[2/10] Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs

# Step 3: Install Git
echo ""
echo "[3/10] Installing Git..."
apt install -y git

# Step 4: Install MySQL
echo ""
echo "[4/10] Installing MySQL..."
apt install -y mysql-server

# Step 5: Install FFmpeg
echo ""
echo "[5/10] Installing FFmpeg..."
apt install -y ffmpeg

# Step 6: Install PM2
echo ""
echo "[6/10] Installing PM2..."
npm install -g pm2

# Step 7: Install Nginx
echo ""
echo "[7/10] Installing Nginx..."
apt install -y nginx

# Step 8: Create application directory and clone project
echo ""
echo "[8/10] Cloning project from GitHub..."
cd /home
if [ -d "tts-generator" ]; then
    rm -rf tts-generator
fi
git clone https://github.com/kaungsetzaya/tts-srt-generator.git tts-generator
cd tts-generator

# Step 9: Install dependencies and build
echo ""
echo "[9/10] Installing dependencies and building..."
npm install -g pnpm
pnpm install
pnpm build

# Step 10: Setup environment and database
echo ""
echo "[10/10] Setting up environment and database..."

# Generate random passwords
DB_PASSWORD=$(openssl rand -hex 12)
JWT_SECRET=$(openssl rand -hex 32)

echo "Generated DB Password: (first 8 chars) ${DB_PASSWORD:0:8}..."
echo "Generated JWT Secret: (first 8 chars) ${JWT_SECRET:0:8}..."

# Create .env.production file
cat > .env.production << ENVFILE
DATABASE_URL=mysql://tts_user:${DB_PASSWORD}@localhost:3306/tts_generator
NODE_ENV=production
PORT=3000
JWT_SECRET=${JWT_SECRET}
VPS_TTS_API_URL=http://217.76.48.32:5000/generate
VPS_TTS_AUDIO_BASE_URL=http://217.76.48.32:5000/audio/
VPS_TTS_HEALTH_CHECK_URL=http://217.76.48.32:5000/health
ENVFILE

# Create MySQL database
mysql -u root << SQLFILE
CREATE DATABASE IF NOT EXISTS tts_generator;
CREATE USER IF NOT EXISTS 'tts_user'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON tts_generator.* TO 'tts_user'@'localhost';
FLUSH PRIVILEGES;
SQLFILE

# Run database migrations
pnpm drizzle-kit migrate

# Start application with PM2
pm2 start "pnpm start" --name "tts-generator"
pm2 save
pm2 startup

# Configure Nginx
cat > /etc/nginx/sites-available/tts-generator << 'NGINXFILE'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXFILE

ln -sf /etc/nginx/sites-available/tts-generator /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Your application is running at:"
echo "http://$(hostname -I | awk '{print $1}')"
echo ""
echo "Useful commands:"
echo "  pm2 status              - Check application status"
echo "  pm2 logs tts-generator  - View application logs"
echo "  pm2 restart tts-generator - Restart application"
echo ""
echo "To setup SSL certificate:"
echo "  apt install certbot python3-certbot-nginx"
echo "  certbot --nginx -d your-domain.com"
echo ""
