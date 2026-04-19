# LUMIX TTS SRT Generator

Full-stack Myanmar TTS generator with AI video dubbing capabilities.

## 📁 Project Structure

```
tts-srt-generator/
├── frontend/          # Vite + React frontend (deploys to Vercel)
├── backend/           # Express + tRPC server (deploys to VPS)
│   ├── _core/        # Core server logic
│   └── *.ts          # API routers and services
├── shared/            # Shared types and constants
├── drizzle/          # Database schema and migrations
├── dist/             # Build output
├── output/           # Generated files
├── docs/              # Documentation
├── scripts/           # Utility scripts
└── [config files]
```

## 🚀 Deployment

### Frontend (Vercel)
```bash
# Via Vercel CLI
npm i -g vercel
vercel

# Or via Vercel Dashboard
# Import GitHub repo: kaungsetzaya/tts-srt-generator
```

### Backend (VPS)
```bash
cd backend
pnpm install
pnpm build
pm2 start dist/index.js --name lumix
```

## 🔗 API Configuration

Frontend proxies API calls to backend:
- `/api/*` → `https://choco.de5.net/api/*`
- `/trpc/*` → `https://choco.de5.net/trpc/*`

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Run type check
pnpm run check

# Run tests
pnpm run test

# Format code
pnpm run format
```
