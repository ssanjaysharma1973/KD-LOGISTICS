// Lightweight continuous sync loop for local sync server
// Usage: node sync-loop.js
const fs = require('fs');

function loadEnv() {
  const p = './.env';
  if (!fs.existsSync(p)) return;
  const s = fs.readFileSync(p, 'utf8');
  s.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  });
}

loadEnv();

const SYNC_INTERVAL_SEC = Number(process.env.SYNC_INTERVAL_SEC || 30);
const API_BASE = window.__API_BASE = window.__API_BASE || '%REACT_APP_API_URL%' || 'http://localhost:5000/api';
const TENANTS = (process.env.SYNC_TENANTS || process.env.REACT_APP_CLIENT1_ID || 'client1').split(',').map(s => s.trim()).filter(Boolean);

async function syncTenant(tenant) {
  try {
    const url = `${API_BASE}/sync?tenantId=${encodeURIComponent(tenant)}`;
    const r = await fetch(url, { method: 'GET' });
    const j = await r.json();
    console.log(new Date().toISOString(), 'sync', tenant, j);
  } catch (err) {
    console.error(new Date().toISOString(), 'sync error', tenant, err && err.message);
  }
}

async function runOnce() {
  for (const t of TENANTS) await syncTenant(t);
}

(async () => {
  console.log('Starting continuous sync loop', { intervalSec: SYNC_INTERVAL_SEC, tenants: TENANTS, apiBase: API_BASE });
  await runOnce();
  setInterval(runOnce, SYNC_INTERVAL_SEC * 1000);
})();
