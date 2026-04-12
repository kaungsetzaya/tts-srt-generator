# YouTube Download Solutions

## Option 1: Residential Proxy (Easiest)
Add to `.env`:
```
YTDLP_PROXY_HOST=your-residential-proxy.com
YTDLP_PROXY_PORT=8080
YTDLP_PROXY_USER=username
YTDLP_PROXY_PASS=password
```

## Option 2: Self-Host yt-dlp Server (Recommended)
Deploy yt-dlp on a separate cheap VPS (~$5/month):

**docker-compose.yml:**
```yaml
version: '3'
services:
  ytdlp-api:
    image: alexta69/metube
    container_name: ytdlp
    restart: always
    ports:
      - "8080:8081"
    volumes:
      - ./downloads:/downloads
    environment:
      - PUID=1000
      - PGID=1000
```

Then update `multiDownloader.ts` to call your API:
```typescript
const res = await fetch('http://your-vps:8080/download', {
  method: 'POST',
  body: JSON.stringify({ url, quality: '720' })
});
```

## Option 3: Current Server + Cookies (Free but Temporary)
```bash
# On your local computer:
# 1. Login to YouTube
# 2. Install "cookies.txt" extension
# 3. Export cookies
# 4. Upload to server: /root/tts-srt-generator/backend/cookies.txt
```

## Option 4: yt-dlp with Rotation (Advanced)
Multiple yt-dlp instances with different IPs/proxies.

---
Which option do you want?
