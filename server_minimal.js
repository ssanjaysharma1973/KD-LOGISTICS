const express = require('express');
const app = express();

const PORT = process.env.PORT || 8080;

// Logging middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path} from ${req.ip}`);
  next();
});

// Health endpoint
app.get('/api/health', (req, res) => {
  console.log('[ROUTE] /api/health called');
  res.json({ status: 'healthy', time: new Date().toISOString() });
});

// Ping endpoint
app.get('/ping', (req, res) => {
  console.log('[ROUTE] /ping called');
  res.send('PONG');
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('[ROUTE] / called');
  res.json({ service: 'Atul Logistics API', status: 'ok', time: new Date().toISOString() });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('[ROUTE] /api/test called');
  res.json({ message: 'Test endpoint working', time: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  console.log(`[ERROR] 404 not found: ${req.path}`);
  res.status(404).json({ error: 'not found' });
});

// Start server
console.log(`[STARTUP] Starting server on 0.0.0.0:${PORT}`);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[STARTUP] Server listening on port ${PORT}`);
});
