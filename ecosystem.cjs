module.exports = {
  apps: [{
    name: "lumix",
    script: "./node_modules/.bin/tsx",
    args: "backend/_core/index.ts",
    env: {
      NODE_ENV: "production"
    },
    cwd: "/root/tts-srt-generator"
  }]
};