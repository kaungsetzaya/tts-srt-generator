module.exports = {
  apps: [{
    name: "lumix",
    script: "./dist/index.js",
    env: {
      GEMINI_API_KEY: "AIzaSyAZ9buW9OpCTau0OafduRUF2YEHs0Re_y8",
      NODE_ENV: "production"
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G"
  }]
};