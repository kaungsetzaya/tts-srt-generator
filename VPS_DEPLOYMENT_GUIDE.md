# VPS Deployment Guide - TTS to SRT Generator

ဒီ guide မှာ ကျွန်တော်ရ VPS မှာ TTS to SRT Generator application ကို deploy လုပ်ဖို့ အဆင့်ဆင့် ပြောပြပါ့မယ်။

---

## Prerequisites (လိုအပ်တဲ့ အရာ)

- VPS server (Ubuntu 20.04 or later recommended)
- SSH access to your VPS
- Domain name (optional, but recommended)
- Basic Linux command line knowledge

---

## Step 1: VPS မှာ SSH ဆက်သွယ်ပါ

```bash
ssh root@YOUR_VPS_IP_ADDRESS
# Password မေးလိုက်ရင် password ထည့်ပါ
```

---

## Step 2: System Updates လုပ်ပါ

```bash
apt update && apt upgrade -y
```

---

## Step 3: Node.js Install လုပ်ပါ

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs
node --version
npm --version
```

---

## Step 4: Git Install လုပ်ပါ

```bash
apt install -y git
```

---

## Step 5: MySQL Database Install လုပ်ပါ

```bash
apt install -y mysql-server
mysql_secure_installation
# လေးခုမေးလိုက်ပါ့မယ်။ အကုန် "y" ပြောပါ။
```

Database ဖန်တီးပါ:

```bash
mysql -u root -p
# Password ထည့်ပါ

CREATE DATABASE tts_generator;
CREATE USER 'tts_user'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT ALL PRIVILEGES ON tts_generator.* TO 'tts_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## Step 6: FFmpeg Install လုပ်ပါ

```bash
apt install -y ffmpeg
ffmpeg -version
```

---

## Step 7: Application Download လုပ်ပါ

```bash
cd /home
git clone <YOUR_GITHUB_REPO_URL> tts-generator
cd tts-generator
```

---

## Step 8: Environment Variables Setup လုပ်ပါ

```bash
nano .env.production
```

အောက်ပါ အရာတွေ ထည့်သွင်းပါ:

```
# Database
DATABASE_URL=mysql://tts_user:strong_password_here@localhost:3306/tts_generator

# Node Environment
NODE_ENV=production
PORT=3000

# JWT Secret (random string ဖန်တီးပါ)
JWT_SECRET=your_random_jwt_secret_here

# VPS TTS API
VPS_TTS_API_URL=http://217.76.48.32:5000/generate
VPS_TTS_AUDIO_BASE_URL=http://217.76.48.32:5000/audio/
VPS_TTS_HEALTH_CHECK_URL=http://217.76.48.32:5000/health

# OAuth (Manus သုံးမယ်ဆိုရင်)
VITE_APP_ID=your_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
```

---

## Step 9: Dependencies Install လုပ်ပါ

```bash
npm install -g pnpm
pnpm install
```

---

## Step 10: Database Migration လုပ်ပါ

```bash
pnpm drizzle-kit migrate
```

---

## Step 11: Build Application လုပ်ပါ

```bash
pnpm build
```

---

## Step 12: PM2 Install လုပ်ပါ (Process Manager)

```bash
npm install -g pm2
```

---

## Step 13: PM2 Start လုပ်ပါ

```bash
pm2 start "pnpm start" --name "tts-generator"
pm2 save
pm2 startup
```

---

## Step 14: Nginx Install လုပ်ပါ (Reverse Proxy)

```bash
apt install -y nginx
```

Nginx configuration file ဖန်တီးပါ:

```bash
nano /etc/nginx/sites-available/tts-generator
```

အောက်ပါ အရာ ထည့်သွင်းပါ:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable လုပ်ပါ:

```bash
ln -s /etc/nginx/sites-available/tts-generator /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

---

## Step 15: SSL Certificate Setup လုပ်ပါ (HTTPS)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d YOUR_DOMAIN
```

---

## Step 16: Firewall Setup လုပ်ပါ

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## Verification (အဆင်ပြေတယ်လားစမ်းပါ)

```bash
# Application status ကြည့်ပါ
pm2 status

# Logs ကြည့်ပါ
pm2 logs tts-generator

# Application ကို browser မှာ ဖွင့်ပါ
# http://YOUR_VPS_IP_OR_DOMAIN
```

---

## Maintenance Commands

```bash
# Application restart လုပ်ပါ
pm2 restart tts-generator

# Application stop လုပ်ပါ
pm2 stop tts-generator

# Application start လုပ်ပါ
pm2 start tts-generator

# Logs ကြည့်ပါ
pm2 logs tts-generator -f

# Update လုပ်ပါ
cd /home/tts-generator
git pull
pnpm install
pnpm build
pm2 restart tts-generator
```

---

## Troubleshooting

### Port 3000 already in use
```bash
lsof -i :3000
kill -9 <PID>
```

### Database connection error
```bash
mysql -u tts_user -p
# ကျွန်တော်ရ password ထည့်ပါ
```

### Nginx not working
```bash
nginx -t
systemctl status nginx
```

---

## Backup & Restore

### Database Backup လုပ်ပါ
```bash
mysqldump -u tts_user -p tts_generator > backup.sql
```

### Database Restore လုပ်ပါ
```bash
mysql -u tts_user -p tts_generator < backup.sql
```

---

## Support

ပြဿနာ ရှိရင် VPS provider ရဲ့ support team ကို ဆက်သွယ်ပါ။

---

**Happy Deploying! 🚀**
