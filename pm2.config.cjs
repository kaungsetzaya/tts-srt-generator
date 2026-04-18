module.exports = {
  apps: [{
    name: "lumix",
    script: "npx",
    args: "tsx backend/_core/index.ts",
    cwd: "/root/tts-srt-generator",
    env: {
      NODE_ENV: "production"
    },
    watch: false,
    instances: 1,
    autorestart: true,
    exp_backoff_restart_delay: 100
  }]
};