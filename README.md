# LUMIX TTS SRT Generator

Full-stack Myanmar TTS generator with AI video dubbing capabilities.

## 📁 Project Structure

```
tts-srt-generator/
├── frontend/          # Vite + React frontend (deploys to Vercel)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── backend/           # Express + tRPC server (deploys to VPS)
│   ├── server/        # API routes and core logic
│   ├── shared/        # Shared types and utilities
│   ├── drizzle/       # Database schema and migrations
│   └── scripts/       # Utility scripts
└── vercel.json        # Vercel deployment config
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

## 📦 Monorepo Migration

This project was recently restructured from a single-folder layout to separate frontend/backend folders for easier deployment.

### Migration Notes:
- Frontend code moved from `client/` to `frontend/`
- Backend code moved from `server/` to `backend/`
- Shared types and utilities are in `backend/shared/`
- Database migrations are in `backend/drizzle/`
