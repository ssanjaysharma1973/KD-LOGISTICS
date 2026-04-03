import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const BUILD_DIR = path.join(__dirname, 'build');

console.log('[MINIMAL-SERVER] Starting emergency fallback server...');
console.log('[MINIMAL-SERVER] BUILD_DIR:', BUILD_DIR);
console.log('[MINIMAL-SERVER] PORT:', PORT);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // Healthcheck endpoint
  if (pathname === '/api/health' || pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', ts: Date.now(), mode: 'minimal' }));
  }

  // Try to serve static files from build directory
  let filePath = path.join(BUILD_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(BUILD_DIR)) {
    filePath = path.join(BUILD_DIR, 'index.html');
  }

  // If file doesn't exist, serve index.html (for SPA routing)
  if (!fs.existsSync(filePath)) {
    filePath = path.join(BUILD_DIR, 'index.html');
  }

  // Serve the file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found\n' + err.message);
    }

    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
    };

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ [MINIMAL-SERVER] Listening on http://0.0.0.0:${PORT}`);
  console.log('[MINIMAL-SERVER] Mode: Frontend serving only (backend disabled)');
});

server.on('error', (err) => {
  console.error('[MINIMAL-SERVER] Error:', err.message);
  process.exit(1);
});
