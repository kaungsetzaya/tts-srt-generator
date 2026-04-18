#!/bin/bash
cd /root/tts-srt-generator
export NODE_ENV=production
export DATABASE_URL="mysql://tts_user:tts_password_123@localhost:3306/tts_generator"
export TELEGRAM_BOT_TOKEN="8712572330:AAFvQ3LApdmI5WQO3sdoYugIHDSw7F1IQng"
exec node_modules/tsx/dist/cli.mjs backend/_core/index.ts