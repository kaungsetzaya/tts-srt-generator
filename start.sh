#!/bin/bash
cd /root/tts-srt-generator
export NODE_ENV=production

# Credentials must be set via environment variables or .env file
# DO NOT hardcode secrets in this file
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is required"
  exit 1
fi

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "ERROR: TELEGRAM_BOT_TOKEN environment variable is required"
  exit 1
fi

exec node_modules/tsx/dist/cli.mjs backend/_core/index.ts
