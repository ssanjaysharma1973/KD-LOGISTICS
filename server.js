import http from 'http';
import fs from 'fs';
import url from 'url';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
console.log('[SERVER-STARTUP] version=v3-deploy-test build=' + new Date().toISOString());


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

// Try require first (faster, works with both nixpacks and Dockerfile), then dynamic import
let sqlite3;
try {
  const _require = createRequire(import.meta.url);
  sqlite3 = _require('sqlite3').verbose();
  console.log('[sqlite3] loaded via require OK');
} catch (e1) {
  try {
    sqlite3 = (await import('sqlite3')).default.verbose();
    console.log('[sqlite3] loaded via dynamic import OK');
  } catch (e2) {
    console.warn('[sqlite3] unavailable:', e2.message);
    sqlite3 = null;
  }
}

// Simple .env loader (no dotenv required)
if (!process.env) process.env = {};
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
const SEED_PATH = path.join(__dirname, 'seed_data.json');

// ── SQLite seed initializer ───────────────────────────────────────────────
// On Railway the DB file is never in git (*.db gitignored).
// When the DB is missing or the tables are empty, seed from seed_data.json.
function seedSqliteIfEmpty() {
  if (!sqlite3) return;
  if (!fs.existsSync(SEED_PATH)) { console.warn('[Seed] seed_data.json not found — skipping'); return; }
  let seed;
  try { seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8')); } catch { console.error('[Seed] Failed to parse seed_data.json'); return; }

  const db = new sqlite3.Database(SQLITE_DB_PATH);
  // Prevent any uncaught 'error' events from crashing Node
  db.on('error', err => console.error('[Seed] DB error (suppressed):', err.message));

  // Promisified helpers — fully sequential, no callback/serialize races
  const dbRun = (sql, params = []) => new Promise((resolve, reject) =>
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); }));
  const dbGet = (sql, params = []) => new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
  const dbClose = () => new Promise(resolve => db.close(resolve));

  (async () => {
    try {
      await dbRun('PRAGMA journal_mode=WAL');
      await dbRun(`CREATE TABLE IF NOT EXISTS pois (
        id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT, poi_name TEXT, latitude REAL,
        longitude REAL, city TEXT, address TEXT, radius_meters INTEGER DEFAULT 500, type TEXT DEFAULT 'primary')`);
      await dbRun(`CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT, vehicle_no TEXT, vehicle_type TEXT,
        vehicle_size TEXT, owner_name TEXT, driver_name TEXT, phone TEXT, notes TEXT)`);
      await dbRun(`CREATE TABLE IF NOT EXISTS munshis (
        id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT, name TEXT, phone TEXT, email TEXT,
        primary_poi_ids TEXT, notes TEXT, balance REAL DEFAULT 0)`);
      await dbRun(`CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT, name TEXT, phone TEXT, license TEXT, notes TEXT)`);
      await dbRun(`CREATE TABLE IF NOT EXISTS fuel_type_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT, fuel_type TEXT, cost_per_liter REAL DEFAULT 0,
        updated_at TEXT, UNIQUE(client_id, fuel_type))`);
      await dbRun(`CREATE TABLE IF NOT EXISTS poi_unloading_rates_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT, poi_id TEXT, category_1_32ft_34ft REAL DEFAULT 0,
        category_2_22ft_24ft REAL DEFAULT 0, category_3_small REAL DEFAULT 0, notes TEXT)`);
      await dbRun(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT, vehicle_no TEXT, expense_type TEXT,
        amount REAL DEFAULT 0, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
      await dbRun(`CREATE TABLE IF NOT EXISTS eway_bills_master (
        id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT, ewb_no TEXT, doc_no TEXT,
        vehicle_no TEXT, from_place TEXT, to_place TEXT, from_poi_id TEXT, from_poi_name TEXT,
        to_poi_id TEXT, to_poi_name TEXT, from_trade_name TEXT, to_trade_name TEXT,
        from_pincode TEXT, to_pincode TEXT, total_value REAL DEFAULT 0, doc_date TEXT,
        valid_upto TEXT, status TEXT DEFAULT 'active', movement_type TEXT DEFAULT 'unclassified',
        supply_type TEXT, transport_mode TEXT DEFAULT 'Road', distance_km REAL DEFAULT 0,
        munshi_id TEXT, munshi_name TEXT, matched_trip_id TEXT, vehicle_status TEXT,
        delivered_at TEXT, notes TEXT, imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        validity_days INTEGER DEFAULT 0, ewb_number TEXT)`);
      await dbRun(`CREATE TABLE IF NOT EXISTS ewb_vehicle_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, ewb_id TEXT, ewb_number TEXT,
        old_vehicle TEXT, new_vehicle TEXT, changed_at TEXT DEFAULT CURRENT_TIMESTAMP, notes TEXT)`);
      await dbRun(`CREATE TABLE IF NOT EXISTS gps_current (
        id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT, vehicle_number TEXT,
        latitude REAL, longitude REAL, speed REAL DEFAULT 0, gps_time TEXT,
        stop_start_time TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
      await dbRun(`CREATE TABLE IF NOT EXISTS gps_live_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT, vehicle_number TEXT,
        latitude REAL, longitude REAL, speed REAL DEFAULT 0, gps_time TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
      await dbRun(`CREATE TABLE IF NOT EXISTS standard_routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT, route_name TEXT,
        from_location TEXT, to_location TEXT, route_km REAL DEFAULT 0, notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
      await dbRun(`CREATE TABLE IF NOT EXISTS route_job_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT, route_id TEXT,
        vehicle_number TEXT, driver_name TEXT, job_card_date TEXT, job_card_number TEXT UNIQUE,
        status TEXT DEFAULT 'started', munshi_id TEXT, munshi_name TEXT, notes TEXT,
        trip_type TEXT DEFAULT 'regular', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
      await dbRun(`CREATE TABLE IF NOT EXISTS trip_dispatch_stops (
        id INTEGER PRIMARY KEY AUTOINCREMENT, job_card_number TEXT, poi_id TEXT, poi_name TEXT,
        poi_lat REAL DEFAULT 0, poi_lon REAL DEFAULT 0, poi_radius REAL DEFAULT 500,
        sequence_order INTEGER DEFAULT 1, stop_type TEXT DEFAULT 'delivery',
        stop_status TEXT DEFAULT 'pending', arrived_at TEXT, departed_at TEXT)`);
      await dbRun(`CREATE TABLE IF NOT EXISTS driver_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT, driver_id TEXT, driver_name TEXT,
        trip_date TEXT, settlement REAL DEFAULT 0, notes TEXT,
        settlement_status TEXT DEFAULT 'salary', created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
      await dbRun(`CREATE TABLE IF NOT EXISTS munshi_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT, munshi_id TEXT, munshi_name TEXT,
        trip_id TEXT, trip_date TEXT, vehicle_number TEXT,
        from_location TEXT DEFAULT '', to_location TEXT DEFAULT '',
        advance_given REAL DEFAULT 0, fuel_cost REAL DEFAULT 0,
        toll_charges REAL DEFAULT 0, unloading_charges REAL DEFAULT 0,
        total_expense REAL DEFAULT 0, settlement REAL DEFAULT 0,
        settlement_status TEXT DEFAULT 'pending', notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
      await dbRun(`CREATE TABLE IF NOT EXISTS vehicle_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_number TEXT, trip_id TEXT,
        trip_date TEXT, driver_name TEXT DEFAULT '', munshi_name TEXT DEFAULT '',
        from_location TEXT DEFAULT '', to_location TEXT DEFAULT '',
        actual_km REAL DEFAULT 0, fuel_cost REAL DEFAULT 0,
        advance_given REAL DEFAULT 0, toll_charges REAL DEFAULT 0,
        unloading_charges REAL DEFAULT 0, other_charges REAL DEFAULT 0,
        total_expense REAL DEFAULT 0, notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
      // Add missing columns to driver_ledger for trip-based entries
      await dbRun(`ALTER TABLE driver_ledger ADD COLUMN trip_id TEXT`).catch(() => {});
      await dbRun(`ALTER TABLE driver_ledger ADD COLUMN vehicle_number TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE driver_ledger ADD COLUMN from_location TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE driver_ledger ADD COLUMN to_location TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE driver_ledger ADD COLUMN advance_given REAL DEFAULT 0`).catch(() => {});
      await dbRun(`ALTER TABLE driver_ledger ADD COLUMN fuel_cost REAL DEFAULT 0`).catch(() => {});
      await dbRun(`ALTER TABLE driver_ledger ADD COLUMN toll_charges REAL DEFAULT 0`).catch(() => {});
      await dbRun(`ALTER TABLE driver_ledger ADD COLUMN unloading_charges REAL DEFAULT 0`).catch(() => {});
      await dbRun(`ALTER TABLE driver_ledger ADD COLUMN other_charges REAL DEFAULT 0`).catch(() => {});
      await dbRun(`ALTER TABLE driver_ledger ADD COLUMN total_deducted REAL DEFAULT 0`).catch(() => {});
      await dbRun(`ALTER TABLE driver_ledger ADD COLUMN total_expense REAL DEFAULT 0`).catch(() => {});
      await dbRun(`CREATE TABLE IF NOT EXISTS fuel_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT, state TEXT, fuel_type TEXT,
        price REAL DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
      // Unique indexes for upsert support
      await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_gps_current_vno_cid ON gps_current(vehicle_number, client_id)`).catch(() => {});
      // Add missing columns to existing tables (migrations — ignore errors if already present)
      await dbRun(`ALTER TABLE vehicles ADD COLUMN fuel_type TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE vehicles ADD COLUMN driver_id TEXT`).catch(() => {});
      await dbRun(`ALTER TABLE vehicles ADD COLUMN munshi_id TEXT`).catch(() => {});
      await dbRun(`ALTER TABLE vehicles ADD COLUMN munshi_name TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE vehicles ADD COLUMN primary_poi_ids TEXT`).catch(() => {});
      await dbRun(`ALTER TABLE vehicles ADD COLUMN standard_route_no TEXT`).catch(() => {});
      await dbRun(`ALTER TABLE vehicles ADD COLUMN route_from TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE vehicles ADD COLUMN route_to TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE vehicles ADD COLUMN city TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE vehicles ADD COLUMN kmpl REAL`).catch(() => {});
      await dbRun(`ALTER TABLE vehicles ADD COLUMN fuel_cost_per_liter REAL`).catch(() => {});
      await dbRun(`ALTER TABLE munshis ADD COLUMN area TEXT DEFAULT ''`).catch(() => {});

      // Backfill fuel_type / munshi data for already-seeded vehicles that are missing it
      if ((seed.vehicles || []).length > 0) {
        await dbRun('BEGIN');
        for (const v of seed.vehicles) {
          if (!v.vehicle_no) continue;
          await dbRun(`UPDATE vehicles SET
            fuel_type   = CASE WHEN (fuel_type   IS NULL OR fuel_type   = '') THEN ? ELSE fuel_type   END,
            munshi_id   = CASE WHEN (munshi_id   IS NULL OR munshi_id   = '') THEN ? ELSE munshi_id   END,
            munshi_name = CASE WHEN (munshi_name IS NULL OR munshi_name = '') THEN ? ELSE munshi_name END,
            route_from  = CASE WHEN (route_from  IS NULL OR route_from  = '') THEN ? ELSE route_from  END,
            route_to    = CASE WHEN (route_to    IS NULL OR route_to    = '') THEN ? ELSE route_to    END,
            city        = CASE WHEN (city        IS NULL OR city        = '') THEN ? ELSE city        END
            WHERE vehicle_no = ?`,
            [v.fuel_type||'', v.munshi_id||null, v.munshi_name||'',
             v.route_from||'', v.route_to||'', v.city||'', v.vehicle_no]);
        }
        await dbRun('COMMIT');
      }

      await dbRun(`ALTER TABLE munshis ADD COLUMN region TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE munshis ADD COLUMN region TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE munshis ADD COLUMN pin TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE munshis ADD COLUMN monthly_salary REAL DEFAULT 0`).catch(() => {});
      await dbRun(`ALTER TABLE munshis ADD COLUMN approval_limit REAL DEFAULT 0`).catch(() => {});
      await dbRun(`ALTER TABLE vehicles ADD COLUMN driver_pin TEXT DEFAULT ''`).catch(() => {}); 
      await dbRun(`ALTER TABLE poi_unloading_rates_v2 ADD COLUMN updated_at TEXT`).catch(() => {});
      await dbRun(`ALTER TABLE pois ADD COLUMN munshi_id TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE pois ADD COLUMN munshi_name TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE pois ADD COLUMN state TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE pois ADD COLUMN pin_code TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_poi_unloading_v2_unique ON poi_unloading_rates_v2(client_id, poi_id)`).catch(() => {});

      // Seed pois if empty
      const poisRow = await dbGet('SELECT COUNT(1) as c FROM pois');
      if ((poisRow?.c ?? 1) === 0) {
        console.log(`[Seed] Seeding ${(seed.pois||[]).length} POIs...`);
        await dbRun('BEGIN');
        for (const p of (seed.pois || []))
          await dbRun('INSERT OR IGNORE INTO pois (client_id,poi_name,latitude,longitude,city,address,radius_meters,type) VALUES (?,?,?,?,?,?,?,?)',
            [p.client_id||'CLIENT_001', p.poi_name, p.latitude, p.longitude, p.city||'', p.address||'', p.radius_meters||500, p.type||'primary']);
        await dbRun('COMMIT');
      }

      // Seed vehicles if empty
      const vRow = await dbGet('SELECT COUNT(1) as c FROM vehicles');
      if ((vRow?.c ?? 1) === 0) {
        console.log(`[Seed] Seeding ${(seed.vehicles||[]).length} vehicles...`);
        await dbRun('BEGIN');
        for (const v of (seed.vehicles || []))
          await dbRun(`INSERT OR IGNORE INTO vehicles
            (client_id,vehicle_no,vehicle_type,vehicle_size,owner_name,driver_name,phone,notes,
             fuel_type,munshi_id,munshi_name,driver_id,primary_poi_ids,standard_route_no,route_from,route_to,city)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [v.client_id||'CLIENT_001', v.vehicle_no||v.vehicle_number||'', v.vehicle_type||'',
             v.vehicle_size||'', v.owner_name||'', v.driver_name||'', v.phone||'', v.notes||'',
             v.fuel_type||'', v.munshi_id||null, v.munshi_name||'', v.driver_id||null,
             v.primary_poi_ids||null, v.standard_route_no||null, v.route_from||'', v.route_to||'', v.city||'']);
        await dbRun('COMMIT');
      }

      // Seed munshis if empty
      const mRow = await dbGet('SELECT COUNT(1) as c FROM munshis');
      if ((mRow?.c ?? 1) === 0) {
        console.log(`[Seed] Seeding ${(seed.munshis||[]).length} munshis...`);
        await dbRun('BEGIN');
        for (const m of (seed.munshis || []))
          await dbRun('INSERT OR IGNORE INTO munshis (client_id,name,phone,email,primary_poi_ids,notes,balance) VALUES (?,?,?,?,?,?,?)',
            [m.client_id||'CLIENT_001', m.name||'', m.phone||'', m.email||'', m.primary_poi_ids||'[]', m.notes||'', m.balance||0]);
        await dbRun('COMMIT');
      }

      // Seed fuel_type_rates if empty
      const ftrRow = await dbGet('SELECT COUNT(1) as c FROM fuel_type_rates');
      if ((ftrRow?.c ?? 1) === 0 && (seed.fuel_type_rates || []).length > 0) {
        console.log(`[Seed] Seeding ${seed.fuel_type_rates.length} fuel type rates...`);
        await dbRun('BEGIN');
        for (const f of seed.fuel_type_rates)
          await dbRun(`INSERT OR IGNORE INTO fuel_type_rates (client_id, fuel_type, cost_per_liter, updated_at) VALUES (?,?,?,?)`,
            [f.client_id||'CLIENT_001', f.fuel_type||'', f.cost_per_liter||0, f.updated_at||new Date().toISOString()]);
        await dbRun('COMMIT');
      }

      // Seed eway_bills_master if empty
      const ewbRow = await dbGet('SELECT COUNT(1) as c FROM eway_bills_master');
      if ((ewbRow?.c ?? 1) === 0 && (seed.eway_bills || []).length > 0) {
        console.log(`[Seed] Seeding ${seed.eway_bills.length} EWBs...`);
        await dbRun('BEGIN');
        for (const e of seed.eway_bills)
          await dbRun(`INSERT OR IGNORE INTO eway_bills_master
            (client_id,ewb_no,doc_no,doc_date,vehicle_no,from_place,to_place,from_poi_id,from_poi_name,
             to_poi_id,to_poi_name,from_trade_name,to_trade_name,from_pincode,to_pincode,total_value,
             valid_upto,status,movement_type,supply_type,transport_mode,distance_km,
             munshi_id,munshi_name,matched_trip_id,vehicle_status,delivered_at,notes,imported_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [e.client_id||'CLIENT_001',e.ewb_no||'',e.doc_no||'',e.doc_date||'',e.vehicle_no||'',
             e.from_place||'',e.to_place||'',e.from_poi_id||null,e.from_poi_name||'',
             e.to_poi_id||null,e.to_poi_name||'',e.from_trade_name||'',e.to_trade_name||'',
             e.from_pincode||'',e.to_pincode||'',e.total_value||0,e.valid_upto||'',
             e.status||'delivered',e.movement_type||'unclassified',e.supply_type||'',
             e.transport_mode||'Road',e.distance_km||0,e.munshi_id||'',e.munshi_name||'',
             e.matched_trip_id||null,e.vehicle_status||'',e.delivered_at||null,e.notes||'',
             e.imported_at||new Date().toISOString()]);
        await dbRun('COMMIT');
      }

      console.log('[Seed] SQLite seed complete');
    } catch (err) {
      console.error('[Seed] Error during seed:', err.message);
    } finally {
      await dbClose();
    }
  })();
}
// ── end seed initializer ─────────────────────────────────────────────────

// ── GPS upsert helper (no Python needed) ────────────────────────────────────
// Writes raw provider vehicle records (or already-normalized ones) into gps_current.
function upsertGpsCurrent(arr, clientId) {
  return new Promise((resolve) => {
    if (!sqlite3 || !arr || !arr.length) { resolve(0); return; }
    try {
      const db2 = new sqlite3.Database(SQLITE_DB_PATH);
      db2.on('error', err => console.error('[upsertGps] error:', err.message));
      db2.serialize(() => {
        db2.run('BEGIN');
        const stmt = db2.prepare(
          `INSERT INTO gps_current (client_id, vehicle_number, latitude, longitude, speed, gps_time, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(vehicle_number, client_id) DO UPDATE SET
             latitude=excluded.latitude, longitude=excluded.longitude,
             speed=excluded.speed, gps_time=excluded.gps_time, updated_at=excluded.updated_at`
        );
        let count = 0;
        for (const v of arr) {
          const vno = v.vehicleNumber || v.vehicle_number || v.number || v.vehicleNo || v.vehicle_no || '';
          if (!vno) continue;
          const lat = Number(v.latitude || v.lat || 0) || null;
          const lng = Number(v.longitude || v.lng || 0) || null;
          const spd = Number(v.speed || 0) || 0;
          const epoch = v.dttimeInEpoch || v.createdDate || v.timestamp;
          let gpsTime = v.lastUpdate || v.gps_time || null;
          if (!gpsTime && epoch) {
            const e = Number(epoch);
            gpsTime = new Date(e > 1e12 ? e : e * 1000).toISOString();
          }
          if (!gpsTime) gpsTime = new Date().toISOString();
          stmt.run([clientId, vno, lat, lng, spd, gpsTime]);
          count++;
        }
        stmt.finalize();
        db2.run('COMMIT', () => {
          db2.close();
          console.log(`[upsertGps] ${clientId}: ${count} rows upserted`);
          resolve(count);
        });
      });
    } catch (e) {
      console.error('[upsertGps] exception:', e.message);
      resolve(0);
    }
  });
}
// ── end GPS upsert ────────────────────────────────────────────────────────────

// ── GPS live data appender (builds track history, skips duplicates via OR IGNORE) ──────────────
function appendGpsLiveData(arr, clientId) {
  return new Promise((resolve) => {
    if (!sqlite3 || !arr || !arr.length) { resolve(0); return; }
    try {
      const db2 = new sqlite3.Database(SQLITE_DB_PATH);
      db2.on('error', err => console.error('[appendGpsLive] error:', err.message));
      // Ensure unique index exists so INSERT OR IGNORE deduplicates
      db2.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_gps_live_vno_time ON gps_live_data(vehicle_number, client_id, gps_time)', () => {
        db2.serialize(() => {
          db2.run('BEGIN');
          const stmt = db2.prepare(
            `INSERT OR IGNORE INTO gps_live_data (client_id, vehicle_number, latitude, longitude, speed, gps_time)
             VALUES (?, ?, ?, ?, ?, ?)`
          );
          let count = 0;
          for (const v of arr) {
            const vno = v.vehicleNumber || v.vehicle_number || v.number || v.vehicleNo || v.vehicle_no || '';
            if (!vno) continue;
            const lat = Number(v.latitude || v.lat || 0) || null;
            const lng = Number(v.longitude || v.lng || 0) || null;
            const spd = Number(v.speed || 0) || 0;
            const epoch = v.dttimeInEpoch || v.createdDate || v.timestamp;
            let gpsTime = v.lastUpdate || v.gps_time || null;
            if (!gpsTime && epoch) { const e = Number(epoch); gpsTime = new Date(e > 1e12 ? e : e * 1000).toISOString(); }
            if (!gpsTime) gpsTime = new Date().toISOString();
            stmt.run([clientId, vno, lat, lng, spd, gpsTime]);
            count++;
          }
          stmt.finalize();
          db2.run('COMMIT', () => { db2.close(); resolve(count); });
        });
      });
    } catch (e) {
      console.error('[appendGpsLive] exception:', e.message);
      resolve(0);
    }
  });
}
// ── end GPS live appender ─────────────────────────────────────────────────────

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
      let sql = `SELECT g.vehicle_number, g.latitude, g.longitude, g.gps_time, g.client_id, g.speed, g.stop_start_time,
        v.driver_name, v.vehicle_size, v.fuel_type, v.route_from, v.route_to, v.city, v.munshi_name, v.vehicle_no
        FROM gps_current g
        LEFT JOIN vehicles v ON v.vehicle_no = g.vehicle_number AND (v.client_id = g.client_id OR v.client_id IS NULL)`;
      const params = [];
      
      if (tenantId) {
        sql += ' WHERE g.client_id = ?';
        params.push(tenantId);
      }
      
      sql += ' ORDER BY g.gps_time DESC LIMIT 1000';
      
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
            vehicle_number: row.vehicle_number,
            lat: Number(row.latitude) || null,
            lng: Number(row.longitude) || null,
            latitude: Number(row.latitude) || null,
            longitude: Number(row.longitude) || null,
            speed: Number(row.speed) || 0,
            lastUpdate,
            gps_time: lastUpdate,
            status: computeStatus(lastUpdate, row.speed || 0),
            type: row.fuel_type || '',
            driver: row.driver_name || '',
            driver_name: row.driver_name || '',
            vehicle_size: row.vehicle_size || '',
            fuel_type: row.fuel_type || '',
            route_from: row.route_from || '',
            route_to: row.route_to || '',
            city: row.city || '',
            munshi_name: row.munshi_name || '',
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

const server = http.createServer((req, res) => {
  // ── Healthcheck – sync, outside async handler ─────────────────────────────
  const rawPath = (url.parse(req.url || '/', true).pathname || '/').replace(/\/+$/g, '') || '/';
  if (rawPath === '/health' || rawPath === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', ts: Date.now(), sqlite: !!sqlite3, v: 4, build: 'ewb-import-fix' }));
  }
  // Delegate everything else to async handler
  handleRequest(req, res, rawPath).catch(err => {
    console.error('[server] unhandled error:', err.message);
    if (!res.headersSent) { res.writeHead(500); res.end('Internal Server Error'); }
  });
});

async function handleRequest(req, res, rawPath) {
  try {
  const parsed = url.parse(req.url, true);
  // normalize pathname by stripping trailing slashes so routes match consistently
  const pathname = rawPath;
  // enable simple CORS for local dashboard
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Tenant-ID');
  if (req.method === 'OPTIONS') return res.end();

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

    // Last-resort fallback: if still empty, serve vehicles-master table as NO_GPS
    // This ensures the dashboard shows the fleet registry even when GPS sync is not configured
    if ((!list || list.length === 0) && sqlite3 && fs.existsSync(SQLITE_DB_PATH)) {
      try {
        const masterVehicles = await new Promise((resolve) => {
          const db2 = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY);
          db2.on('error', () => {});
          const clientFilter = tenantId || parsed.query.clientId || parsed.query.client_id || 'CLIENT_001';
          db2.all('SELECT * FROM vehicles WHERE client_id=? ORDER BY vehicle_no', [clientFilter], (err, rows) => {
            db2.close();
            resolve(err ? [] : (rows || []));
          });
        });
        if (masterVehicles.length > 0) {
          list = masterVehicles.map(v => ({
            id: v.id,
            number: v.vehicle_no || '',
            vehicle_number: v.vehicle_no || '',
            vehicle_no: v.vehicle_no || '',
            type: v.vehicle_type || '',
            vehicle_type: v.vehicle_type || '',
            vehicle_size: v.vehicle_size || '',
            driver: v.driver_name || '',
            driver_name: v.driver_name || '',
            owner_name: v.owner_name || '',
            phone: v.phone || '',
            lat: null,
            lng: null,
            latitude: null,
            longitude: null,
            speed: 0,
            status: 'NO_GPS',
            lastUpdate: null,
            gps_time: null,
            fuel: 0,
            city: '',
            stop_poi: '',
            munshi_name: '',
            _source: 'vehicles_master',
          }));
        }
      } catch { /* ignore */ }
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
      try { fs.appendFileSync('query_track-debug.log', JSON.stringify({ ts: new Date().toISOString(), args, status: out.status, stderr: out.stderr, stdout: out.stdout }) + '\n'); } catch { }
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
      
      // Persist to SQLite: upsert gps_current (latest pos) + append to gps_live_data (history)
      await upsertGpsCurrent(rawList, tenantId).catch(e => console.error('[Sync] upsertGps error:', e.message));
      await appendGpsLiveData(rawList, tenantId).catch(e => console.error('[Sync] appendGpsLive error:', e.message));
      
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
    db2.on('error', err => console.error('[sqliteJson] DB error:', err.message));
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

  // GET /api/dev/clients — returns distinct clients from vehicles table
  if (pathname === '/api/dev/clients' && req.method === 'GET') {
    return sqliteJson(res, `SELECT DISTINCT client_id FROM vehicles ORDER BY client_id`, [], rows =>
      rows.map(r => ({ client_id: r.client_id })));
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
      'INSERT INTO pois (client_id,poi_name,latitude,longitude,city,address,radius_meters,type,state,pin_code,munshi_id,munshi_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [body.clientId||'CLIENT_001', body.poi_name, body.latitude, body.longitude, body.city||'', body.address||'', body.radius_meters||500, body.type||'primary', body.state||'', body.pin_code||'', body.munshi_id||'', body.munshi_name||''],
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
    db2.run('UPDATE pois SET poi_name=?,latitude=?,longitude=?,city=?,address=?,radius_meters=?,type=?,state=?,pin_code=?,munshi_id=?,munshi_name=? WHERE id=?',
      [body.poi_name, body.latitude, body.longitude, body.city||'', body.address||'', body.radius_meters||500, body.type||'primary', body.state||'', body.pin_code||'', body.munshi_id||'', body.munshi_name||'', poiId],
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
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.all('SELECT * FROM fuel_type_rates WHERE client_id=?', [clientId], (err, rates) => {
      const rateMap = {};
      (rates || []).forEach(r => { rateMap[(r.fuel_type||'').toUpperCase()] = r.cost_per_liter; });
      db2.all('SELECT * FROM vehicles WHERE client_id=? ORDER BY vehicle_no', [clientId], (err2, rows) => {
        db2.close();
        if (err2) { res.statusCode = 500; return res.end(JSON.stringify({ error: err2.message })); }
        const result = (rows || []).map(r => ({
          ...r,
          number: r.vehicle_no,
          vehicle_reg_no: r.vehicle_no,
          fuel_cost_per_liter: r.fuel_cost_per_liter != null ? r.fuel_cost_per_liter : (rateMap[(r.fuel_type||'').toUpperCase()] ?? null),
        }));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      });
    });
    return;
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
    db2.run('UPDATE vehicles SET driver_name=?, vehicle_size=?, driver_id=?, munshi_id=?, munshi_name=?, fuel_type=?, kmpl=?, fuel_cost_per_liter=?, driver_pin=? WHERE vehicle_no=? OR id=?',
      [body.driver_name||'', body.type||body.vehicle_size||'', body.driver_id||null, body.munshi_id||null, body.munshi_name||null, body.fuel_type||null, body.kmpl!=null?body.kmpl:null, body.fuel_cost_per_liter!=null?body.fuel_cost_per_liter:null, body.driver_pin||'', vId, vId],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true })); });
    return;
  }

  // PUT /api/vehicles-master/:id/fuel-rate (bulk fuel rate set)
  if (/^\/api\/vehicles-master\/[^/]+\/fuel-rate$/.test(pathname) && req.method === 'PUT') {
    const vId = decodeURIComponent(pathname.split('/').slice(-2)[0]);
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('UPDATE vehicles SET kmpl=?, fuel_cost_per_liter=? WHERE vehicle_no=? OR id=?',
      [body.kmpl != null ? body.kmpl : null, body.fuel_cost_per_liter != null ? body.fuel_cost_per_liter : null, vId, vId],
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
    try {
      // Fetch explicit driver records with vehicle count
      const explicit = await sqAll(
        `SELECT d.*, COUNT(v.id) as vehicle_count
         FROM drivers d
         LEFT JOIN vehicles v ON LOWER(TRIM(v.driver_name)) = LOWER(TRIM(d.name)) AND v.client_id = d.client_id
         WHERE d.client_id = ?
         GROUP BY d.id
         ORDER BY d.name`, [clientId]);
      // Also synthesize drivers from vehicles that have no matching record
      const synthRows = await sqAll(
        `SELECT driver_name, driver_id, client_id, COUNT(*) as vehicle_count
         FROM vehicles
         WHERE client_id = ? AND driver_name IS NOT NULL AND TRIM(driver_name) != ''
         GROUP BY LOWER(TRIM(driver_name))`, [clientId]);
      const explicitNames = new Set(explicit.map(d => (d.name||'').toLowerCase().trim()));
      const synth = synthRows
        .filter(r => !explicitNames.has((r.driver_name||'').toLowerCase().trim()))
        .map(r => ({ id: r.driver_id || null, client_id: r.client_id, name: r.driver_name,
          phone: '', license: '', notes: '', vehicle_count: r.vehicle_count, _synth: true }));
      return jsonResp(res, [...explicit, ...synth].sort((a,b) => (a.name||'').localeCompare(b.name||'')));
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ error: e.message })); }
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

  // PUT /api/trip-dispatches/:jc/stops/:stopId/arrived  — driver marks a stop as arrived
  if (/^\/api\/trip-dispatches\/[^/]+\/stops\/\d+\/arrived$/.test(pathname) && req.method === 'PUT') {
    const parts = pathname.split('/');
    const stopId = parts[5];
    const body = await readBody(req);
    try {
      await sqRun(
        'UPDATE trip_dispatch_stops SET stop_status=?, arrived_at=? WHERE id=?',
        [body.stop_status || 'arrived', body.arrived_at || new Date().toISOString(), stopId]
      );
      return jsonResp(res, { success: true });
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ error: e.message })); }
  }


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

  // POST /api/vehicles/driver-login
  if (pathname === '/api/vehicles/driver-login' && req.method === 'POST') {
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.get('SELECT vehicle_no, driver_name, phone, munshi_name, vehicle_size, fuel_type, driver_pin FROM vehicles WHERE vehicle_no=? AND driver_pin=? AND client_id=?',
      [(body.vehicle_no||'').toUpperCase().trim(), body.pin||'', body.client_id||'CLIENT_001'],
      (err, row) => { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err||!row ? { error: 'Invalid vehicle number or PIN' } : { success: true, vehicle: row })); });
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
    // Serialize primary_poi_ids — accept array or JSON string
    const poiIds = Array.isArray(body.primary_poi_ids)
      ? JSON.stringify(body.primary_poi_ids)
      : (body.primary_poi_ids || '[]');
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('UPDATE munshis SET name=?,phone=?,area=?,region=?,pin=?,monthly_salary=?,approval_limit=?,primary_poi_ids=?,email=? WHERE id=?',
      [body.name||'', body.phone||'', body.area||'', body.region||'', body.pin||'', body.monthly_salary||0, body.approval_limit||0, poiIds, body.email||'', mId],
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
    // Try gps_live_data first, fall back to gps_current single-point range
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY);
    db2.get('SELECT MIN(gps_time) as min_time, MAX(gps_time) as max_time FROM gps_live_data WHERE vehicle_number=? AND client_id=?',
      [vehicleId, clientId], (err, row) => {
        if (!err && row && row.min_time) {
          db2.close();
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ min: row.min_time, max: row.max_time }));
        }
        // fall back to gps_current
        db2.get('SELECT gps_time FROM gps_current WHERE vehicle_number=? AND client_id=?',
          [vehicleId, clientId], (err2, row2) => {
            db2.close();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ min: row2?.gps_time || null, max: row2?.gps_time || null }));
          });
      });
    return;
  }

  // GET /api/vehicle-track — query gps_live_data with fallback to gps_current
  if (pathname === '/api/vehicle-track' && req.method === 'GET') {
    const vehicleId = parsed.query.vehicleId || '';
    const clientId = parsed.query.clientId || 'CLIENT_001';
    const startTime = parsed.query.startTime || '';
    const endTime = parsed.query.endTime || '';
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY);
    const params = [vehicleId, clientId];
    let sql = 'SELECT latitude, longitude, gps_time, speed FROM gps_live_data WHERE vehicle_number=? AND client_id=?';
    if (startTime) { sql += ' AND gps_time>=?'; params.push(startTime); }
    if (endTime)   { sql += ' AND gps_time<=?'; params.push(endTime); }
    sql += ' ORDER BY gps_time';
    db2.all(sql, params, (err, rows) => {
      if (!err && rows && rows.length > 0) {
        db2.close();
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(rows));
      }
      // Fall back to gps_current so tracker always shows at least current dot
      db2.get('SELECT latitude, longitude, gps_time, speed FROM gps_current WHERE vehicle_number=? AND client_id=?',
        [vehicleId, clientId], (err2, row) => {
          db2.close();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(row ? [row] : []));
        });
    });
    return;
  }

  // ── EWB Hub helpers ───────────────────────────────────────────────────────
  function sqAll(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!sqlite3) return reject(new Error('sqlite3 unavailable'));
      const db2 = new sqlite3.Database(SQLITE_DB_PATH);
      db2.all(sql, params, (err, rows) => { db2.close(); err ? reject(err) : resolve(rows || []); });
    });
  }
  function sqRun(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!sqlite3) return reject(new Error('sqlite3 unavailable'));
      const db2 = new sqlite3.Database(SQLITE_DB_PATH);
      db2.run(sql, params, function(err) { db2.close(); err ? reject(err) : resolve(this); });
    });
  }
  function haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000, toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function findPoiForVehicle(lat, lon, pois) {
    if (!lat || !lon) return null;
    for (const p of pois) {
      if (p.latitude && p.longitude) {
        const d = haversineM(parseFloat(lat), parseFloat(lon), parseFloat(p.latitude), parseFloat(p.longitude));
        if (d <= parseFloat(p.radius_meters || 1500)) return p;
      }
    }
    return null;
  }
  // Simple POI name matching for reclassify/rematch
  function matchPoiByName(tradeName, place, pincode, pois) {
    if (!tradeName && !place) return null;
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const tn = norm(tradeName), pl = norm(place), pc = (pincode || '').replace(/\D/g, '');
    let best = null, bestScore = 0;
    for (const p of pois) {
      const pn = norm(p.poi_name), pc2 = (p.pin_code || '').replace(/\D/g, '');
      let score = 0;
      if (tn && pn.includes(tn.slice(0, 6))) score += 10;
      if (tn && tn.includes(pn.slice(0, 6))) score += 8;
      if (pl && (pn.includes(pl) || pl.includes(pn.slice(0, 4)))) score += 5;
      if (pc && pc2 && pc === pc2) score += 15;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return bestScore >= 8 ? best : null;
  }
  function classifyMovement(fromPoi, toPoi, supplyType) {
    const st = (supplyType || '').toLowerCase();
    if (st.includes('return') || st.includes('inward')) return 'inward_return';
    if (!fromPoi || !toPoi) return 'unclassified';
    const ft = (fromPoi.type || '').toLowerCase(), tt = (toPoi.type || '').toLowerCase();
    if (ft === 'primary' && tt === 'secondary') return 'primary_to_secondary';
    if (ft === 'primary' && tt === 'tertiary') return 'primary_to_tertiary';
    if (ft === 'primary') return 'primary_to_other';
    if (ft === 'secondary' && tt === 'tertiary') return 'secondary_to_dealer';
    if (ft === 'secondary') return 'secondary_to_other';
    if (ft === tt && ft === 'secondary') return 'dealer_transfer';
    if (ft === tt && ft === 'primary') return 'hub_transfer';
    return 'unclassified';
  }
  function jsonResp(res, data, status = 200) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  }

  // POST /api/eway-bills-hub/import-excel  (upload sheet001.htm or .xlsx)
  if (pathname === '/api/eway-bills-hub/import-excel' && req.method === 'POST') {
    try {
      const contentType = req.headers['content-type'] || '';
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) return jsonResp(res, { error: 'No multipart boundary found' }, 400);

      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const buf = Buffer.concat(chunks);

      // Extract file content from multipart
      const boundaryBuf = Buffer.from('--' + boundary);
      const parts = [];
      let start = 0;
      while (true) {
        const idx = buf.indexOf(boundaryBuf, start);
        if (idx === -1) break;
        if (start > 0) parts.push(buf.slice(start, idx - 2));
        start = idx + boundaryBuf.length + 2;
      }

      let fileContent = null, fileName = '';
      for (const part of parts) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const header = part.slice(0, headerEnd).toString();
        if (!header.includes('filename=')) continue;
        const fnMatch = header.match(/filename="([^"]+)"/);
        if (fnMatch) fileName = fnMatch[1];
        fileContent = part.slice(headerEnd + 4);
      }
      if (!fileContent) return jsonResp(res, { error: 'No file found in upload' }, 400);

      const XLSX = await import('xlsx');
      let wb;
      const lname = fileName.toLowerCase();
      if (lname.endsWith('.htm') || lname.endsWith('.html')) {
        wb = XLSX.read(fileContent.toString('utf8'), { type: 'string' });
      } else {
        wb = XLSX.read(fileContent, { type: 'buffer' });
      }

      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rows.length) return jsonResp(res, { error: 'No data rows found in file' }, 400);

      // Normalize column names
      const norm = s => (s || '').toString().toLowerCase().replace(/[\s.\-_/]+/g, '');

      // Parse NIC's combined "GSTIN Info" field: "TRADE NAME,ADDRESS,CITY,PINCODE"
      function parseGstinInfo(str) {
        if (!str) return { trade_name: '', place: '', pincode: '' };
        const s = String(str).trim();
        const parts = s.split(',').map(p => p.trim()).filter(Boolean);
        if (!parts.length) return { trade_name: s, place: '', pincode: '' };
        const trade_name = parts[0];
        const lastPart = parts[parts.length - 1];
        const isPin = /^\d{6}$/.test(lastPart);
        const pincode = isPin ? lastPart : '';
        const place = isPin && parts.length >= 3 ? parts[parts.length - 2] : (!isPin ? lastPart : '');
        return { trade_name, place, pincode };
      }

      const colMap = key => {
        const k = norm(key);
        if (k.includes('ewbno') || k.includes('ewbnumber') || k.includes('ewaybillno')) return 'ewb_no';
        if (k.includes('docno') || k.includes('documentno')) return 'doc_no';
        if (k.includes('vehicleno') || k.includes('vehicleregno')) return 'vehicle_no';
        // NIC combined format: "From GSTIN Info" / "To GSTIN Info" — must check before plain fromgstin
        if (k === 'fromgstininfo') return '_from_gstin_info';
        if (k === 'togstininfo') return '_to_gstin_info';
        if (k.includes('fromgstin') || k.includes('fromgst')) return 'from_gstin';
        if (k.includes('fromtradename') || k.includes('fromparty') || k.includes('generatorname')) return 'from_trade_name';
        if (k.includes('fromplace') || k.includes('fromlocation') || k.includes('fromstate') || k.includes('dispatchfrom')) return 'from_place';
        if (k.includes('frompincode') || k.includes('frompin')) return 'from_pincode';
        if (k.includes('togstin') || k.includes('togst')) return 'to_gstin';
        if (k.includes('totradename') || k.includes('toparty') || k.includes('recipientname')) return 'to_trade_name';
        if (k.includes('toplace') || k.includes('tolocation') || k.includes('tostate') || k.includes('shipto')) return 'to_place';
        if (k.includes('topincode') || k.includes('topin')) return 'to_pincode';
        if (k.includes('totalvalue') || k.includes('totalinvvalue') || k.includes('invoicevalue')) return 'total_value';
        if (k.includes('docdate') || k.includes('invoicedate')) return 'doc_date';
        // NIC uses "Valid Untill" (typo) — validuntil matches validuntill as substring
        if (k.includes('validupto') || k.includes('expirydate') || k.includes('validtill') || k.includes('validuntil')) return 'valid_upto';
        if (k.includes('supplytype') || k.includes('supplytyp')) return 'supply_type';
        if (k.includes('transportmode') || k.includes('mode')) return 'transport_mode';
        if (k.includes('distance') || k.includes('approxdist')) return 'distance_km';
        return null;
      };

      const pois = await sqAll('SELECT * FROM pois WHERE client_id=?', ['CLIENT_001']);
      const munshis = await sqAll('SELECT * FROM munshis WHERE client_id=?', ['CLIENT_001']);

      let inserted = 0, updated = 0, skipped = 0;
      for (const row of rows) {
        const mapped = {};
        for (const [k, v] of Object.entries(row)) {
          const col = colMap(k);
          if (col) mapped[col] = v;
        }

        // Parse NIC's combined GSTIN info fields → from_trade_name, from_place, from_pincode
        if (mapped._from_gstin_info) {
          const p = parseGstinInfo(String(mapped._from_gstin_info));
          if (!mapped.from_trade_name) mapped.from_trade_name = p.trade_name;
          if (!mapped.from_place)      mapped.from_place      = p.place;
          if (!mapped.from_pincode)    mapped.from_pincode    = p.pincode;
        }
        if (mapped._to_gstin_info) {
          const p = parseGstinInfo(String(mapped._to_gstin_info));
          if (!mapped.to_trade_name) mapped.to_trade_name = p.trade_name;
          if (!mapped.to_place)      mapped.to_place      = p.place;
          if (!mapped.to_pincode)    mapped.to_pincode    = p.pincode;
        }

        // EWB number: handle large integers stored as JS floats (avoid scientific notation)
        let ewbNo = '';
        const rawEwb = mapped.ewb_no;
        if (typeof rawEwb === 'number') {
          ewbNo = Number.isInteger(rawEwb) ? String(rawEwb) : String(Math.round(rawEwb));
        } else {
          ewbNo = (rawEwb || '').toString().replace(/[eE][+\-]?\d+/, s => {
            try { return String(Math.round(parseFloat((rawEwb || '').toString()))); } catch { return ''; }
          }).replace(/[^0-9]/g, '');
        }
        if (!ewbNo || ewbNo.length < 6) { skipped++; continue; }

        const vno = (mapped.vehicle_no || '').toString().toUpperCase().replace(/\s/g, '');
        const fromPlace = (mapped.from_place || '').toString();
        const fromPin = (mapped.from_pincode || '').toString().replace(/\D/g, '');
        const toPlace = (mapped.to_place || '').toString();
        const toPin = (mapped.to_pincode || '').toString().replace(/\D/g, '');
        const fromTrade = (mapped.from_trade_name || '').toString();
        const toTrade = (mapped.to_trade_name || '').toString();

        // POI matching
        const fromPoi = matchPoiByName(fromTrade, fromPlace, fromPin, pois);
        const toPoi   = matchPoiByName(toTrade, toPlace, toPin, pois);
        const mvType  = classifyMovement(fromPoi, toPoi, mapped.supply_type);

        // Munshi matching by vehicle
        const vehicleRow = await sqAll('SELECT munshi_id, munshi_name FROM vehicles WHERE vehicle_no=? AND client_id=?', [vno, 'CLIENT_001']).then(r => r[0] || null);
        const munshiId   = vehicleRow?.munshi_id || null;
        const munshiName = vehicleRow?.munshi_name || null;

        const now = new Date().toISOString();
        const totalVal = parseFloat((mapped.total_value || '0').toString().replace(/[^0-9.]/g, '')) || 0;
        const distKm   = parseFloat((mapped.distance_km || '0').toString().replace(/[^0-9.]/g, '')) || 0;

        // Parse validity days from valid_upto
        let validityDays = 0;
        if (mapped.valid_upto) {
          const expDate = new Date(mapped.valid_upto);
          const docDate = mapped.doc_date ? new Date(mapped.doc_date) : new Date();
          if (!isNaN(expDate) && !isNaN(docDate)) validityDays = Math.round((expDate - docDate) / 86400000);
        }

        try {
          await sqRun(
            `INSERT OR REPLACE INTO eway_bills_master
              (client_id, ewb_no, ewb_number, doc_no, vehicle_no, from_place, to_place,
               from_poi_id, from_poi_name, to_poi_id, to_poi_name,
               from_trade_name, to_trade_name, from_pincode, to_pincode,
               total_value, doc_date, valid_upto, status, movement_type,
               supply_type, transport_mode, distance_km,
               munshi_id, munshi_name, validity_days, imported_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            ['CLIENT_001', ewbNo, ewbNo, mapped.doc_no || '', vno,
             fromPlace, toPlace,
             fromPoi?.id || null, fromPoi?.poi_name || null,
             toPoi?.id || null, toPoi?.poi_name || null,
             fromTrade, toTrade, fromPin, toPin,
             totalVal, mapped.doc_date || '', mapped.valid_upto || '',
             'active', mvType,
             mapped.supply_type || '', mapped.transport_mode || 'Road', distKm,
             munshiId, munshiName, validityDays, now, now]
          );
          inserted++;
        } catch (e) {
          console.error('EWB insert error:', e.message); skipped++;
        }
      }

      return jsonResp(res, { success: true, inserted, updated, skipped, total: rows.length, message: `Imported ${inserted} EWBs from ${rows.length} rows` });
    } catch (e) {
      console.error('[import-excel]', e);
      return jsonResp(res, { error: e.message }, 500);
    }
  }

  // GET /api/eway-bills-hub  (bills list with filters + pagination)
  if (pathname === '/api/eway-bills-hub' && req.method === 'GET') {
    try {
      const cid = parsed.query.client_id || 'CLIENT_001';
      const movType = parsed.query.movement_type || '';
      const status  = parsed.query.status || '';
      const vno     = parsed.query.vehicle_no || '';
      const search  = parsed.query.search || '';
      const dfrom   = parsed.query.date_from || '';
      const dto     = parsed.query.date_to || '';
      const page    = Math.max(1, parseInt(parsed.query.page || '1'));
      const perPage = Math.min(200, parseInt(parsed.query.per_page || '50'));
      const where = ['client_id = ?'], params = [cid];
      if (movType) { where.push('movement_type = ?'); params.push(movType); }
      if (status)  { where.push('status = ?');        params.push(status); }
      if (vno)     { where.push('vehicle_no = ?');     params.push(vno); }
      if (dfrom)   { where.push('doc_date >= ?');      params.push(dfrom); }
      if (dto)     { where.push('doc_date <= ?');      params.push(dto); }
      if (search) {
        where.push('(ewb_no LIKE ? OR vehicle_no LIKE ? OR from_place LIKE ? OR to_place LIKE ?)');
        const like = `%${search}%`;
        params.push(like, like, like, like);
      }
      const whereClause = where.join(' AND ');
      const [cntRows, bills] = await Promise.all([
        sqAll(`SELECT COUNT(*) as cnt FROM eway_bills_master WHERE ${whereClause}`, params),
        sqAll(`SELECT * FROM eway_bills_master WHERE ${whereClause} ORDER BY doc_date DESC, id DESC LIMIT ? OFFSET ?`,
              [...params, perPage, (page - 1) * perPage]),
      ]);
      return jsonResp(res, { bills, total: cntRows[0]?.cnt || 0, page, per_page: perPage });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // GET /api/eway-bills-hub/summary
  if (pathname === '/api/eway-bills-hub/summary' && req.method === 'GET') {
    try {
      const cid = parsed.query.client_id || 'CLIENT_001';
      const [breakdown, [unc], [exp], [expd], hubs, dists] = await Promise.all([
        sqAll(`SELECT movement_type, status, COUNT(*) as cnt, SUM(total_value) as total_value
               FROM eway_bills_master WHERE client_id=? GROUP BY movement_type, status`, [cid]),
        sqAll(`SELECT COUNT(*) as cnt FROM eway_bills_master WHERE client_id=? AND movement_type='unclassified'`, [cid]),
        sqAll(`SELECT COUNT(*) as cnt FROM eway_bills_master WHERE client_id=? AND status='active'
               AND valid_upto IS NOT NULL AND DATE(valid_upto) <= DATE('now','+1 day') AND DATE(valid_upto) >= DATE('now')`, [cid]),
        sqAll(`SELECT COUNT(*) as cnt FROM eway_bills_master WHERE client_id=? AND status='active'
               AND valid_upto IS NOT NULL AND DATE(valid_upto) < DATE('now')`, [cid]),
        sqAll(`SELECT from_poi_name as name, COUNT(*) as total,
               SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
               SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) as delivered,
               SUM(total_value) as total_value, COUNT(DISTINCT to_poi_name) as destinations
               FROM eway_bills_master WHERE client_id=? AND from_poi_name IS NOT NULL AND from_poi_name != ''
               GROUP BY from_poi_name ORDER BY total DESC LIMIT 20`, [cid]),
        sqAll(`SELECT to_poi_name as name, COUNT(*) as total,
               SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
               SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) as delivered,
               SUM(total_value) as total_value, COUNT(DISTINCT from_poi_name) as sources
               FROM eway_bills_master WHERE client_id=? AND to_poi_name IS NOT NULL AND to_poi_name != ''
               GROUP BY to_poi_name ORDER BY total DESC LIMIT 30`, [cid]),
      ]);
      // build by_movement map
      const byMovement = {};
      for (const r of breakdown) {
        if (!byMovement[r.movement_type]) byMovement[r.movement_type] = { total: 0, active: 0, delivered: 0, expired: 0, total_value: 0 };
        const m = byMovement[r.movement_type];
        m.total += r.cnt; m.total_value += r.total_value || 0;
        if (r.status === 'active') m.active += r.cnt;
        else if (r.status === 'delivered') m.delivered += r.cnt;
        else if (r.status === 'expired') m.expired += r.cnt;
      }
      return jsonResp(res, {
        breakdown, by_movement: byMovement,
        unclassified: unc?.cnt || 0, unclassified_count: unc?.cnt || 0,
        expiring_soon: exp?.cnt || 0, expired_active: expd?.cnt || 0,
        by_hub: hubs, by_distributor: dists,
      });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // GET /api/eway-bills-hub/warnings
  if (pathname === '/api/eway-bills-hub/warnings' && req.method === 'GET') {
    try {
      const cid = parsed.query.client_id || 'CLIENT_001';
      const [gpsRows, pois, activeEwbs] = await Promise.all([
        sqAll(`SELECT vehicle_number, latitude, longitude, gps_time, speed FROM gps_current WHERE client_id=?`, [cid]),
        sqAll(`SELECT id, poi_name, latitude, longitude, radius_meters, type FROM pois WHERE client_id=?`, [cid]),
        sqAll(`SELECT * FROM eway_bills_master WHERE client_id=? AND status='active' ORDER BY doc_date DESC`, [cid]),
      ]);
      const vehicles = {};
      for (const g of gpsRows) vehicles[g.vehicle_number] = g;
      const vehiclePoi = {};
      for (const [vno, v] of Object.entries(vehicles)) {
        const p = findPoiForVehicle(v.latitude, v.longitude, pois);
        if (p) vehiclePoi[vno] = p;
      }
      const alerts = [];
      const today = new Date().toISOString().slice(0, 10);
      for (const ewb of activeEwbs) {
        const vno = (ewb.vehicle_no || '').trim();
        if (ewb.valid_upto) {
          const exp = ewb.valid_upto.slice(0, 10);
          if (exp < today) {
            alerts.push({ warning_type: 'ewb_expired', severity: 'HIGH', vehicle_no: vno, ewb_no: ewb.ewb_no, valid_upto: exp,
              message: `EWB ${ewb.ewb_no} expired ${exp} – vehicle ${vno}` });
          } else if (exp === today) {
            alerts.push({ warning_type: 'ewb_expiring_soon', severity: 'MEDIUM', vehicle_no: vno, ewb_no: ewb.ewb_no, valid_upto: exp,
              message: `EWB ${ewb.ewb_no} expires today – extend now` });
          }
        }
        if (vno && vehiclePoi[vno] && ewb.from_poi_id && String(vehiclePoi[vno].id) === String(ewb.from_poi_id)) {
          alerts.push({ warning_type: 'ewb_issued_not_departed', severity: 'LOW', vehicle_no: vno, ewb_no: ewb.ewb_no,
            poi_name: vehiclePoi[vno].poi_name, message: `${vno} has EWB ${ewb.ewb_no} but still at loading POI` });
        }
      }
      for (const [vno, poi] of Object.entries(vehiclePoi)) {
        if ((poi.type || '') === 'primary') {
          const hasEwb = activeEwbs.some(e => e.vehicle_no === vno && (e.movement_type || '').startsWith('primary'));
          if (!hasEwb) alerts.push({ warning_type: 'vehicle_at_loading_no_ewb', severity: 'LOW', vehicle_no: vno, ewb_no: null,
            poi_name: poi.poi_name, message: `${vno} at "${poi.poi_name}" with no active outward EWB` });
        }
        if (['secondary','tertiary'].includes(poi.type || '')) {
          const matchEwb = activeEwbs.find(e => e.vehicle_no === vno && String(e.to_poi_id) === String(poi.id));
          alerts.push({ warning_type: 'vehicle_unloading', severity: 'INFO', vehicle_no: vno,
            ewb_no: matchEwb?.ewb_no || null, poi_name: poi.poi_name,
            message: `${vno} arrived at "${poi.poi_name}" — unloading in progress` });
        }
      }
      return jsonResp(res, { warnings: alerts, count: alerts.length });
    } catch(e) { return jsonResp(res, { warnings: [], count: 0, error: e.message }); }
  }

  // GET /api/eway-bills-hub/active-list
  if (pathname === '/api/eway-bills-hub/active-list' && req.method === 'GET') {
    try {
      const cid = parsed.query.clientId || parsed.query.client_id || 'CLIENT_001';
      const rows = await sqAll(`
        SELECT ewb_no, doc_no, doc_date, vehicle_no, from_trade_name, to_trade_name,
               from_place, to_place, from_poi_name, to_poi_name, valid_upto, status,
               movement_type, distance_km, total_value, munshi_name, delivered_at,
               notes, imported_at, id
        FROM eway_bills_master WHERE client_id=?
        ORDER BY imported_at DESC LIMIT 2000`, [cid]);
      // Compute expiry flags
      const now = new Date();
      const result = rows.map(r => {
        const validUpto = r.valid_upto ? new Date(r.valid_upto) : null;
        const hoursLeft = validUpto ? (validUpto - now) / 3600000 : null;
        const is_expired = validUpto ? validUpto < now : false;
        const expiring_soon = !is_expired && hoursLeft != null && hoursLeft <= 24;
        return { ...r, hours_left: hoursLeft ? Math.round(hoursLeft) : null, is_expired, expiring_soon };
      });
      return jsonResp(res, result);
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // POST /api/eway-bills-hub/sync-this-month
  if (pathname === '/api/eway-bills-hub/sync-this-month' && req.method === 'POST') {
    // This would normally pull from NIC; for now just return what we have for current month
    try {
      const cid = parsed.query.clientId || parsed.query.client_id || 'CLIENT_001';
      const since = new Date(); since.setDate(1); since.setHours(0,0,0,0);
      const sinceStr = since.toISOString().slice(0,10);
      const rows = await sqAll(`SELECT COUNT(*) as c FROM eway_bills_master WHERE client_id=? AND (doc_date >= ? OR imported_at >= ?)`,
        [cid, sinceStr, sinceStr]);
      const count = rows[0]?.c || 0;
      return jsonResp(res, { synced: count, since: sinceStr, message: 'Returned existing records for this month' });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // GET /api/eway-bills-hub/vehicle-movement
  if (pathname === '/api/eway-bills-hub/vehicle-movement' && req.method === 'GET') {
    try {
      const cid = parsed.query.client_id || parsed.query.clientId || 'CLIENT_001';
      const [vehicleRows, pois, activeEwbs] = await Promise.all([
        sqAll(`SELECT v.vehicle_no, v.driver_name, v.munshi_name, v.vehicle_size,
                      g.latitude, g.longitude, g.gps_time, g.speed
               FROM vehicles v LEFT JOIN gps_current g ON g.vehicle_number = v.vehicle_no
               WHERE v.client_id = ?`, [cid]),
        sqAll(`SELECT id, poi_name, latitude, longitude, radius_meters, type FROM pois WHERE client_id=?`, [cid]),
        sqAll(`SELECT * FROM eway_bills_master WHERE client_id=? AND status='active'`, [cid]),
      ]);

      // If gps_current has no data, fall back to sync-db.json positions
      const hasGps = vehicleRows.some(r => r.latitude != null);
      if (!hasGps) {
        const fallbackVehicles = await getVehiclesFromSqlite(cid);
        const fallbackMap = {};
        // Also try sync-db.json
        const sdb = readDb();
        const key = resolveTenantKey(sdb, cid);
        const jsonVehicles = (sdb.vehiclesByTenant?.[key] || []);
        for (const jv of jsonVehicles) {
          const vno = jv.vehicle_number || jv.number || jv.vehicleNo || '';
          if (vno) fallbackMap[vno] = { latitude: jv.lat || jv.latitude, longitude: jv.lng || jv.longitude, gps_time: jv.lastUpdate || jv.gps_time, speed: jv.speed || 0 };
        }
        // Merge fallback GPS into vehicleRows
        vehicleRows.forEach(r => {
          if (r.latitude == null && fallbackMap[r.vehicle_no]) {
            const fb = fallbackMap[r.vehicle_no];
            r.latitude = fb.latitude; r.longitude = fb.longitude; r.gps_time = fb.gps_time; r.speed = fb.speed;
          }
        });
      }
      const ewbByVehicle = {};
      for (const e of activeEwbs) {
        const vno = (e.vehicle_no || '').trim();
        if (!ewbByVehicle[vno]) ewbByVehicle[vno] = [];
        ewbByVehicle[vno].push(e);
      }
      const result = vehicleRows.map(v => {
        const lat = v.latitude, lon = v.longitude;
        const currentPoi = findPoiForVehicle(lat, lon, pois);
        const poiType = currentPoi?.type || '';
        const vEwbs = ewbByVehicle[v.vehicle_no] || [];
        let load_status;
        if (currentPoi && poiType === 'primary') load_status = 'empty_at_loading';
        else if (currentPoi && ['secondary','tertiary','other'].includes(poiType) && vEwbs.length) load_status = 'unloading_at_delivery';
        else if (currentPoi && ['secondary','tertiary','other'].includes(poiType)) load_status = 'empty_at_delivery';
        else if (lat && lon) load_status = vEwbs.length ? 'in_transit_loaded' : 'in_transit_empty';
        else load_status = 'unknown';
        return { ...v, current_poi: currentPoi || null, current_poi_name: currentPoi?.poi_name || null,
          current_poi_type: poiType || null, load_status, active_ewbs: vEwbs, ewb_count: vEwbs.length, last_seen: v.gps_time };
      });
      return jsonResp(res, { vehicles: result });
    } catch(e) { return jsonResp(res, { vehicles: [], error: e.message }); }
  }

  // PATCH /api/eway-bills-hub/:id
  if (/^\/api\/eway-bills-hub\/\d+$/.test(pathname) && req.method === 'PATCH') {
    try {
      const billId = parseInt(pathname.split('/').pop());
      const body = await readBody(req);
      const allowed = ['munshi_id','munshi_name','status','matched_trip_id','notes','movement_type',
                       'vehicle_status','to_poi_id','to_poi_name','from_poi_id','from_poi_name','delivered_at'];
      const sets = {};
      for (const k of allowed) if (k in body) sets[k] = body[k];
      if (!Object.keys(sets).length) return jsonResp(res, { error: 'Nothing to update' }, 400);
      if (sets.status === 'delivered' && !sets.delivered_at)
        sets.delivered_at = new Date().toISOString().replace('T',' ').slice(0,19);
      const setClause = Object.keys(sets).map(k => `${k}=?`).join(', ');
      await sqRun(`UPDATE eway_bills_master SET ${setClause} WHERE id=?`, [...Object.values(sets), billId]);
      return jsonResp(res, { success: true });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // DELETE /api/eway-bills-hub/:id
  if (/^\/api\/eway-bills-hub\/\d+$/.test(pathname) && req.method === 'DELETE') {
    try {
      const billId = parseInt(pathname.split('/').pop());
      await sqRun('DELETE FROM eway_bills_master WHERE id=?', [billId]);
      return jsonResp(res, { success: true });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // POST /api/eway-bills-hub/reclassify
  if (pathname === '/api/eway-bills-hub/reclassify' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const cid = body.client_id || 'CLIENT_001';
      const [pois, bills] = await Promise.all([
        sqAll(`SELECT id, poi_name, city, type FROM pois WHERE client_id=?`, [cid]),
        sqAll(`SELECT * FROM eway_bills_master WHERE client_id=? AND movement_type='unclassified'`, [cid]),
      ]);
      let updated = 0;
      for (const bill of bills) {
        const fp = matchPoiByName(bill.from_trade_name, bill.from_place, bill.from_pincode, pois);
        const tp = matchPoiByName(bill.to_trade_name, bill.to_place, bill.to_pincode, pois);
        const mov = classifyMovement(fp, tp, bill.supply_type);
        await sqRun(`UPDATE eway_bills_master SET from_poi_id=?,from_poi_name=?,to_poi_id=?,to_poi_name=?,movement_type=? WHERE id=?`,
          [fp?.id||bill.from_poi_id, fp?.poi_name||bill.from_poi_name, tp?.id||bill.to_poi_id, tp?.poi_name||bill.to_poi_name, mov, bill.id]);
        updated++;
      }
      return jsonResp(res, { success: true, updated });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // POST /api/eway-bills-hub/rematch-pois
  if (pathname === '/api/eway-bills-hub/rematch-pois' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const cid = body.client_id || 'CLIENT_001';
      const allBills = !!body.all_bills;
      const sql = allBills
        ? `SELECT * FROM eway_bills_master WHERE client_id=?`
        : `SELECT * FROM eway_bills_master WHERE client_id=? AND (from_poi_id IS NULL OR to_poi_id IS NULL)`;
      const [pois, bills] = await Promise.all([
        sqAll(`SELECT id, poi_name, city, type FROM pois WHERE client_id=?`, [cid]),
        sqAll(sql, [cid]),
      ]);
      let updated = 0;
      for (const bill of bills) {
        const fp = matchPoiByName(bill.from_trade_name, bill.from_place, bill.from_pincode, pois) ||
                   (bill.from_poi_id ? null : null);
        const tp = matchPoiByName(bill.to_trade_name, bill.to_place, bill.to_pincode, pois);
        const newFromId = fp?.id ?? bill.from_poi_id;
        const newFromName = fp?.poi_name ?? bill.from_poi_name;
        const newToId = tp?.id ?? bill.to_poi_id;
        const newToName = tp?.poi_name ?? bill.to_poi_name;
        if (newFromId !== bill.from_poi_id || newToId !== bill.to_poi_id) {
          const mov = classifyMovement(fp || (bill.from_poi_id ? { id: bill.from_poi_id, type: null } : null),
                                        tp || (bill.to_poi_id ? { id: bill.to_poi_id, type: null } : null), bill.supply_type);
          await sqRun(`UPDATE eway_bills_master SET from_poi_id=?,from_poi_name=?,to_poi_id=?,to_poi_name=?,movement_type=? WHERE id=?`,
            [newFromId, newFromName, newToId, newToName, mov, bill.id]);
          updated++;
        }
      }
      return jsonResp(res, { success: true, updated, total: bills.length });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // POST /api/eway-bills-hub/deduplicate
  if (pathname === '/api/eway-bills-hub/deduplicate' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const cid = body.client_id || 'CLIENT_001';
      const dryRun = !!body.dry_run;
      const truncRows = await sqAll(
        `SELECT id, ewb_no, doc_no FROM eway_bills_master WHERE client_id=? AND ewb_no LIKE '%000000'`, [cid]);
      const truncDel = [];
      for (const row of truncRows) {
        if (row.doc_no) {
          const good = await sqAll(
            `SELECT id FROM eway_bills_master WHERE doc_no=? AND client_id=? AND ewb_no NOT LIKE '%000000' AND id != ?`,
            [row.doc_no, cid, row.id]);
          if (good.length) truncDel.push(row.id);
        } else { truncDel.push(row.id); }
      }
      const dupRows = await sqAll(
        `SELECT doc_no, COUNT(*) as cnt FROM eway_bills_master WHERE client_id=? AND doc_no IS NOT NULL GROUP BY doc_no HAVING cnt > 1`, [cid]);
      const dupDel = [];
      for (const row of dupRows) {
        const ids = await sqAll(`SELECT id FROM eway_bills_master WHERE doc_no=? AND client_id=? ORDER BY id ASC`, [row.doc_no, cid]);
        for (const r of ids.slice(0, -1)) if (!dupDel.includes(r.id)) dupDel.push(r.id);
      }
      const allDel = [...new Set([...truncDel, ...dupDel])];
      if (!dryRun && allDel.length) {
        await sqRun(`DELETE FROM eway_bills_master WHERE id IN (${allDel.map(()=>'?').join(',')})`, allDel);
      }
      return jsonResp(res, { success: true, dry_run: dryRun, truncated_removed: truncDel.length, doc_dup_removed: dupDel.length, total_removed: allDel.length });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // POST /api/eway-bills-hub/purge-all
  if (pathname === '/api/eway-bills-hub/purge-all' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (body.confirm !== 'PURGE') return jsonResp(res, { error: 'Send { "confirm": "PURGE" } to confirm deletion' }, 400);
      const cid = body.client_id || 'CLIENT_001';
      const result = await sqRun('DELETE FROM eway_bills_master WHERE client_id=?', [cid]);
      return jsonResp(res, { success: true, deleted: result.changes });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // GET /api/eway-bills-hub/unmatched-pois
  if (pathname === '/api/eway-bills-hub/unmatched-pois' && req.method === 'GET') {
    try {
      const cid = parsed.query.client_id || 'CLIENT_001';
      const threshold = Math.max(0, parseInt(parsed.query.threshold || '5'));
      const page    = Math.max(1, parseInt(parsed.query.page || '1'));
      const perPage = Math.min(100, parseInt(parsed.query.per_page || '25'));
      const [cntRows, bills, pois] = await Promise.all([
        sqAll(`SELECT COUNT(*) as cnt FROM eway_bills_master WHERE client_id=? AND (from_poi_id IS NULL OR to_poi_id IS NULL)`, [cid]),
        sqAll(`SELECT * FROM eway_bills_master WHERE client_id=? AND (from_poi_id IS NULL OR to_poi_id IS NULL)
               ORDER BY doc_date DESC, id DESC LIMIT ? OFFSET ?`, [cid, perPage, (page-1)*perPage]),
        sqAll(`SELECT id, poi_name, city, pin_code, type FROM pois WHERE client_id=?`, [cid]),
      ]);
      const norm = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
      function scoredSuggestions(tradeName, place, pincode) {
        const tn=norm(tradeName), pl=norm(place), pc=(pincode||'').replace(/\D/g,'');
        return pois.map(p => {
          const pn=norm(p.poi_name), pc2=(p.pin_code||'').replace(/\D/g,'');
          let score=0;
          if (tn && pn.includes(tn.slice(0,6))) score+=10;
          if (tn && tn.includes(pn.slice(0,6))) score+=8;
          if (pl && (pn.includes(pl)||pl.includes(pn.slice(0,4)))) score+=5;
          if (pc && pc2 && pc===pc2) score+=15;
          return { ...p, score };
        }).filter(p => p.score >= threshold).sort((a,b)=>b.score-a.score).slice(0,5);
      }
      for (const bill of bills) {
        bill.from_suggestions = !bill.from_poi_id ? scoredSuggestions(bill.from_trade_name, bill.from_place, bill.from_pincode) : [];
        bill.to_suggestions   = !bill.to_poi_id   ? scoredSuggestions(bill.to_trade_name,   bill.to_place,   bill.to_pincode)   : [];
      }
      return jsonResp(res, { bills, total: cntRows[0]?.cnt||0, page, per_page: perPage, threshold });
    } catch(e) { return jsonResp(res, { bills:[], total:0, error: e.message }); }
  }

  // GET /api/eway-bills-hub/suggest-pois
  if (pathname === '/api/eway-bills-hub/suggest-pois' && req.method === 'GET') {
    try {
      const cid = parsed.query.client_id || 'CLIENT_001';
      const q = (parsed.query.q || '').trim();
      const pin = (parsed.query.pin || '').trim();
      const poiType = (parsed.query.type || '').trim();
      let pois = await sqAll(`SELECT id, poi_name, city, pin_code, type FROM pois WHERE client_id=?`, [cid]);
      if (poiType) pois = pois.filter(p => (p.type||'').toLowerCase() === poiType.toLowerCase());
      if (q || pin) {
        const norm = s => (s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
        const tn = norm(q), pc = pin.replace(/\D/g,'');
        const scored = pois.map(p => {
          const pn=norm(p.poi_name), pc2=(p.pin_code||'').replace(/\D/g,'');
          let score=0;
          if (tn && pn.includes(tn.slice(0,4))) score+=10;
          if (tn && tn.includes(pn.slice(0,4))) score+=8;
          if (pc && pc2 && pc===pc2) score+=15;
          return { id:p.id, poi_name:p.poi_name, city:p.city, pin_code:p.pin_code, type:p.type, score };
        }).sort((a,b)=>b.score-a.score).slice(0,10);
        return jsonResp(res, { pois: scored });
      }
      return jsonResp(res, { pois: pois.slice(0,50).map(p=>({...p,score:0})) });
    } catch(e) { return jsonResp(res, { pois:[], error: e.message }); }
  }

  // POST /api/eway-bills-hub/create-poi
  if (pathname === '/api/eway-bills-hub/create-poi' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const cid = body.client_id || 'CLIENT_001';
      const poiName = (body.poi_name || '').trim();
      if (!poiName) return jsonResp(res, { error: 'poi_name required' }, 400);
      const existing = await sqAll(
        `SELECT id, poi_name, city, pin_code, type FROM pois WHERE LOWER(poi_name)=LOWER(?) AND client_id=?`, [poiName, cid]);
      if (existing.length) return jsonResp(res, { success: true, poi: existing[0], created: false });
      await sqRun(`INSERT INTO pois (poi_name, city, pin_code, type, client_id) VALUES (?,?,?,?,?)`,
        [poiName, (body.city||'').trim(), (body.pin_code||'').trim(), body.type||'secondary', cid]);
      const [row] = await sqAll(`SELECT id, poi_name, city, pin_code, type FROM pois WHERE LOWER(poi_name)=LOWER(?) AND client_id=?`, [poiName, cid]);
      return jsonResp(res, { success: true, poi: row, created: true });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
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

  // POST /api/ledger/munshi/:id/salary
  if (/^\/api\/ledger\/munshi\/\d+\/salary$/.test(pathname) && req.method === 'POST') {
    const mId = pathname.split('/')[4];
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run('INSERT INTO munshi_ledger (munshi_id, munshi_name, trip_date, settlement, notes, settlement_status) VALUES (?,?,?,?,?,?)',
      [mId, body.munshi_name||'', body.entry_date||new Date().toISOString().split('T')[0], body.amount||0, body.notes||'', body.entry_type||'salary'],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true, id: this.lastID })); });
    return;
  }

  // GET /api/ledger/driver
  if (pathname === '/api/ledger/driver' && req.method === 'GET') {
    try {
      const rows = await sqAll('SELECT * FROM driver_ledger ORDER BY trip_date DESC, created_at DESC', []);
      return jsonResp(res, rows);
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ error: e.message })); }
  }

  // DELETE /api/ledger/driver/entry/:id
  if (/^\/api\/ledger\/driver\/entry\/\d+$/.test(pathname) && req.method === 'DELETE') {
    const entryId = pathname.split('/').pop();
    try {
      const rows = await sqAll('SELECT * FROM driver_ledger WHERE id=?', [entryId]);
      if (!rows.length) { res.statusCode = 404; return res.end(JSON.stringify({ error: 'Entry not found' })); }
      await sqRun('DELETE FROM driver_ledger WHERE id=?', [entryId]);
      return jsonResp(res, { success: true, deleted_trips: rows[0].trip_id ? [rows[0].trip_id] : [] });
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ error: e.message })); }
  }

  // GET /api/ledger/munshi  (optionally ?munshiId=N)
  if (pathname === '/api/ledger/munshi' && req.method === 'GET') {
    try {
      const munshiId = parsed.query.munshiId || parsed.query.munshi_id;
      const rows = munshiId
        ? await sqAll('SELECT * FROM munshi_ledger WHERE munshi_id=? ORDER BY trip_date DESC, created_at DESC', [munshiId])
        : await sqAll('SELECT * FROM munshi_ledger ORDER BY trip_date DESC, created_at DESC', []);
      return jsonResp(res, rows);
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ error: e.message })); }
  }

  // DELETE /api/ledger/munshi/entry/:id
  if (/^\/api\/ledger\/munshi\/entry\/\d+$/.test(pathname) && req.method === 'DELETE') {
    const entryId = pathname.split('/').pop();
    try {
      const rows = await sqAll('SELECT * FROM munshi_ledger WHERE id=?', [entryId]);
      if (!rows.length) { res.statusCode = 404; return res.end(JSON.stringify({ error: 'Entry not found' })); }
      await sqRun('DELETE FROM munshi_ledger WHERE id=?', [entryId]);
      return jsonResp(res, { success: true, deleted_trips: rows[0].trip_id ? [rows[0].trip_id] : [] });
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ error: e.message })); }
  }

  // GET /api/ledger/vehicle
  if (pathname === '/api/ledger/vehicle' && req.method === 'GET') {
    try {
      const rows = await sqAll('SELECT * FROM vehicle_ledger ORDER BY trip_date DESC, created_at DESC', []);
      return jsonResp(res, rows);
    } catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ error: e.message })); }
  }


  if (pathname === '/api/eway-bills-hub/delivery-by-poi' && req.method === 'GET') {
    try {
      const cid      = parsed.query.client_id || 'CLIENT_001';
      const statusF  = parsed.query.status   || 'all';
      const poiTypeF = parsed.query.poi_type || 'all';
      const VALID_TYPES = new Set(['primary','secondary','tertiary','other','warehouse']);
      // Build WHERE clauses using parameterised queries only
      const where = ['e.client_id = ?', 'e.to_poi_id IS NOT NULL'];
      const params = [cid];
      if (statusF === 'pending')   { where.push("(e.delivered_at IS NULL OR e.delivered_at = '')"); }
      else if (statusF === 'delivered') { where.push("e.delivered_at IS NOT NULL AND e.delivered_at != ''"); }
      if (poiTypeF !== 'all' && VALID_TYPES.has(poiTypeF)) { where.push('tp.type = ?'); params.push(poiTypeF); }
      const bills = await sqAll(`
        SELECT e.id, e.ewb_no, e.doc_date, e.vehicle_no, e.total_value,
               e.delivered_at, e.munshi_name,
               e.to_poi_id, tp.poi_name as to_poi_name, tp.type as to_poi_type, tp.city as to_city,
               e.from_poi_id, fp.poi_name as from_poi_name, v.vehicle_size
        FROM eway_bills_master e
        LEFT JOIN pois tp ON CAST(tp.id AS TEXT) = CAST(e.to_poi_id AS TEXT)
        LEFT JOIN pois fp ON CAST(fp.id AS TEXT) = CAST(e.from_poi_id AS TEXT)
        LEFT JOIN vehicles v ON v.vehicle_no = e.vehicle_no AND v.client_id = e.client_id
        WHERE ${where.join(' AND ')}
        ORDER BY e.to_poi_id, e.doc_date DESC`, params);
      const poiMap = {};
      for (const b of bills) {
        const pid = String(b.to_poi_id);
        if (!poiMap[pid]) poiMap[pid] = { poi_id: pid, poi_name: b.to_poi_name || '(unknown)',
          poi_type: b.to_poi_type || 'other', city: b.to_city || '', total: 0, delivered: 0, pending: 0, bills: [] };
        poiMap[pid].total++;
        if (b.delivered_at) poiMap[pid].delivered++; else poiMap[pid].pending++;
        poiMap[pid].bills.push({ id: b.id, ewb_no: b.ewb_no, doc_date: b.doc_date,
          vehicle_no: b.vehicle_no, vehicle_size: b.vehicle_size, munshi_name: b.munshi_name,
          total_value: b.total_value, delivered_at: b.delivered_at, from_poi_name: b.from_poi_name || '' });
      }
      const result = Object.values(poiMap).sort((a, b) => b.total - a.total);
      return jsonResp(res, { pois: result, total_bills: bills.length });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // ─── /api/ewb/* — Live EWB management (local DB backed) ─────────────────

  // GET /api/ewb/active-list
  if (pathname === '/api/ewb/active-list' && req.method === 'GET') {
    try {
      const cid = parsed.query.client_id || 'CLIENT_001';
      const rows = await sqAll(`
        SELECT id, ewb_no, doc_no, doc_date, vehicle_no, from_trade_name, to_trade_name,
               from_place, to_place, from_poi_name, to_poi_name, valid_upto, status,
               movement_type, distance_km, total_value, munshi_name, delivered_at,
               notes, imported_at
        FROM eway_bills_master WHERE client_id=? AND ewb_no IS NOT NULL AND ewb_no != ''
        ORDER BY imported_at DESC LIMIT 1000`, [cid]);
      const now = new Date();
      const result = rows.map(r => {
        const validUpto = r.valid_upto ? new Date(r.valid_upto) : null;
        const hoursLeft = validUpto ? (validUpto - now) / 3600000 : null;
        const is_expired = validUpto ? validUpto < now : false;
        const expiring_soon = !is_expired && hoursLeft != null && hoursLeft <= 24;
        return { ...r, hours_left: hoursLeft != null ? Math.round(hoursLeft) : null, is_expired, expiring_soon };
      });
      return jsonResp(res, result);
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // POST /api/ewb/sync-last-days
  if (pathname === '/api/ewb/sync-last-days' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const cid = body.client_id || 'CLIENT_001';
      const days = parseInt(body.days) || 5;
      const since = new Date(); since.setDate(since.getDate() - days); since.setHours(0,0,0,0);
      const sinceStr = since.toISOString().slice(0, 10);
      const rows = await sqAll(`SELECT COUNT(*) as c FROM eway_bills_master WHERE client_id=? AND (doc_date >= ? OR imported_at >= ?)`, [cid, sinceStr, sinceStr]);
      return jsonResp(res, { synced: rows[0]?.c || 0, since: sinceStr, status: 'ok' });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // POST /api/ewb/sync-this-month
  if (pathname === '/api/ewb/sync-this-month' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const cid = body.client_id || 'CLIENT_001';
      const since = new Date(); since.setDate(1); since.setHours(0,0,0,0);
      const sinceStr = since.toISOString().slice(0, 10);
      const rows = await sqAll(`SELECT COUNT(*) as c FROM eway_bills_master WHERE client_id=? AND (doc_date >= ? OR imported_at >= ?)`, [cid, sinceStr, sinceStr]);
      return jsonResp(res, { synced: rows[0]?.c || 0, since: sinceStr, status: 'ok' });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // GET /api/ewb/details/:no
  if (pathname.startsWith('/api/ewb/details/') && req.method === 'GET') {
    try {
      const ewbNo = decodeURIComponent(pathname.replace('/api/ewb/details/', '').trim());
      if (!ewbNo) return jsonResp(res, { status: 'error', message: 'EWB number required' }, 400);
      const cid = parsed.query.client_id || 'CLIENT_001';
      const rows = await sqAll(`SELECT * FROM eway_bills_master WHERE (ewb_no=? OR ewb_number=?) AND client_id=? LIMIT 1`, [ewbNo, ewbNo, cid]);
      if (!rows.length) return jsonResp(res, { status: 'error', message: `EWB ${ewbNo} not found` });
      const r = rows[0];
      const validUpto = r.valid_upto ? new Date(r.valid_upto) : null;
      const now = new Date();
      const hoursLeft = validUpto ? (validUpto - now) / 3600000 : null;
      return jsonResp(res, { status: 'ok', data: { ...r, hours_left: hoursLeft != null ? Math.round(hoursLeft) : null, is_expired: validUpto ? validUpto < now : false } });
    } catch(e) { return jsonResp(res, { status: 'error', message: e.message }, 500); }
  }

  // POST /api/ewb/fetch-from-nic — returns local DB records for given date
  if (pathname === '/api/ewb/fetch-from-nic' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const cid = body.client_id || 'CLIENT_001';
      // Accept dd/mm/yyyy or yyyy-mm-dd
      const rawDate = (body.date || '');
      const dateStr = rawDate.match(/^\d{2}\/\d{2}\/\d{4}$/)
        ? rawDate.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')
        : rawDate;
      let rows;
      if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        rows = await sqAll(`SELECT * FROM eway_bills_master WHERE client_id=? AND doc_date=?`, [cid, dateStr]);
      } else {
        rows = await sqAll(`SELECT * FROM eway_bills_master WHERE client_id=? ORDER BY imported_at DESC LIMIT 100`, [cid]);
      }
      return jsonResp(res, { status: 'ok', fetched: rows.length, new_in_master: 0, message: 'Returned from local DB' });
    } catch(e) { return jsonResp(res, { status: 'error', message: e.message }, 500); }
  }

  // POST /api/ewb/extend-validity — extend EWB validity in local DB
  if (pathname === '/api/ewb/extend-validity' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { ewb_no, from_place } = body;
      if (!ewb_no) return jsonResp(res, { status: 'error', message: 'ewb_no required' }, 400);
      if (!from_place) return jsonResp(res, { status: 'error', message: 'from_place required' }, 400);
      const km = parseInt(body.remaining_distance) || 100;
      const extraDays = Math.max(1, Math.ceil(km / 250));
      const rows = await sqAll(`SELECT valid_upto FROM eway_bills_master WHERE ewb_no=? LIMIT 1`, [ewb_no]);
      const base = rows.length && rows[0].valid_upto ? new Date(rows[0].valid_upto) : new Date();
      if (base < new Date()) base.setTime(Date.now());
      base.setDate(base.getDate() + extraDays);
      const newValidity = base.toISOString().slice(0, 19).replace('T', ' ');
      await sqRun(`UPDATE eway_bills_master SET valid_upto=?, updated_at=CURRENT_TIMESTAMP WHERE ewb_no=?`, [newValidity, ewb_no]);
      return jsonResp(res, { status: 'success', new_validity: newValidity, extended_days: extraDays });
    } catch(e) { return jsonResp(res, { status: 'error', message: e.message }, 500); }
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

  } catch (err) {
    console.error('[server] unhandled request error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal server error' }));
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sync server listening on http://0.0.0.0:${PORT}`);

  // Seed SQLite from seed_data.json if DB is empty (Railway ephemeral filesystem)
  seedSqliteIfEmpty();

  // ── Server-side auto-sync scheduler ────────────────────────────────────
  // Reads all known tenantIds from the JSON db and from env CLIENT*_ID vars,
  // then calls the sync logic every 2 minutes so GPS data stays fresh on all pages.
  const AUTO_SYNC_INTERVAL_MS = parseInt(process.env.AUTO_SYNC_INTERVAL_MS || '120000'); // 2 min default
  if (PROVIDER_API_URL) {
    async function runAutoSync() {
      const db = readDb();
      // Collect tenant IDs from stored db + env vars
      const tenantIds = new Set(Object.keys(db.vehiclesByTenant || {}));
      for (let i = 1; i <= 10; i++) {
        const id = process.env[`CLIENT${i}_ID`] || process.env[`CLIENT${i}_TENANT_ID`];
        if (id) tenantIds.add(id);
      }
      // Always include CLIENT_001 as fallback
      tenantIds.add(process.env.CLIENT_ID || process.env.TENANT_ID || 'CLIENT_001');

      for (const tenantId of tenantIds) {
        try {
          const sep = PROVIDER_API_URL.includes('?') ? '&' : '?';
          const fetchUrl = PROVIDER_API_URL + (PROVIDER_API_URL.includes('tenantId') ? '' : `${sep}tenantId=${encodeURIComponent(tenantId)}`);
          const fetchOpts = { headers: {} };
          if (PROVIDER_API_KEY) fetchOpts.headers['Authorization'] = `Bearer ${PROVIDER_API_KEY}`;
          const r = await fetch(fetchUrl, fetchOpts);
          if (!r.ok) { console.error(`[AutoSync] provider ${r.status} for ${tenantId} — url: ${fetchUrl}`); continue; }
          const data = await r.json();
          // Robust extraction matching /api/sync extractArray logic
          function extractAutoArr(obj) {
            if (!obj) return [];
            if (Array.isArray(obj)) return obj;
            if (Array.isArray(obj.list)) return obj.list;
            if (Array.isArray(obj.vehicles)) return obj.vehicles;
            if (Array.isArray(obj.data)) return obj.data;
            if (obj.data && Array.isArray(obj.data.list)) return obj.data.list;
            if (obj.data && Array.isArray(obj.data.vehicles)) return obj.data.vehicles;
            if (obj.data && Array.isArray(obj.data.data)) return obj.data.data;
            if (obj.list && typeof obj.list === 'object') { const vals = Object.values(obj.list); if (vals.length && typeof vals[0] === 'object') return vals; }
            if (obj.data && typeof obj.data === 'object') { const vals = Object.values(obj.data); if (vals.length && typeof vals[0] === 'object') return vals; }
            return [];
          }
          const arr = extractAutoArr(data);
          if (!arr.length) { console.warn(`[AutoSync] ${tenantId}: provider returned 0 items — keys:`, Object.keys(data || {})); continue; }
          const freshDb = readDb();
          const key = resolveTenantKey(freshDb, tenantId);
          if (!freshDb.vehiclesByTenant) freshDb.vehiclesByTenant = {};
          freshDb.vehiclesByTenant[key] = arr.map(v => ({ ...v, _syncedAt: new Date().toISOString() }));
          writeDb(freshDb);
          // Also write live positions to gps_current table so dashboard shows fresh data
          await upsertGpsCurrent(arr, tenantId).catch(e => console.error('[AutoSync] upsertGps:', e.message));
          await appendGpsLiveData(arr, tenantId).catch(e => console.error('[AutoSync] appendGpsLive:', e.message));
          console.log(`[AutoSync] ${key}: ${arr.length} vehicles → gps_current updated`);
        } catch (e) {
          console.error(`[AutoSync] ${tenantId}:`, e.message);
        }
      }
    }
    // Delay first run by 8s so seed has time to finish, then run on interval
    setTimeout(() => { runAutoSync(); setInterval(runAutoSync, AUTO_SYNC_INTERVAL_MS); }, 8000);
    console.log(`[AutoSync] Scheduler started — every ${AUTO_SYNC_INTERVAL_MS / 1000}s`);
  } else {
    console.warn('[AutoSync] PROVIDER_API_URL not set — auto-sync disabled');
  }
});
