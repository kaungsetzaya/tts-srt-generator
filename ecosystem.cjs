module.exports = {
  apps: [
    {
      name: "lumix",
      script: "npx",
      args: "tsx backend/_core/index.ts",
      cwd: "/root/tts-srt-generator",
      interpreter: "none",
      env: {
        NODE_ENV: "production"
      },
      watch: false,
      instances: 1,
      autorestart: true
    }
  ]
};