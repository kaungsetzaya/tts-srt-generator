module.exports = {
  apps: [
    {
      name: "lumix-app",
      script: "./dist/start.cjs",
      cwd: "/root/tts-srt-generator",
      env: {
        NODE_ENV: "production",
        NODE_PATH: "/root/tts-srt-generator/backend/node_modules:/root/tts-srt-generator/node_modules",
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
    },
  ],
};
