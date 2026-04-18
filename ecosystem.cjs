module.exports = {
  apps: [
    {
      name: "lumix",
      script: "node",
      args: "node_modules/tsx/dist/cli.mjs backend/_core/index.ts",
      cwd: "/root/tts-srt-generator",
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "mysql://tts_user:tts_password_123@localhost:3306/tts_generator",
        TELEGRAM_BOT_TOKEN: "8712572330:AAFvQ3LApdmI5WQO3sdoYugIHDSw7F1IQng"
      },
      watch: false,
      instances: 1,
      autorestart: true
    }
  ]
};