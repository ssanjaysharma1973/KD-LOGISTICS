#!/usr/bin/env node
/**
 * Express.js API server for Atul Logistics
 * Minimal implementation to verify Railway routing works with Node.js
 */
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Node.js API is working!', time: new Date().toISOString() });
});

// Root
app.get('/', (req, res) => {
  res.json({ service: 'Atul Logistics API', version: '1.0.0', runtime: 'Node.js' });
});

// Ping
app.get('/ping', (req, res) => {
  res.json({ pong: true, timestamp: new Date().toISOString() });
});

// Catch-all
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[STARTUP] Node.js API listening on 0.0.0.0:${PORT}`);
  console.log(`[STARTUP] Health check at: http://localhost:${PORT}/api/health`);
});
