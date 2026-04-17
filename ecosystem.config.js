// Load .env file
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const dbConnectionString = process.env.DATABASE_URL;

module.exports = {
  apps: [{
    name: "lumix",
    script: "./dist/index.js",
    env: {
      NODE_ENV: "production",
      DATABASE_URL: dbConnectionString,
      PATH: "/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin",
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
  }]
};
