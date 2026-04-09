# VPS Deployment Commands - TTS to SRT Generator

ကျွန်တော်ရ VPS မှာ ဝင်ပြီး အောက်ပါ commands တွေကို copy-paste လုပ်ပြီး ရိုက်ပါ။

---

## **Step 1: SSH ဆက်သွယ်ပါ**

```bash
ssh root@217.76.48.32
# Password: Lucifer595539#
```

---

## **Step 2: System Update လုပ်ပါ**

```bash
apt update && apt upgrade -y
```

---

## **Step 3: Node.js Install လုပ်ပါ**

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs
node --version
npm --version
```

---

## **Step 4: Git Install လုပ်ပါ**

```bash
apt install -y git
```

---

## **Step 5: MySQL Install လုပ်ပါ**

```bash
apt install -y mysql-server
```

MySQL secure installation (အကုန် "y" ပြောပါ):

```bash
mysql_secure_installation
```

---

## **Step 6: FFmpeg Install လုပ်ပါ**

```bash
apt install -y ffmpeg
```

---

## **Step 7: PM2 Install လုပ်ပါ**

```bash
npm install -g pm2
```

---

## **Step 8: Nginx Install လုပ်ပါ**

```bash
apt install -y nginx
```

---

## **Step 9: Database ဖန်တီးပါ**

```bash
mysql -u root -p
```

Password မေးလိုက်ရင် root password ထည့်ပါ။ ပြီးမှ အောက်ပါ ရိုက်ပါ:

```sql
CREATE DATABASE tts_generator;
CREATE USER 'tts_user'@'localhost' IDENTIFIED BY 'tts_password_123';
GRANT ALL PRIVILEGES ON tts_generator.* TO 'tts_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## **Step 10: Project Clone လုပ်ပါ**

```bash
cd /home
git clone https://github.com/YOUR_GITHUB_USERNAME/tts-srt-generator.git tts-generator
cd tts-generator
```

---

## **Step 11: Dependencies Install လုပ်ပါ**

```bash
npm install -g pnpm
pnpm install
```

---

## **Step 12: Environment File ဖန်တီးပါ**

```bash
cat > .env.production << 'EOF'
DATABASE_URL=mysql://tts_user:tts_password_123@localhost:3306/tts_generator
NODE_ENV=production
PORT=3000
JWT_SECRET=your_random_jwt_secret_key_here_change_this_12345
VPS_TTS_API_URL=http://217.76.48.32:5000/generate
VPS_TTS_AUDIO_BASE_URL=http://217.76.48.32:5000/audio/
VPS_TTS_HEALTH_CHECK_URL=http://217.76.48.32:5000/health
EOF
```

---

## **Step 13: Build Application လုပ်ပါ**

```bash
pnpm build
```

---

## **Step 14: Database Migration လုပ်ပါ**

```bash
pnpm drizzle-kit migrate
```

---

## **Step 15: PM2 Start လုပ်ပါ**

```bash
pm2 start "pnpm start" --name "tts-generator"
pm2 save
pm2 startup
```

---

## **Step 16: Nginx Configuration လုပ်ပါ**

```bash
cat > /etc/nginx/sites-available/tts-generator << 'EOF'
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
EOF
```

Enable လုပ်ပါ:

```bash
ln -sf /etc/nginx/sites-available/tts-generator /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

---

## **Step 17: Firewall Setup လုပ်ပါ**

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## **Step 18: Verify Deployment လုပ်ပါ**

```bash
pm2 status
pm2 logs tts-generator
```

Browser မှာ ဖွင့်ပါ:
```
http://217.76.48.32
```

---

## **Useful Commands**

```bash
# Application status ကြည့်ပါ
pm2 status

# Logs ကြည့်ပါ
pm2 logs tts-generator -f

# Restart
pm2 restart tts-generator

# Stop
pm2 stop tts-generator

# Start
pm2 start tts-generator

# Update လုပ်ပါ
cd /home/tts-generator
git pull
pnpm install
pnpm build
pm2 restart tts-generator
```

---

## **SSL Certificate Setup (Optional)**

Domain ရှိရင်:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

---

## **Troubleshooting**

### Port 3000 already in use
```bash
lsof -i :3000
kill -9 <PID>
```

### Database connection error
```bash
mysql -u tts_user -p
# Password: tts_password_123
```

### Nginx not working
```bash
nginx -t
systemctl status nginx
systemctl restart nginx
```

---

**ပြီးပါပြီ! 🚀 ကျွန်တော်ရ application ကို VPS မှာ deploy လုပ်ပြီးပါပြီ။**
