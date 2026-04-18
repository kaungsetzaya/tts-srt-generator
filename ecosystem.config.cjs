// Load .env file
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const dbConnectionString = process.env.DATABASE_URL;

module.exports = {
  apps: [{
    name: "lumix",
    script: "npx",
    args: "tsx backend/_core/index.ts",
    interpreter: "none",
    env: {
      NODE_ENV: "production",
      DATABASE_URL: dbConnectionString,
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
  }]
};
