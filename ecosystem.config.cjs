// Load .env file
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

module.exports = {
  apps: [{
    name: "lumix",
    script: "./dist/index.js",
    env: {
      NODE_ENV: "production"
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G"
  }]
};
