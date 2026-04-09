# Project Structure

## 📁 Root Directory Organization

```
tts-srt-generator/
├── client/              # Frontend React application
├── server/              # Backend Express server
├── shared/              # Shared utilities and types
├── drizzle/             # Database migrations and schema
├── docs/                # Documentation files
├── scripts/             # Deployment and utility scripts
├── dist/                # Build output (gitignored)
├── node_modules/        # Dependencies (gitignored)
├── output/              # Generated media files (gitignored)
├── tmp_video/           # Temporary video processing (gitignored)
├── patches/             # Dependency patches
├── .gitignore           # Git ignore rules
├── .prettierrc          # Code formatting config
├── components.json      # Shadcn/ui components config
├── drizzle.config.ts    # Database configuration
├── package.json         # Project dependencies
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite build configuration
└── vitest.config.ts     # Test configuration
```

## 📚 Documentation (`docs/`)

- `VPS_DEPLOYMENT_GUIDE.md` - Complete VPS deployment instructions
- `VPS_DEPLOYMENT_COMMANDS.md` - Command reference for deployment
- `todo.md` - Project todo list
- `PROJECT_STRUCTURE.md` - This file

## 🔧 Scripts (`scripts/`)

- `auto_deploy_vps.sh` - Automated VPS deployment script
- `deploy-vps.sh` - Manual VPS deployment script
- `update_vps.sh` - VPS update script
- `backup-to-gdrive.sh` - Google Drive backup script
- `install-myanmar-fonts.sh` - Myanmar font installation script

## 🔐 Security Notes

**Files removed from Git tracking:**
- `cookies.txt` - Authentication cookies (now gitignored)
- `output/` - Generated media files (now gitignored)
- `tmp_video/` - Temporary processing files (now gitignored)

**Always ensure `.env` files are never committed to Git.**

## 🚀 Quick Start

1. Install dependencies: `npm install`
2. Set up environment: Copy `.env.example` to `.env`
3. Run development: `npm run dev`
4. Build for production: `npm run build`
5. Deploy to VPS: `cd scripts && ./auto_deploy_vps.sh`
