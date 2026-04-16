const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3001;

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// Proxy API requests to backend
app.use('/api', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true,
}));

app.use('/webhook', createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
}));

// All other routes serve index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[TEMP-FRONTEND] Running on http://0.0.0.0:${PORT}`);
  console.log(`[TEMP-FRONTEND] API proxy to localhost:3000`);
});
