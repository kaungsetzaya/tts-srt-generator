module.exports = {
  apps: [
    {
      name: "lumix",
      script: "node",
      args: "node_modules/tsx/dist/cli.mjs backend/_core/index.ts",
      cwd: "/root/tts-srt-generator",
      env: {
        NODE_ENV: "production",
        // Set secrets via environment variables or a .env file — never hardcode here
        // DATABASE_URL: "mysql://user:password@localhost:3306/db"
        // TELEGRAM_BOT_TOKEN: "..."
      },
      watch: false,
      instances: 1,
      autorestart: true,
    },
  ],
};