import http from 'http';
import fs from 'fs';
import url from 'url';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.eot':  'application/vnd.ms-fontobject',
};
let sqlite3;
try {
  sqlite3 = (await import('sqlite3')).default.verbose();
} catch {
  console.warn('sqlite3 not available - will use JSON database only');
  sqlite3 = null;
}

// Simple .env loader (no dotenv required)
// Ensure process.env exists for environments where process may not be global
if (typeof process === 'undefined') {
  var process = { env: {} };
  if (typeof global !== 'undefined') {
    global.process = process;
  } else if (typeof globalThis !== 'undefined') {
    globalThis.process = process;
  }
} else if (!process.env) {
  process.env = {};
}
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

const DB_PATH = './sync-db.json';
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || './fleet_erp_backend_sqlite.db';
// Maximum track range (hours) enforced server-side to avoid expensive queries
const MAX_TRACK_RANGE_HOURS = Number(process.env.MAX_TRACK_RANGE_HOURS || 48);

function clampTrackRange(fromIso, toIso) {
  const now = Date.now();
  const maxMs = (Number(MAX_TRACK_RANGE_HOURS) || 48) * 60 * 60 * 1000;
  const defaultTo = now;
  const defaultFrom = now - maxMs;

  let fromTs = (fromIso && !isNaN(Date.parse(fromIso))) ? Date.parse(fromIso) : defaultFrom;
  let toTs = (toIso && !isNaN(Date.parse(toIso))) ? Date.parse(toIso) : defaultTo;
  // ensure ordering
  if (fromTs > toTs) { const t = fromTs; fromTs = toTs; toTs = t; }
  // clamp to at most maxMs window by shifting start forward if needed
  if ((toTs - fromTs) > maxMs) {
    fromTs = toTs - maxMs;
  }
  return [new Date(fromTs).toISOString(), new Date(toTs).toISOString(), (toTs - fromTs)];
}
function readDb() {
  if (!fs.existsSync(DB_PATH)) return { vehiclesByTenant: {} };
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return { vehiclesByTenant: {} }; }
}
function writeDb(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8'); }

// Find stored tenant key with case-insensitive match (fallbacks to provided tenantId)
function resolveTenantKey(db, tenantId) {
  if (!tenantId) return null;
  if (db.vehiclesByTenant && db.vehiclesByTenant[tenantId]) return tenantId;
  // Try case-insensitive and punctuation-insensitive match so IDs like
  // CLIENT_001 and client1 map to the same tenant when possible.
  const normalize = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = normalize(tenantId);
  const keys = Object.keys(db.vehiclesByTenant || {});
  for (const k of keys) {
    if (normalize(k) === target) return k;
  }
  return tenantId;
}

// Prefer explicit PROVIDER_API_URL, fall back to legacy/API_LINK env var if present
const PROVIDER_API_URL = process.env.PROVIDER_API_URL || process.env.API_LINK || '';
const PROVIDER_API_KEY = process.env.PROVIDER_API_KEY || process.env.PROVIDER_API_KEY || '';

// Compute UI status string from GPS timestamp and speed (matches Flask api_server_minimal.py logic)
function computeStatus(lastUpdate, speed) {
  if (!lastUpdate) return 'OFFLINE';
  const parsed = Date.parse(lastUpdate);
  if (!Number.isFinite(parsed)) return 'OFFLINE';
  const ageMins = (Date.now() - parsed) / 60000;
  const spd = Number(speed) || 0;
  if (ageMins <= 30) return spd > 15 ? 'ACTIVE' : 'SLOW';
  if (ageMins <= 1440) return 'STOPPED';
  if (ageMins <= 2880) return 'ALERT_MUNSHI';
  if (ageMins <= 10080) return 'ALERT_ADMIN';
  return 'OFFLINE';
}

// Normalize a single provider vehicle record into UI-friendly shape
function normalizeItem(v) {
  const rawLat = v.lat || v.latitude || v.latitude_deg || null;
  const rawLng = v.lng || v.longitude || v.longitude_deg || null;
  const lat = rawLat == null ? null : Number(rawLat);
  const lng = rawLng == null ? null : Number(rawLng);
  const epoch = v.dttimeInEpoch || v.createdDate || v.timestamp ||
    (v._raw && (v._raw.dttimeInEpoch || v._raw.createdDate)) ||
    (v._raw && v._raw._raw && (v._raw._raw.dttimeInEpoch || v._raw._raw.createdDate)) ||
    null;
  // Prefer epoch when available and convert to ISO; otherwise prefer any existing ISO-like field
  let lastUpdate = null;
  if (epoch) {
    const e = Number(epoch);
    // provider sometimes supplies seconds; convert heuristically
    lastUpdate = new Date(e > 1e12 ? e : e * 1000).toISOString();
  } else if (v.lastUpdate) {
    const parsed = Date.parse(v.lastUpdate);
    lastUpdate = Number.isFinite(parsed) ? new Date(parsed).toISOString() : v.lastUpdate;
  } else if (v.createdDateReadable || (v._raw && v._raw.createdDateReadable) || (v._raw && v._raw._raw && v._raw._raw.createdDateReadable)) {
    // try to parse human readable string from possible nested fields to ISO, fallback to original
    const readable = v.createdDateReadable || (v._raw && v._raw.createdDateReadable) || (v._raw && v._raw._raw && v._raw._raw.createdDateReadable);
    const parsed = Date.parse(readable);
    lastUpdate = Number.isFinite(parsed) ? new Date(parsed).toISOString() : readable;
  } else if (v.dttime || (v._raw && v._raw.dttime) || (v._raw && v._raw._raw && v._raw._raw.dttime)) {
    const candidate = v.dttime || (v._raw && v._raw.dttime) || (v._raw && v._raw._raw && v._raw._raw.dttime);
    const parsed = Date.parse(candidate);
    lastUpdate = Number.isFinite(parsed) ? new Date(parsed).toISOString() : candidate;
  }

  return {
    id: v.id ?? v.rowid ?? v.vehicle_id ?? v.deviceNumber ?? v.device_number ?? v.vendorCode ?? v.vehicleNumber ?? null,
    number: v.number || v.vehicle_number || v.registration_number || v.vehicleNumber || v.vehicleNo || '',
    type: v.type || v.vehicle_type || v.vehicleType || '',
    driver: v.driver || v.driver_name || v.driverName || v.vendorName || v.venndorName || '',
    fuel: Number(v.fuel ?? v.fuel_level ?? v.fuelLevel ?? 0),
    status: computeStatus(lastUpdate, v.speed || (v._raw && v._raw.speed) || (v._raw && v._raw._raw && v._raw._raw.speed) || 0),
    lastUpdate,
    lat,
    lng,
    _raw: v,
  };
}

// Read vehicles from SQLite gps_current table (live data)
function getVehiclesFromSqlite(tenantId = null) {
  return new Promise((resolve) => {
    if (!sqlite3 || !fs.existsSync(SQLITE_DB_PATH)) {
      resolve([]);
      return;
    }
    
    try {
      const db = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY);
      db.configure('busyTimeout', 5000);
      let sql = 'SELECT vehicle_number, latitude, longitude, gps_time, client_id FROM gps_current';
      const params = [];
      
      if (tenantId) {
        sql += ' WHERE client_id = ?';
        params.push(tenantId);
      }
      
      sql += ' ORDER BY gps_time DESC LIMIT 1000';
      
      db.all(sql, params, (err, rows) => {
        db.close();
        
        if (err) {
          console.error('SQLite read error:', err);
          resolve([]);
          return;
        }
        
        // Normalize SQLite rows to vehicle objects
        const vehicles = (rows || []).map(row => {
          // Parse ISO date string
          let lastUpdate = row.gps_time;
          try {
            const parsed = Date.parse(row.gps_time);
            if (!isNaN(parsed)) {
              lastUpdate = new Date(parsed).toISOString();
            }
          } catch {
            // keep original gps_time
          }
          
          return {
            id: row.vehicle_number,
            number: row.vehicle_number,
            lat: Number(row.latitude) || null,
            lng: Number(row.longitude) || null,
            lastUpdate,
            status: computeStatus(lastUpdate, row.speed || 0),
            type: '',
            driver: '',
            fuel: 0,
            client_id: row.client_id,
            _raw: row,
          };
        });
        
        resolve(vehicles);
      });
    } catch (e) {
      console.error('SQLite connection error:', e);
      resolve([]);
    }
  });
}

function getTrackFromSqlite(vehicleId, tenantId = null) {
  return new Promise((resolve) => {
    if (!sqlite3 || !fs.existsSync(SQLITE_DB_PATH) || !vehicleId) {
      resolve([]);
      return;
    }

    try {
      const db = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY);
      db.configure('busyTimeout', 5000);
      let sql = 'SELECT latitude AS lat, longitude AS lng, gps_time AS ts FROM gps_current WHERE vehicle_number = ?';
      const params = [vehicleId];
      if (tenantId) {
        sql += ' AND client_id = ?';
        params.push(tenantId);
      }
      sql += ' ORDER BY ts DESC LIMIT 100';

      db.all(sql, params, (err, rows) => {
        db.close();
        if (err) {
          console.error('SQLite track read error:', err);
          resolve([]);
          return;
        }
        const out = (rows || [])
          .filter(r => r.lat != null && r.lng != null)
          .map(r => ({ lat: Number(r.lat), lng: Number(r.lng), ts: r.ts }));
        resolve(out);
      });
    } catch (e) {
      console.error('SQLite track connection error:', e);
      resolve([]);
    }
  });
}

// Server-Sent Events: keep a list of connected clients and broadcast updates
const sseClients = [];
// keep last snapshot per tenant to compute deltas
const sseSnapshots = {};

function computeDiffs(oldList, newList) {
  const oldMap = {};
  const newMap = {};
  (oldList || []).forEach(i => { if (i && i.id != null) oldMap[String(i.id)] = i; });
  (newList || []).forEach(i => { if (i && i.id != null) newMap[String(i.id)] = i; });

  const added = [];
  const updated = [];
  const removed = [];

  for (const id of Object.keys(newMap)) {
    if (!oldMap[id]) added.push(newMap[id]);
    else {
      // quick compare by lastUpdate and coords (avoid deep compare cost)
      const a = oldMap[id];
      const b = newMap[id];
      const changed = (a.lastUpdate !== b.lastUpdate) || (a.lat !== b.lat) || (a.lng !== b.lng) || JSON.stringify(a._raw || {}) !== JSON.stringify(b._raw || {});
      if (changed) updated.push(b);
    }
  }

  for (const id of Object.keys(oldMap)) {
    if (!newMap[id]) removed.push(id);
  }

  return { added, updated, removed };
}

function sendSse(tenantId, payload) {
  // payload is the new normalized list for tenant
  const prev = sseSnapshots[tenantId] || null;
  let msg;
  if (prev) {
    const diffs = computeDiffs(prev, payload);
    msg = { type: 'delta', tenantId, ...diffs };
  } else {
    msg = { type: 'full', tenantId, vehicles: payload };
  }
  // update snapshot
  sseSnapshots[tenantId] = payload;

  const data = JSON.stringify(msg);
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const c = sseClients[i];
    try {
      if (!tenantId || c.tenant === tenantId) {
        c.res.write(`data: ${data}\n\n`);
      }
    } catch (e) {
      // remove dead client
      sseClients.splice(i, 1);
    }
  }
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  // normalize pathname by stripping trailing slashes so routes match consistently
  const pathname = (parsed.pathname || '').replace(/\/+$/g, '') || '/';
  // enable simple CORS for local dashboard
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Tenant-ID');
  if (req.method === 'OPTIONS') return res.end();

  // Health check for Railway
  if (pathname === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: 'ok', ts: Date.now() }));
  }

  // Server-Sent Events subscription: clients can connect to receive live updates
  if (pathname === '/api/updates' && req.method === 'GET') {
    const tenantId = parsed.query.tenantId || req.headers['x-tenant-id'] || null;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('\n');
    const client = { tenant: tenantId, res };
    sseClients.push(client);
    req.on('close', () => {
      const idx = sseClients.indexOf(client);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
    return;
  }

  if (pathname === '/api/vehicles' && req.method === 'GET') {
    const tenantId = parsed.query.tenantId || req.headers['x-tenant-id'];
    
    // Try SQLite first (live data from sync worker)
    const sqliteVehicles = await getVehiclesFromSqlite(tenantId);
    
    if (sqliteVehicles && sqliteVehicles.length > 0) {
      // SQLite has data, return it
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(sqliteVehicles));
    }
    
    // Fallback to JSON database (for backward compatibility)
    const db = readDb();
    const resolvedKey = tenantId ? resolveTenantKey(db, tenantId) : null;
    let list = tenantId ? (db.vehiclesByTenant[resolvedKey] || []) : Object.values(db.vehiclesByTenant).flat();

    const normalizer = (raw) => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (raw.list && Array.isArray(raw.list)) return raw.list;
      if (raw.vehicles && Array.isArray(raw.vehicles)) return raw.vehicles;
      if (raw.data && Array.isArray(raw.data)) return raw.data;
      return [];
    };

    if (tenantId) {
      list = normalizer(list).map(normalizeItem);
    } else {
      list = Object.values(db.vehiclesByTenant).map(normalizer).flat().map(normalizeItem);
    }

    // If no data yet, try provider API
    if ((!list || list.length === 0) && PROVIDER_API_URL) {
      try {
        const sep = PROVIDER_API_URL.includes('?') ? '&' : '?';
        const fetchUrl = PROVIDER_API_URL + (PROVIDER_API_URL.includes('tenantId') ? '' : `${sep}tenantId=${encodeURIComponent(tenantId || '')}`);
        const fetchOpts = { headers: {} };
        if (PROVIDER_API_KEY) fetchOpts.headers['Authorization'] = `Bearer ${PROVIDER_API_KEY}`;
        const r = await fetch(fetchUrl, fetchOpts);
        if (r.ok) {
          const pdata = await r.json();
          function extractArray(obj) {
            if (!obj) return [];
            if (Array.isArray(obj)) return obj;
            if (Array.isArray(obj.list)) return obj.list;
            if (Array.isArray(obj.vehicles)) return obj.vehicles;
            if (Array.isArray(obj.data)) return obj.data;
            if (obj.data && Array.isArray(obj.data.list)) return obj.data.list;
            if (obj.data && Array.isArray(obj.data.vehicles)) return obj.data.vehicles;
            return [];
          }
          const rawList = extractArray(pdata);
          const normalize = v => {
            const rawLat = v.lat || v.latitude || v.latitude_deg || null;
            const rawLng = v.lng || v.longitude || v.longitude_deg || null;
            const lat = rawLat == null ? null : Number(rawLat);
            const lng = rawLng == null ? null : Number(rawLng);
            const epoch = v.dttimeInEpoch || v.createdDate || v.timestamp ||
              (v._raw && (v._raw.dttimeInEpoch || v._raw.createdDate)) ||
              (v._raw && v._raw._raw && (v._raw._raw.dttimeInEpoch || v._raw._raw.createdDate)) ||
              null;
            let lastUpdate = null;
            if (epoch) {
              const e = Number(epoch);
              lastUpdate = new Date(e > 1e12 ? e : e * 1000).toISOString();
            } else if (v.createdDateReadable || (v._raw && v._raw.createdDateReadable) || (v._raw && v._raw._raw && v._raw._raw.createdDateReadable)) {
              const readable = v.createdDateReadable || (v._raw && v._raw.createdDateReadable) || (v._raw && v._raw._raw && v._raw._raw.createdDateReadable);
              const parsed = Date.parse(readable);
              lastUpdate = Number.isFinite(parsed) ? new Date(parsed).toISOString() : readable;
            } else if (v.dttime || (v._raw && v._raw.dttime) || (v._raw && v._raw._raw && v._raw._raw.dttime)) {
              const candidate = v.dttime || (v._raw && v._raw.dttime) || (v._raw && v._raw._raw && v._raw._raw.dttime);
              const parsed = Date.parse(candidate);
              lastUpdate = Number.isFinite(parsed) ? new Date(parsed).toISOString() : candidate;
            }
            return {
              id: v.id ?? v.rowid ?? v.vehicle_id ?? v.deviceNumber ?? v.device_number ?? v.vendorCode ?? v.vehicleNumber ?? null,
              number: v.number || v.vehicle_number || v.registration_number || v.vehicleNumber || v.vehicleNo || '',
              type: v.type || v.vehicle_type || v.vehicleType || '',
              driver: v.driver || v.driver_name || v.driverName || v.vendorName || v.venndorName || '',
              fuel: Number(v.fuel ?? v.fuel_level ?? v.fuelLevel ?? 0),
              status: computeStatus(lastUpdate, v.speed || (v._raw && v._raw.speed) || 0),
              lastUpdate,
              lat,
              lng,
              _raw: v,
            };
          };
          list = rawList.map(normalize);
        }
      } catch {
        // ignore provider failures
      }
    }

    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(list));
  }

  // Proxy endpoint: try Streamlit on 8501 first, fallback to sync DB
  if (pathname === '/api/vehicles-proxy' && req.method === 'GET') {
    const tenantId = parsed.query.tenantId || req.headers['x-tenant-id'];
    // endpoints to try on the streamlit app
    const candidates = ['http://localhost:8501/api/vehicles', 'http://localhost:8501/vehicles', 'http://localhost:8501/'];
    for (const c of candidates) {
      try {
        const u = new URL(c);
        if (tenantId) {
          u.searchParams.set('tenantId', tenantId);
        }
        const r = await fetch(u.toString(), { headers: {} });
        if (!r.ok) throw new Error(`streamlit returned ${r.status}`);
        const data = await r.json();
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(data));
      } catch (e) {
        // try next
        // console.log('streamlit proxy try failed', c, e.message);
      }
    }

    // fallback: return from local DB same as /api/vehicles
    const db = readDb();
    const resolvedKey = tenantId ? resolveTenantKey(db, tenantId) : null;
    let list = tenantId ? (db.vehiclesByTenant[resolvedKey] || []) : Object.values(db.vehiclesByTenant).flat();
    const normalizer = (raw) => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (raw.list && Array.isArray(raw.list)) return raw.list;
      if (raw.vehicles && Array.isArray(raw.vehicles)) return raw.vehicles;
      if (raw.data && Array.isArray(raw.data)) return raw.data;
      return [];
    };
    if (tenantId) {
      list = normalizer(list).map(normalizeItem);
    } else {
      list = Object.values(db.vehiclesByTenant).map(normalizer).flat().map(normalizeItem);
    }
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(list));
  }

  // Fetch today's data directly from provider (do not store) and return normalized list.
  if (pathname === '/api/today' && req.method === 'GET') {
    if (!PROVIDER_API_URL) {
      res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'PROVIDER_API_URL not configured' }));
    }
    try {
      // forward query params to provider (tenantId, date, etc.)
      const forward = new URL(PROVIDER_API_URL);
      // copy parsed.query into forward.searchParams
      Object.keys(parsed.query || {}).forEach(k => {
        if (parsed.query[k] != null) forward.searchParams.set(k, parsed.query[k]);
      });
      // also include tenantId header fallback
      if (!forward.searchParams.has('tenantId') && req.headers['x-tenant-id']) {
        forward.searchParams.set('tenantId', req.headers['x-tenant-id']);
      }
      const fetchOpts = { headers: {} };
      if (PROVIDER_API_KEY) fetchOpts.headers['Authorization'] = `Bearer ${PROVIDER_API_KEY}`;
      const r = await fetch(forward.toString(), fetchOpts);
      if (!r.ok) throw new Error(`Provider returned ${r.status}`);
      const pdata = await r.json();
      function extractArray(obj) {
        if (!obj) return [];
        if (Array.isArray(obj)) return obj;
        if (Array.isArray(obj.list)) return obj.list;
        if (Array.isArray(obj.vehicles)) return obj.vehicles;
        if (Array.isArray(obj.data)) return obj.data;
        if (obj.data && Array.isArray(obj.data.list)) return obj.data.list;
        if (obj.data && Array.isArray(obj.data.vehicles)) return obj.data.vehicles;
        return [];
      }
      const rawList = extractArray(pdata);
      const normalize = v => {
        const rawLat = v.lat || v.latitude || v.latitude_deg || null;
        const rawLng = v.lng || v.longitude || v.longitude_deg || null;
        const lat = rawLat == null ? null : Number(rawLat);
        const lng = rawLng == null ? null : Number(rawLng);
        const epoch = v.dttimeInEpoch || v.createdDate || v.timestamp ||
          (v._raw && (v._raw.dttimeInEpoch || v._raw.createdDate)) ||
          (v._raw && v._raw._raw && (v._raw._raw.dttimeInEpoch || v._raw._raw.createdDate)) ||
          null;
        let lastUpdate = null;
        if (epoch) {
          const e = Number(epoch);
          lastUpdate = new Date(e > 1e12 ? e : e * 1000).toISOString();
        } else if (v.createdDateReadable || (v._raw && v._raw.createdDateReadable) || (v._raw && v._raw._raw && v._raw._raw.createdDateReadable)) {
          const readable = v.createdDateReadable || (v._raw && v._raw.createdDateReadable) || (v._raw && v._raw._raw && v._raw._raw.createdDateReadable);
          const parsed = Date.parse(readable);
          lastUpdate = Number.isFinite(parsed) ? new Date(parsed).toISOString() : readable;
        } else if (v.dttime || (v._raw && v._raw.dttime) || (v._raw && v._raw._raw && v._raw._raw.dttime)) {
          const candidate = v.dttime || (v._raw && v._raw.dttime) || (v._raw && v._raw._raw && v._raw._raw.dttime);
          const parsed = Date.parse(candidate);
          lastUpdate = Number.isFinite(parsed) ? new Date(parsed).toISOString() : candidate;
        }
        return {
          id: v.id ?? v.rowid ?? v.vehicle_id ?? v.deviceNumber ?? v.device_number ?? v.vendorCode ?? v.vehicleNumber ?? null,
          number: v.number || v.vehicle_number || v.registration_number || v.vehicleNumber || v.vehicleNo || '',
          type: v.type || v.vehicle_type || v.vehicleType || '',
          driver: v.driver || v.driver_name || v.driverName || v.vendorName || v.venndorName || '',
          fuel: Number(v.fuel ?? v.fuel_level ?? v.fuelLevel ?? 0),
          status: (v.status || v.current_status || 'available').toLowerCase(),
          lastUpdate,
          lat,
          lng,
          _raw: v,
        };
      };
      const normalized = rawList.map(normalize);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(normalized));
    } catch (err) {
      res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // Return vehicle track from local Streamlit sqlite DB if available.
  // Supports: GET /api/vehicles/:id/track and GET /api/track?vehicleId=...
  try {
    const pathParts = (pathname || '').split('/').filter(Boolean);

    // Support: GET /api/vehicles/:id and GET /api/vehicles/:id/manifest
    if (pathParts.length >= 3 && pathParts[0] === 'api' && pathParts[1] === 'vehicles' && req.method === 'GET') {
      const vehicleId = decodeURIComponent(pathParts[2]);
      const tenantId = parsed.query.tenantId || req.headers['x-tenant-id'] || null;
      const db = readDb();
      const resolvedKey = tenantId ? resolveTenantKey(db, tenantId) : null;
      let list = tenantId ? (db.vehiclesByTenant[resolvedKey] || []) : Object.values(db.vehiclesByTenant).flat();
      const normalizer = (raw) => {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (raw.list && Array.isArray(raw.list)) return raw.list;
        if (raw.vehicles && Array.isArray(raw.vehicles)) return raw.vehicles;
        if (raw.data && Array.isArray(raw.data)) return raw.data;
        return [];
      };
      const items = tenantId ? normalizer(list) : Object.values(db.vehiclesByTenant).map(normalizer).flat();
      const found = items.find(v => String(v.id) === String(vehicleId) || String(v.number) === String(vehicleId));
      res.setHeader('Content-Type', 'application/json');
      if (pathParts.length >= 4 && pathParts[3] === 'manifest') {
        if (found) return res.end(JSON.stringify(found));
        res.statusCode = 404; return res.end(JSON.stringify({ error: 'not found' }));
      }
      if (found) return res.end(JSON.stringify(found));
      res.statusCode = 404; return res.end(JSON.stringify({ error: 'not found' }));
    }
    if (pathParts.length >= 4 && pathParts[0] === 'api' && pathParts[1] === 'vehicles' && pathParts[3] === 'track' && req.method === 'GET') {
      const vehicleId = decodeURIComponent(pathParts[2]);
      const from = parsed.query.from || parsed.query.start || null;
      const to = parsed.query.to || parsed.query.end || null;
      const tenantId = parsed.query.tenantId || req.headers['x-tenant-id'] || null;
      // call Python helper to query sqlite DB (streamlit app DB)
      const { spawnSync } = require('child_process');
      const py = process.env.PYTHON || 'python';
      const script = './tools/query_track.py';
      // apply server-side clamping for range (safe guard)
      const [clampedFrom, clampedTo] = clampTrackRange(from || null, to || null);
      if ((from || '') && clampedFrom !== (from || '')) console.log('Clamped from:', from, '->', clampedFrom);
      if ((to || '') && clampedTo !== (to || '')) console.log('Clamped to:', to, '->', clampedTo);
      const args = [script, SQLITE_DB_PATH, vehicleId, clampedFrom, clampedTo, tenantId || ''];
      const out = spawnSync(py, args, { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
      const stdout = (out.stdout || '').trim();
      if (out.status === 0 && stdout && stdout !== '[]') {
        res.setHeader('Content-Type', 'application/json');
        return res.end(stdout);
      }
      if (sqlite3) {
        return getTrackFromSqlite(vehicleId, tenantId).then(rows => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(rows));
        });
      }
      console.error('query_track spawn failed', { status: out.status, stderr: out.stderr, stdout: out.stdout });
      try { fs.appendFileSync('query_track-debug.log', JSON.stringify({ ts: new Date().toISOString(), args, status: out.status, stderr: out.stderr, stdout: out.stdout }) + '\n'); } catch { }
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify([]));
    }

    if (pathname === '/api/track' && req.method === 'GET') {
      const vehicleId = parsed.query.vehicleId || parsed.query.vehicle_id || parsed.query.id || null;
      const from = parsed.query.from || parsed.query.start || null;
      const to = parsed.query.to || parsed.query.end || null;
      const tenantId = parsed.query.tenantId || req.headers['x-tenant-id'] || null;
      const { spawnSync } = require('child_process');
      const py = process.env.PYTHON || 'python';
      const script = './tools/query_track.py';
      // apply server-side clamping for range (safe guard)
      const [clampedFrom2, clampedTo2] = clampTrackRange(from || null, to || null);
      if ((from || '') && clampedFrom2 !== (from || '')) console.log('Clamped from:', from, '->', clampedFrom2);
      if ((to || '') && clampedTo2 !== (to || '')) console.log('Clamped to:', to, '->', clampedTo2);
      const args = [script, SQLITE_DB_PATH, vehicleId || '', clampedFrom2, clampedTo2, tenantId || ''];
      const out = spawnSync(py, args, { encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
      const stdout = (out.stdout || '').trim();
      if (out.status === 0 && stdout && stdout !== '[]') {
        res.setHeader('Content-Type', 'application/json');
        return res.end(stdout);
      }
      if (sqlite3) {
        return getTrackFromSqlite(vehicleId, tenantId).then(rows => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(rows));
        });
      }
      console.error('query_track spawn failed', { status: out.status, stderr: out.stderr, stdout: out.stdout });
      try { const fs = require('fs'); fs.appendFileSync('query_track-debug.log', JSON.stringify({ ts: new Date().toISOString(), args, status: out.status, stderr: out.stderr, stdout: out.stdout }) + '\n'); } catch (e) { }
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify([]));
    }
  } catch (e) {
    // ignore and continue to other handlers
  }

  if (pathname === '/api/sync' && (req.method === 'POST' || req.method === 'GET')) {
    const tenantId = parsed.query.tenantId || req.headers['x-tenant-id'];
    if (!tenantId) {
      res.statusCode = 400; res.end(JSON.stringify({ error: 'tenantId required' })); return;
    }
    if (!PROVIDER_API_URL) {
      res.statusCode = 500; res.end(JSON.stringify({ error: 'PROVIDER_API_URL not configured in .env' })); return;
    }

    try {
      console.log('[Sync] Starting sync for tenantId:', tenantId);
      // build provider URL (append tenantId as query if not present)
      const sep = PROVIDER_API_URL.includes('?') ? '&' : '?';
      const fetchUrl = PROVIDER_API_URL + (PROVIDER_API_URL.includes('tenantId') ? '' : `${sep}tenantId=${encodeURIComponent(tenantId)}`);
      const fetchOpts = { headers: {} };
      if (PROVIDER_API_KEY) fetchOpts.headers['Authorization'] = `Bearer ${PROVIDER_API_KEY}`;
      // use global fetch (Node 18+)
      console.log('[Sync] Fetching from provider:', fetchUrl);
      const r = await fetch(fetchUrl, fetchOpts);
      if (!r.ok) throw new Error(`Provider returned ${r.status}`);
      const data = await r.json();
      // robustly extract an array of items from provider response
      function extractArray(obj) {
        if (!obj) return [];
        if (Array.isArray(obj)) return obj;
        if (Array.isArray(obj.list)) return obj.list;
        if (Array.isArray(obj.vehicles)) return obj.vehicles;
        if (Array.isArray(obj.data)) return obj.data;
        // handle nested wrapper: { data: { list: [...] } }
        if (obj.data && Array.isArray(obj.data.list)) return obj.data.list;
        if (obj.data && Array.isArray(obj.data.vehicles)) return obj.data.vehicles;
        if (obj.data && Array.isArray(obj.data.data)) return obj.data.data;
        // handle map-like structures by taking object values
        if (obj.list && typeof obj.list === 'object') {
          const vals = Object.values(obj.list);
          if (vals.length && typeof vals[0] === 'object') return vals;
        }
        if (obj.data && typeof obj.data === 'object') {
          const vals = Object.values(obj.data);
          if (vals.length && typeof vals[0] === 'object') return vals;
        }
        return [];
      }

      const rawList = extractArray(data);
      console.log('Provider fetch', fetchUrl, 'received keys', Object.keys(data || {}), '-> extracted', rawList.length, 'items');

      const normalize = v => {
        const rawLat = v.lat || v.latitude || v.latitude_deg || null;
        const rawLng = v.lng || v.longitude || v.longitude_deg || null;
        const lat = rawLat == null ? null : Number(rawLat);
        const lng = rawLng == null ? null : Number(rawLng);
        const epoch = v.dttimeInEpoch || v.createdDate || v.timestamp || null;
        let lastUpdate = null;
        if (epoch) {
          const e = Number(epoch);
          lastUpdate = new Date(e > 1e12 ? e : e * 1000).toISOString();
        } else if (v.createdDateReadable) {
          const parsed = Date.parse(v.createdDateReadable);
          lastUpdate = Number.isFinite(parsed) ? new Date(parsed).toISOString() : v.createdDateReadable;
        } else if (v.dttime) {
          const parsed = Date.parse(v.dttime);
          lastUpdate = Number.isFinite(parsed) ? new Date(parsed).toISOString() : v.dttime;
        }

        return {
          // UI expects `id`, `number`, `type`, `driver`, `fuel`, `status`, `lastUpdate`, `lat`, `lng`
          id: v.id ?? v.rowid ?? v.vehicle_id ?? v.deviceNumber ?? v.device_number ?? v.vendorCode ?? v.vehicleNumber ?? null,
          number: v.number || v.vehicle_number || v.registration_number || v.vehicleNumber || v.vehicleNo || '',
          type: v.type || v.vehicle_type || v.vehicleType || '',
          driver: v.driver || v.driver_name || v.driverName || v.vendorName || v.venndorName || '',
          fuel: Number(v.fuel ?? v.fuel_level ?? v.fuelLevel ?? 0),
          status: (v.status || v.current_status || 'available').toLowerCase(),
          lastUpdate,
          lat,
          lng,
          // keep original provider payload handy for diagnostics
          _raw: v,
        };
      };

      const normalized = rawList.map(normalize);

      // store under tenantId key
      const db = readDb();
      db.vehiclesByTenant = db.vehiclesByTenant || {};
      db.vehiclesByTenant[tenantId] = normalized;
      writeDb(db);
      
      // Also persist to SQLite database for track history
      try {
        const { spawnSync } = require('child_process');
        const py = process.env.PYTHON || 'python';
        const dbPath = './fleet_erp_backend_sqlite.db';
        const jsonData = JSON.stringify(normalized);
        const args = ['tools/insert_gps_data.py', dbPath, jsonData, tenantId];
        console.log('[Sync] Inserting', normalized.length, 'records into SQLite for', tenantId);
        const out = spawnSync(py, args, { encoding: 'utf8', windowsHide: true, timeout: 30000 });
        if (out.status === 0 && out.stdout) {
          try {
            const result = JSON.parse(out.stdout);
            console.log('[Sync] SQLite insert result:', result);
            if (result.error) {
              console.error('[Sync] SQLite insert error:', result.error);
            }
          } catch (e) {
            console.error('[Sync] Failed to parse insert result:', out.stdout);
          }
        } else {
          console.error('[Sync] SQLite insert failed. Status:', out.status, 'stderr:', out.stderr);
        }
      } catch (insertErr) {
        console.error('[Sync] Exception during SQLite insert:', insertErr.message);
      }
      
      // broadcast normalized update to SSE clients subscribed to this tenant
      try { sendSse(tenantId, normalized); } catch (e) { /* ignore */ }
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, stored: db.vehiclesByTenant[tenantId].length }));
    } catch (err) {
      console.error('[Sync] Error:', err.message);
      res.statusCode = 500; res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // ── SQLite-backed routes ────────────────────────────────────────────────────
  function sqliteJson(res, sql, params, transform) {
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.all(sql, params, (err, rows) => {
      db2.close();
      if (err) { res.statusCode = 500; return res.end(JSON.stringify({ error: err.message })); }
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(transform ? transform(rows) : rows));
    });
  }

  async function readBody(req) {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
    });
  }

  // GET /api/pois
  if (pathname === '/api/pois' && req.method === 'GET') {
    const clientId = parsed.query.clientId || parsed.query.client_id || 'CLIENT_001';
    return sqliteJson(res, 'SELECT * FROM pois WHERE client_id=? ORDER BY poi_name', [clientId], null);
  }

  // POST /api/pois
  if (pathname === '/api/pois' && req.method === 'POST') {
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run(
      'INSERT INTO pois (client_id,poi_name,latitude,longitude,city,address,radius_meters,type) VALUES (?,?,?,?,?,?,?,?)',
      [body.clientId||'CLIENT_001', body.poi_name, body.latitude, body.longitude, body.city||'', body.address||'', body.radius_meters||500, body.type||'primary'],
      function(err) {
        db2.close();
        if (err) { res.statusCode = 500; return res.end(JSON.stringify({ error: err.message })); }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, poi_id: this.lastID, poi_name: body.poi_name, latitude: body.latitude, longitude: body.longitude, city: body.city||'' }));
      }
    );
    return;
  }

  // PUT /api/pois/:id
  if (/^\/api\/pois\/\d+$/.test(pathname) && req.method === 'PUT') {
    const poiId = pathname.split('/').pop();
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('UPDATE pois SET poi_name=?,latitude=?,longitude=?,city=?,address=?,radius_meters=?,type=? WHERE id=?',
      [body.poi_name, body.latitude, body.longitude, body.city||'', body.address||'', body.radius_meters||500, body.type||'primary', poiId],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // DELETE /api/pois/:id
  if (/^\/api\/pois\/\d+$/.test(pathname) && req.method === 'DELETE') {
    const poiId = pathname.split('/').pop();
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('DELETE FROM pois WHERE id=?', [poiId], function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // GET /api/vehicles-master
  if (pathname === '/api/vehicles-master' && req.method === 'GET') {
    const clientId = parsed.query.clientId || parsed.query.client_id || 'CLIENT_001';
    return sqliteJson(res,
      'SELECT * FROM vehicles WHERE client_id=? ORDER BY vehicle_no',
      [clientId],
      rows => rows.map(r => ({ ...r, number: r.vehicle_no, vehicle_reg_no: r.vehicle_no }))
    );
  }

  // GET /api/vehicles-master/dropdown
  if (pathname === '/api/vehicles-master/dropdown' && req.method === 'GET') {
    const clientId = parsed.query.clientId || parsed.query.client_id || 'CLIENT_001';
    return sqliteJson(res, 'SELECT id, vehicle_no, vehicle_size as type FROM vehicles WHERE client_id=? ORDER BY vehicle_no', [clientId], null);
  }

  // POST /api/vehicles-master
  if (pathname === '/api/vehicles-master' && req.method === 'POST') {
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('INSERT OR REPLACE INTO vehicles (vehicle_no, client_id, driver_name, vehicle_size) VALUES (?,?,?,?)',
      [body.vehicle_no || body.vehicle_reg_no, body.client_id||'CLIENT_001', body.driver_name||'', body.type||body.vehicle_size||''],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true, id: this.lastID })); });
    return;
  }

  // PUT /api/vehicles-master/:id
  if (/^\/api\/vehicles-master\/[^/]+$/.test(pathname) && req.method === 'PUT') {
    const vId = decodeURIComponent(pathname.split('/').pop());
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('UPDATE vehicles SET driver_name=?, vehicle_size=?, driver_id=?, munshi_id=? WHERE vehicle_no=? OR id=?',
      [body.driver_name||'', body.type||body.vehicle_size||'', body.driver_id||null, body.munshi_id||null, vId, vId],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // DELETE /api/vehicles-master/:id
  if (/^\/api\/vehicles-master\/[^/]+$/.test(pathname) && req.method === 'DELETE') {
    const vId = decodeURIComponent(pathname.split('/').pop());
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('DELETE FROM vehicles WHERE vehicle_no=? OR id=?', [vId, vId],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // GET /api/drivers
  if (pathname === '/api/drivers' && req.method === 'GET') {
    const clientId = parsed.query.clientId || parsed.query.client_id || 'CLIENT_001';
    return sqliteJson(res, 'SELECT * FROM drivers WHERE client_id=? ORDER BY name', [clientId], null);
  }

  // POST /api/drivers
  if (pathname === '/api/drivers' && req.method === 'POST') {
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('INSERT INTO drivers (name, phone, client_id) VALUES (?,?,?)',
      [body.driver_name||body.name||'', body.phone||'', body.client_id||'CLIENT_001'],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true, id: this.lastID })); });
    return;
  }

  // DELETE /api/drivers/:id
  if (/^\/api\/drivers\/\d+$/.test(pathname) && req.method === 'DELETE') {
    const dId = pathname.split('/').pop();
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('DELETE FROM drivers WHERE id=?', [dId], function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // GET /api/munshis
  if (pathname === '/api/munshis' && req.method === 'GET') {
    const clientId = parsed.query.clientId || parsed.query.client_id || 'CLIENT_001';
    return sqliteJson(res, 'SELECT * FROM munshis WHERE client_id=? ORDER BY name', [clientId], null);
  }

  // POST /api/munshis
  if (pathname === '/api/munshis' && req.method === 'POST') {
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('INSERT INTO munshis (name, phone, client_id) VALUES (?,?,?)',
      [body.name||'', body.phone||'', body.client_id||'CLIENT_001'],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true, id: this.lastID })); });
    return;
  }

  // GET /api/fuel-type-rates
  if (pathname === '/api/fuel-type-rates' && req.method === 'GET') {
    const clientId = parsed.query.clientId || parsed.query.client_id || 'CLIENT_001';
    return sqliteJson(res, 'SELECT * FROM fuel_type_rates WHERE client_id=?', [clientId], null);
  }

  // GET /api/poi-unloading-rates
  if (pathname === '/api/poi-unloading-rates' && req.method === 'GET') {
    const clientId = parsed.query.clientId || parsed.query.client_id || 'CLIENT_001';
    return sqliteJson(res, 'SELECT * FROM poi_unloading_rates_v2 WHERE client_id=? ORDER BY poi_id', [clientId], null);
  }

  // POST /api/poi-unloading-rates (bulk upsert)
  if (pathname === '/api/poi-unloading-rates' && req.method === 'POST') {
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const rows = Array.isArray(body) ? body : (body.rates || []);
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    let done = 0;
    if (!rows.length) { db2.close(); res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({ success: true, updated: 0 })); }
    rows.forEach(row => {
      db2.run(`INSERT INTO poi_unloading_rates_v2 (client_id,poi_id,category_1_32ft_34ft,category_2_22ft_24ft,category_3_small,notes,updated_at)
               VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
               ON CONFLICT(client_id,poi_id) DO UPDATE SET category_1_32ft_34ft=excluded.category_1_32ft_34ft, category_2_22ft_24ft=excluded.category_2_22ft_24ft, category_3_small=excluded.category_3_small, notes=excluded.notes, updated_at=CURRENT_TIMESTAMP`,
        [row.client_id||'CLIENT_001', row.poi_id, row.category_1_32ft_34ft||0, row.category_2_22ft_24ft||0, row.category_3_small||0, row.notes||''],
        () => { if (++done === rows.length) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ success: true, updated: done })); } }
      );
    });
    return;
  }

  // GET /api/ewaybills
  if (pathname === '/api/ewaybills' && req.method === 'GET') {
    const clientId = parsed.query.clientId || parsed.query.client_id || 'CLIENT_001';
    const status = parsed.query.status || '';
    const sql = status
      ? 'SELECT * FROM eway_bills_master WHERE client_id=? AND status=? ORDER BY imported_at DESC'
      : 'SELECT * FROM eway_bills_master WHERE client_id=? ORDER BY imported_at DESC';
    const params = status ? [clientId, status] : [clientId];
    return sqliteJson(res, sql, params, rows => ({ ewaybills: rows }));
  }

  // POST /api/ewaybills
  if (pathname === '/api/ewaybills' && req.method === 'POST') {
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run(`INSERT INTO eway_bills_master (client_id,vehicle_no,ewb_no,total_value,from_place,to_place,doc_date,status,notes,transport_mode,distance_km)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [body.client_id||'CLIENT_001', body.vehicle_number||body.vehicle_no||'', body.ewb_number||body.ewb_no||'', body.consignment_value||body.total_value||0, body.from_location||body.from_place||'', body.to_location||body.to_place||'', body.issue_date||body.doc_date||'', 'active', body.notes||'', body.transport_mode||'Road', body.distance_km||0],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true, id: this.lastID })); });
    return;
  }

  // PUT /api/ewaybills/:id/extend
  if (/^\/api\/ewaybills\/[^/]+\/extend$/.test(pathname) && req.method === 'PUT') {
    const ewbId = pathname.split('/')[3];
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run("UPDATE eway_bills_master SET validity_days=validity_days+1, updated_at=CURRENT_TIMESTAMP WHERE id=? OR ewb_number=?", [ewbId, ewbId],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // PUT /api/ewaybills/:id/update-part-b
  if (/^\/api\/ewaybills\/[^/]+\/update-part-b$/.test(pathname) && req.method === 'PUT') {
    const ewbId = pathname.split('/')[3];
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run("UPDATE eway_bills_master SET vehicle_no=? WHERE id=? OR ewb_no=?",
      [body.new_vehicle_number||'', ewbId, ewbId],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // GET /api/ewaybills/:id/vehicle-history
  if (/^\/api\/ewaybills\/[^/]+\/vehicle-history$/.test(pathname) && req.method === 'GET') {
    const ewbId = pathname.split('/')[3];
    return sqliteJson(res, 'SELECT * FROM ewb_vehicle_changes WHERE ewb_id=? OR ewb_number=? ORDER BY changed_at DESC', [ewbId, ewbId], null);
  }

  // GET /api/standard-routes
  if (pathname === '/api/standard-routes' && req.method === 'GET') {
    const clientId = parsed.query.clientId || parsed.query.client_id || 'CLIENT_001';
    return sqliteJson(res, 'SELECT * FROM standard_routes WHERE client_id=? ORDER BY route_name', [clientId], null);
  }

  // POST /api/standard-routes
  if (pathname === '/api/standard-routes' && req.method === 'POST') {
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('INSERT INTO standard_routes (client_id,route_name,from_location,to_location,route_km,notes) VALUES (?,?,?,?,?,?)',
      [body.client_id||'CLIENT_001', body.route_name||'', body.from_location||body.from_poi_id||'', body.to_location||body.to_poi_id||'', body.distance_km||body.route_km||0, body.notes||''],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true, id: this.lastID })); });
    return;
  }

  // DELETE /api/standard-routes/:id
  if (/^\/api\/standard-routes\/\d+$/.test(pathname) && req.method === 'DELETE') {
    const rId = pathname.split('/').pop();
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('DELETE FROM standard_routes WHERE id=?', [rId], function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // GET /api/standard-routes/:id/live-vehicles
  if (/^\/api\/standard-routes\/\d+\/live-vehicles$/.test(pathname) && req.method === 'GET') {
    const rId = pathname.split('/')[3];
    return sqliteJson(res, `SELECT g.vehicle_number, g.latitude, g.longitude, g.gps_time, g.client_id FROM gps_current g
      INNER JOIN vehicles v ON v.vehicle_no=g.vehicle_number WHERE v.standard_route_no=?`, [rId], null);
  }

  // GET /api/trip-dispatches
  if (pathname === '/api/trip-dispatches' && req.method === 'GET') {
    const clientId = parsed.query.clientId || parsed.query.client_id || 'CLIENT_001';
    const munshiId = parsed.query.munshiId || '';
    const sql = munshiId
      ? 'SELECT * FROM route_job_cards WHERE client_id=? AND munshi_id=? ORDER BY created_at DESC'
      : 'SELECT * FROM route_job_cards WHERE client_id=? ORDER BY created_at DESC';
    const params = munshiId ? [clientId, munshiId] : [clientId];
    return sqliteJson(res, sql, params, rows => ({ trips: rows }));
  }

  // POST /api/trip-dispatches
  if (pathname === '/api/trip-dispatches' && req.method === 'POST') {
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const jcNum = body.job_card_number || ('JC-' + Date.now());
    db2.run(`INSERT INTO route_job_cards
      (client_id,route_id,vehicle_number,driver_name,job_card_date,job_card_number,status,munshi_id,munshi_name,notes,trip_type,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      [body.client_id||'CLIENT_001', body.route_id||null, body.vehicle_number||'', body.driver_name||'', body.job_card_date||new Date().toISOString().split('T')[0], jcNum, body.status||'started', body.munshi_id||null, body.munshi_name||'', body.notes||'', body.trip_type||'regular'],
      function(err) {
        if (err) { db2.close(); return res.end(JSON.stringify({ error: err.message })); }
        const newId = this.lastID;
        // Insert stops if provided
        const stops = body.stops || [];
        if (!stops.length) { db2.close(); res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({ success: true, id: newId, job_card_number: jcNum })); }
        let done = 0;
        stops.forEach((s, i) => {
          db2.run('INSERT INTO trip_dispatch_stops (job_card_number,poi_id,poi_name,poi_lat,poi_lon,poi_radius,sequence_order,stop_type,stop_status) VALUES (?,?,?,?,?,?,?,?,?)',
            [jcNum, s.poi_id||null, s.poi_name||'', s.poi_lat||0, s.poi_lon||0, s.poi_radius||500, i+1, s.stop_type||'delivery', 'pending'],
            () => { if (++done === stops.length) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ success: true, id: newId, job_card_number: jcNum })); } });
        });
      });
    return;
  }

  // GET /api/trip-dispatches/:jc/stops
  if (/^\/api\/trip-dispatches\/[^/]+\/stops$/.test(pathname) && req.method === 'GET') {
    const jc = decodeURIComponent(pathname.split('/')[3]);
    return sqliteJson(res, 'SELECT * FROM trip_dispatch_stops WHERE job_card_number=? ORDER BY sequence_order', [jc], rows => ({ stops: rows }));
  }

  // PUT /api/trip-dispatches/:jc/extend
  if (/^\/api\/trip-dispatches\/[^/]+\/extend$/.test(pathname) && req.method === 'PUT') {
    const jc = decodeURIComponent(pathname.split('/')[3]);
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('UPDATE route_job_cards SET notes=?, updated_at=CURRENT_TIMESTAMP WHERE job_card_number=?',
      [(body.notes||''), jc], function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // PUT /api/trip-dispatches/:jc/patch
  if (/^\/api\/trip-dispatches\/[^/]+\/patch$/.test(pathname) && req.method === 'PUT') {
    const jc = decodeURIComponent(pathname.split('/')[3]);
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const sets = []; const vals = [];
    if (body.vehicle_number !== undefined) { sets.push('vehicle_number=?'); vals.push(body.vehicle_number); }
    if (body.driver_name    !== undefined) { sets.push('driver_name=?');    vals.push(body.driver_name); }
    if (body.notes          !== undefined) { sets.push('notes=?');          vals.push(body.notes); }
    if (body.munshi_id      !== undefined) { sets.push('munshi_id=?');      vals.push(body.munshi_id); }
    sets.push('updated_at=CURRENT_TIMESTAMP'); vals.push(jc);
    db2.run(`UPDATE route_job_cards SET ${sets.join(',')} WHERE job_card_number=?`, vals,
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // PUT /api/trip-dispatches/:jc/status
  if (/^\/api\/trip-dispatches\/[^/]+\/status$/.test(pathname) && req.method === 'PUT') {
    const jc = decodeURIComponent(pathname.split('/')[3]);
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('UPDATE route_job_cards SET status=?, updated_at=CURRENT_TIMESTAMP WHERE job_card_number=?',
      [body.status||'started', jc], function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // DELETE /api/trip-dispatches/:jc
  if (/^\/api\/trip-dispatches\/[^/]+$/.test(pathname) && req.method === 'DELETE') {
    const jc = decodeURIComponent(pathname.split('/')[3]);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('DELETE FROM trip_dispatch_stops WHERE job_card_number=?', [jc], () => {
      db2.run('DELETE FROM route_job_cards WHERE job_card_number=?', [jc],
        function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    });
    return;
  }

  // POST /api/munshis/login
  if (pathname === '/api/munshis/login' && req.method === 'POST') {
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.get('SELECT id, name, phone, area, pin FROM munshis WHERE pin=? AND client_id=?',
      [body.pin||'', body.client_id||'CLIENT_001'],
      (err, row) => { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err||!row ? { error: 'Invalid PIN' } : { success: true, munshi: row })); });
    return;
  }

  // DELETE /api/munshis/:id
  if (/^\/api\/munshis\/\d+$/.test(pathname) && req.method === 'DELETE') {
    const mId = pathname.split('/').pop();
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('DELETE FROM munshis WHERE id=?', [mId], function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // PUT /api/munshis/:id
  if (/^\/api\/munshis\/\d+$/.test(pathname) && req.method === 'PUT') {
    const mId = pathname.split('/').pop();
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('UPDATE munshis SET name=?,phone=?,area=?,region=?,pin=?,monthly_salary=?,approval_limit=? WHERE id=?',
      [body.name||'', body.phone||'', body.area||'', body.region||'', body.pin||'', body.monthly_salary||0, body.approval_limit||0, mId],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // POST /api/munshis (add)
  if (pathname === '/api/munshis' && req.method === 'POST') {
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('INSERT INTO munshis (name, phone, area, region, pin, client_id, monthly_salary, approval_limit) VALUES (?,?,?,?,?,?,?,?)',
      [body.name||'', body.phone||'', body.area||'', body.region||'', body.pin||'', body.client_id||'CLIENT_001', body.monthly_salary||0, body.approval_limit||0],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true, id: this.lastID })); });
    return;
  }

  // PUT /api/vehicles-master/:id/munshi
  if (/^\/api\/vehicles-master\/[^/]+\/munshi$/.test(pathname) && (req.method === 'PUT' || req.method === 'POST')) {
    const vId = decodeURIComponent(pathname.split('/')[3]);
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('UPDATE vehicles SET munshi_id=?, munshi_name=? WHERE vehicle_no=? OR id=?',
      [body.munshi_id||null, body.munshi_name||'', vId, vId],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // POST /api/vehicles-master/:id/default-pois
  if (/^\/api\/vehicles-master\/[^/]+\/default-pois$/.test(pathname) && req.method === 'POST') {
    const vId = decodeURIComponent(pathname.split('/')[3]);
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('UPDATE vehicles SET primary_poi_ids=? WHERE vehicle_no=? OR id=?',
      [JSON.stringify(body.poi_ids||[]), vId, vId],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // POST /api/pois/create (alias for POST /api/pois)
  if (pathname === '/api/pois/create' && req.method === 'POST') {
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('INSERT INTO pois (client_id,poi_name,latitude,longitude,city,address,radius_meters,type) VALUES (?,?,?,?,?,?,?,?)',
      [body.clientId||body.client_id||'CLIENT_001', body.poi_name||body.name||'', body.latitude, body.longitude, body.city||'', body.address||'', body.radius_meters||500, body.type||'primary'],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true, poi_id: this.lastID })); });
    return;
  }

  // GET /api/gps-data-range
  if (pathname === '/api/gps-data-range' && req.method === 'GET') {
    const vehicleId = parsed.query.vehicleId || '';
    const clientId = parsed.query.clientId || 'CLIENT_001';
    return sqliteJson(res, 'SELECT MIN(gps_time) as min_time, MAX(gps_time) as max_time FROM gps_live_data WHERE vehicle_number=? AND client_id=?', [vehicleId, clientId],
      rows => ({ min: rows[0]?.min_time, max: rows[0]?.max_time }));
  }

  // GET /api/vehicle-track
  if (pathname === '/api/vehicle-track' && req.method === 'GET') {
    const vehicleId = parsed.query.vehicleId || '';
    const clientId = parsed.query.clientId || 'CLIENT_001';
    const startTime = parsed.query.startTime || '';
    const endTime = parsed.query.endTime || '';
    return sqliteJson(res,
      'SELECT latitude, longitude, gps_time, speed FROM gps_live_data WHERE vehicle_number=? AND client_id=? AND gps_time>=? AND gps_time<=? ORDER BY gps_time',
      [vehicleId, clientId, startTime, endTime], null);
  }

  // GET /api/eway-bills-hub/vehicle-movement
  if (pathname === '/api/eway-bills-hub/vehicle-movement' && req.method === 'GET') {
    return sqliteJson(res, `SELECT e.vehicle_no, e.ewb_no, e.from_place, e.to_place, e.status, g.latitude, g.longitude, g.gps_time
      FROM eway_bills_master e LEFT JOIN gps_current g ON g.vehicle_number=e.vehicle_no
      WHERE e.client_id='CLIENT_001' AND e.status='active' ORDER BY e.imported_at DESC LIMIT 100`, [], null);
  }

  // POST /api/fuel-type-rates/:type
  if (/^\/api\/fuel-type-rates\/[^/]+$/.test(pathname) && req.method === 'POST') {
    const fuelType = decodeURIComponent(pathname.split('/').pop());
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run(`INSERT INTO fuel_type_rates (client_id, fuel_type, cost_per_liter, updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(client_id, fuel_type) DO UPDATE SET cost_per_liter=excluded.cost_per_liter, updated_at=CURRENT_TIMESTAMP`,
      [body.client_id||'CLIENT_001', fuelType, body.rate_per_liter||body.cost_per_liter||0],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // POST /api/ledger/driver/:id/salary
  if (/^\/api\/ledger\/driver\/\d+\/salary$/.test(pathname) && req.method === 'POST') {
    const dId = pathname.split('/')[4];
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('INSERT INTO driver_ledger (driver_id, driver_name, trip_date, settlement, notes, settlement_status) VALUES (?,?,?,?,?,?)',
      [dId, body.driver_name||'', body.entry_date||new Date().toISOString().split('T')[0], body.amount||0, body.notes||'', body.entry_type||'salary'],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true, id: this.lastID })); });
    return;
  }

  // GET /api/fuel-prices/fetch (placeholder — returns cached DB rates)
  if (pathname === '/api/fuel-prices/fetch' && req.method === 'GET') {
    const state = parsed.query.state || '';
    return sqliteJson(res, 'SELECT * FROM fuel_rates WHERE state=? ORDER BY updated_at DESC LIMIT 10', [state], null);
  }

  // Static file serving for production build (Vite dist/)
  if (req.method === 'GET' && !pathname.startsWith('/api/')) {
    const distDir = path.join(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      // Try exact file first
      let filePath = path.join(distDir, pathname === '/' ? 'index.html' : pathname);
      // Prevent path traversal
      if (!filePath.startsWith(distDir)) {
        res.statusCode = 403; return res.end('Forbidden');
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        // SPA fallback — serve index.html for all non-file routes
        filePath = path.join(distDir, 'index.html');
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      // Cache static assets (hashed filenames) aggressively, HTML never
      if (ext === '.html') {
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      return res.end(fs.readFileSync(filePath));
    }
  }

  // fallback
  res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sync server listening on http://localhost:${PORT}`);
});
