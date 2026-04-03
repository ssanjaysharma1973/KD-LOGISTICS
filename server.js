import http from 'http';
import fs from 'fs';
import url from 'url';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { generateToken, verifyToken, extractToken, validateCredentials, TENANTS } from './src/auth/jwtUtils.js';
import auditLogger from './src/middleware/auditLogger.js';
import masterKeyAuth from './src/middleware/masterKeyAuth.js';
import excelExport from './src/services/excelExport.js';
import exportScheduler from './src/services/exportScheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[SERVER-STARTUP] PID=' + process.pid + ' cwd=' + process.cwd() + ' version=v3-deploy-test build=' + new Date().toISOString());

// Initialize audit logging system
const { logAuth, logDataRead, logDataWrite, logCrossTenantAttempt, logUnauthorizedAccess } = auditLogger;
const { requireMasterApiKey, extractClientIdFromQuery } = masterKeyAuth;
const { exportEwayBillsToExcel, generateExportFilename } = excelExport;
const { getRecentExports, downloadExport, getSchedulerStatus } = exportScheduler;

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
  const p = new URL('.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
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
// Use /data/ directory on Railway (persistent Volume) — fallback to ./ for local dev
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH
  || (fs.existsSync('/data') ? '/data/fleet_erp_backend_sqlite.db' : './fleet_erp_backend_sqlite.db');
// Ensure the directory exists (Railway Volume or local)
try { require('fs').mkdirSync(require('path').dirname(SQLITE_DB_PATH), { recursive: true }); } catch(_) {}
console.log('[DB] SQLite path:', SQLITE_DB_PATH);
const SEED_PATH = path.join(__dirname, 'seed_data.json');
// Persistent EWB backup — survives redeploys if /data volume exists
const EWB_BACKUP_PATH = fs.existsSync('/data') ? '/data/ewb_backup.json' : null;

// ── Per-Tenant Database Path Resolution ────────────────────────────────────
// Phase 6: Each tenant gets their own SQLite database file for maximum isolation
function getTenantDbPath(tenantId) {
  if (!tenantId) {
    // Fallback to global DB if no tenant specified (for legacy/system functions)
    return SQLITE_DB_PATH;
  }
  // Per-tenant DB: /data/client_001.db, /data/client_002.db, etc.
  const dataDir = fs.existsSync('/data') ? '/data' : '.';
  const dbPath = path.join(dataDir, `client_${tenantId}.db`);
  // Ensure data directory exists
  try { require('fs').mkdirSync(dataDir, { recursive: true }); } catch(_) {}
  return dbPath;
}

// ── Module-level SQLite helpers (used by seed, backup, and EWB schedulers) ──
function sqAll(sql, params = [], dbPath = SQLITE_DB_PATH) {
  return new Promise((resolve, reject) => {
    if (!sqlite3) return reject(new Error('sqlite3 unavailable'));
    const db2 = new sqlite3.Database(dbPath);
    db2.all(sql, params, (err, rows) => { db2.close(); err ? reject(err) : resolve(rows || []); });
  });
}
function sqRun(sql, params = [], dbPath = SQLITE_DB_PATH) {
  return new Promise((resolve, reject) => {
    if (!sqlite3) return reject(new Error('sqlite3 unavailable'));
    const db2 = new sqlite3.Database(dbPath);
    db2.run(sql, params, function(err) { db2.close(); err ? reject(err) : resolve(this); });
  });
}

// Write all EWBs from DB to /data/ewb_backup.json (called after every import)
async function writeEwbBackup() {
  if (!EWB_BACKUP_PATH || !sqlite3) return;
  try {
    // Note: This backup includes ALL clients' EWBs for system-wide backup/recovery
    // For production, consider separating backups per tenant
    const rows = await sqAll('SELECT * FROM eway_bills_master ORDER BY imported_at DESC LIMIT 10000', []);
    fs.writeFileSync(EWB_BACKUP_PATH, JSON.stringify(rows));
    console.log(`[EWB Backup] Wrote ${rows.length} EWBs to ${EWB_BACKUP_PATH}`);
  } catch(e) { console.warn('[EWB Backup] Write failed:', e.message); }
}

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
        longitude REAL, city TEXT, address TEXT, radius_meters INTEGER DEFAULT 500, type TEXT DEFAULT 'primary',
        pin_code TEXT, state TEXT, munshi_id INTEGER, munshi_name TEXT)`);
      // Migrate existing pois tables that are missing the newer columns
      for (const col of [
        'pin_code TEXT', 'state TEXT', 'munshi_id INTEGER', 'munshi_name TEXT',
      ]) {
        await dbRun(`ALTER TABLE pois ADD COLUMN ${col}`).catch(() => {});
      }
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
      // One-time: reset non-numeric / null munshi PINs to default '1234'
      await dbRun(`UPDATE munshis SET pin='1234' WHERE pin IS NULL OR TRIM(pin)='' OR CAST(pin AS INTEGER)=0 AND LENGTH(pin)>0`).catch(() => {});
      await dbRun(`ALTER TABLE poi_unloading_rates_v2 ADD COLUMN updated_at TEXT`).catch(() => {});
      await dbRun(`ALTER TABLE pois ADD COLUMN munshi_id TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE pois ADD COLUMN munshi_name TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE pois ADD COLUMN state TEXT DEFAULT ''`).catch(() => {});
      await dbRun(`ALTER TABLE pois ADD COLUMN pin_code TEXT DEFAULT ''`).catch(() => {});
      // ── Munshi Trip Expenses table ───────────────────────────────────────────
      await dbRun(`CREATE TABLE IF NOT EXISTS munshi_trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT DEFAULT 'CLIENT_001',
        trip_no TEXT,
        vehicle_no TEXT,
        driver_name TEXT,
        from_poi_id TEXT, from_poi_name TEXT,
        to_poi_id TEXT,   to_poi_name TEXT,
        ewb_no TEXT,
        ewb_is_temp INTEGER DEFAULT 0,
        trip_date TEXT,
        km REAL DEFAULT 0,
        toll REAL DEFAULT 0,
        exp_admin REAL DEFAULT 0,
        exp_munshi REAL DEFAULT 0,
        exp_pump_consignment REAL DEFAULT 0,
        exp_cash_fuel REAL DEFAULT 0,
        exp_unloading REAL DEFAULT 0,
        exp_driver_debit REAL DEFAULT 0,
        exp_other REAL DEFAULT 0,
        munshi_id TEXT, munshi_name TEXT,
        driver_id TEXT,
        approved_by TEXT,
        status TEXT DEFAULT 'open',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`).catch(() => {});
      await dbRun(`ALTER TABLE munshi_trips ADD COLUMN ewb_nos TEXT DEFAULT '[]'`).catch(() => {});
      await dbRun(`ALTER TABLE munshi_trips ADD COLUMN process_step TEXT DEFAULT 'loading'`).catch(() => {});
      await dbRun(`CREATE TABLE IF NOT EXISTS driver_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT DEFAULT 'CLIENT_001',
        vehicle_no TEXT,
        driver_name TEXT,
        issue_type TEXT,
        description TEXT,
        status TEXT DEFAULT 'open',
        admin_reply TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`).catch(() => {});
      await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_poi_unloading_v2_unique ON poi_unloading_rates_v2(client_id, poi_id)`).catch(() => {});

      // Auto-dedup eway_bills_master by ewb_no (keep lowest id) then enforce unique index
      try {
        const ewbDups = await sqAll(`SELECT ewb_no FROM eway_bills_master GROUP BY client_id, ewb_no HAVING COUNT(*) > 1`);
        if (ewbDups.length > 0) {
          console.log(`[Init] Removing ${ewbDups.length} duplicate EWB groups...`);
          await dbRun('BEGIN');
          for (const row of ewbDups) {
            await dbRun(`DELETE FROM eway_bills_master WHERE ewb_no=? AND id NOT IN (SELECT MIN(id) FROM eway_bills_master WHERE ewb_no=?)`, [row.ewb_no, row.ewb_no]).catch(() => {});
          }
          await dbRun('COMMIT');
        }
        await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ewbm_client_ewbno ON eway_bills_master(client_id, ewb_no)`).catch(() => {});
      } catch(e) { console.warn('[Init] EWB dedup skipped:', e.message); }

      // Seed pois if empty
      // Seed POIs — always upsert by (client_id, poi_name) so new entries from export survive redeploy
      const seedPois = seed.pois || [];
      if (seedPois.length > 0) {
        console.log(`[Seed] Upserting ${seedPois.length} seed POIs...`);
        await dbRun('BEGIN');
        for (const p of seedPois)
          await dbRun(
            `INSERT INTO pois (client_id,poi_name,latitude,longitude,city,address,radius_meters,type,pin_code,state,munshi_id,munshi_name)
             SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS
               (SELECT 1 FROM pois WHERE client_id=? AND LOWER(TRIM(poi_name))=LOWER(TRIM(?)))`,
            [p.client_id||'CLIENT_001', p.poi_name, p.latitude||0, p.longitude||0,
             p.city||'', p.address||'', p.radius_meters||500, p.type||'primary',
             p.pin_code||'', p.state||'', p.munshi_id||null, p.munshi_name||'',
             p.client_id||'CLIENT_001', p.poi_name]
          ).catch(() => {});
        await dbRun('COMMIT');
      }

      // Seed vehicles — always upsert by (client_id, vehicle_no)
      const seedVehicles = seed.vehicles || [];
      if (seedVehicles.length > 0) {
        console.log(`[Seed] Upserting ${seedVehicles.length} seed vehicles...`);
        await dbRun('BEGIN');
        for (const v of seedVehicles) {
          const vno = (v.vehicle_no||v.vehicle_number||'').toUpperCase().replace(/\s/g,'');
          if (!vno) continue;
          await dbRun(
            `INSERT INTO vehicles (client_id,vehicle_no,vehicle_type,vehicle_size,owner_name,driver_name,phone,notes,
               fuel_type,munshi_id,munshi_name,driver_id,primary_poi_ids,standard_route_no,route_from,route_to,city,driver_pin)
             SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS
               (SELECT 1 FROM vehicles WHERE client_id=? AND vehicle_no=?)`,
            [v.client_id||'CLIENT_001', vno, v.vehicle_type||'', v.vehicle_size||'',
             v.owner_name||'', v.driver_name||'', v.phone||'', v.notes||'',
             v.fuel_type||'', v.munshi_id||null, v.munshi_name||'', v.driver_id||null,
             v.primary_poi_ids||null, v.standard_route_no||null, v.route_from||'', v.route_to||'', v.city||'',
             v.driver_pin||'',
             v.client_id||'CLIENT_001', vno]
          ).catch(() => {});
        }
        await dbRun('COMMIT');
      }

      // Seed munshis — always upsert by (client_id, name)
      const seedMunshis = seed.munshis || [];
      if (seedMunshis.length > 0) {
        console.log(`[Seed] Upserting ${seedMunshis.length} seed munshis...`);
        await dbRun('BEGIN');
        for (const m of seedMunshis)
          await dbRun(
            `INSERT INTO munshis (client_id,name,phone,email,primary_poi_ids,notes,balance,area,region,pin,monthly_salary,approval_limit)
             SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS
               (SELECT 1 FROM munshis WHERE client_id=? AND LOWER(TRIM(name))=LOWER(TRIM(?)))`,
            [m.client_id||'CLIENT_001', m.name||'', m.phone||'', m.email||'',
             m.primary_poi_ids||'[]', m.notes||'', m.balance||0,
             m.area||'', m.region||'', m.pin||'', m.monthly_salary||0, m.approval_limit||0,
             m.client_id||'CLIENT_001', m.name||'']
          ).catch(() => {});
        await dbRun('COMMIT');
      }

      // Seed fuel_type_rates — upsert (has UNIQUE constraint on client_id+fuel_type)
      const seedFtr = seed.fuel_type_rates || [];
      if (seedFtr.length > 0) {
        console.log(`[Seed] Upserting ${seedFtr.length} fuel type rates...`);
        await dbRun('BEGIN');
        for (const f of seedFtr)
          await dbRun(`INSERT OR IGNORE INTO fuel_type_rates (client_id, fuel_type, cost_per_liter, updated_at) VALUES (?,?,?,?)`,
            [f.client_id||'CLIENT_001', f.fuel_type||'', f.cost_per_liter||0, f.updated_at||new Date().toISOString()]);
        await dbRun('COMMIT');
      }

      // Seed eway_bills_master — always upsert by (client_id, ewb_no)
      const seedEwbs = seed.eway_bills || [];
      if (seedEwbs.length > 0) {
        console.log(`[Seed] Upserting ${seedEwbs.length} EWBs...`);
        await dbRun('BEGIN');
        for (const e of seedEwbs)
          await dbRun(
            `INSERT INTO eway_bills_master
              (client_id,ewb_no,doc_no,doc_date,vehicle_no,from_place,to_place,from_poi_id,from_poi_name,
               to_poi_id,to_poi_name,from_trade_name,to_trade_name,from_pincode,to_pincode,total_value,
               valid_upto,status,movement_type,supply_type,transport_mode,distance_km,
               munshi_id,munshi_name,matched_trip_id,vehicle_status,delivered_at,notes,imported_at,validity_days,ewb_number)
             SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS
               (SELECT 1 FROM eway_bills_master WHERE client_id=? AND ewb_no=?)`,
            [e.client_id||'CLIENT_001',e.ewb_no||'',e.doc_no||'',e.doc_date||'',e.vehicle_no||'',
             e.from_place||'',e.to_place||'',e.from_poi_id||null,e.from_poi_name||'',
             e.to_poi_id||null,e.to_poi_name||'',e.from_trade_name||'',e.to_trade_name||'',
             e.from_pincode||'',e.to_pincode||'',e.total_value||0,e.valid_upto||'',
             e.status||'active',e.movement_type||'unclassified',e.supply_type||'',
             e.transport_mode||'Road',e.distance_km||0,e.munshi_id||'',e.munshi_name||'',
             e.matched_trip_id||null,e.vehicle_status||'',e.delivered_at||null,e.notes||'',
             e.imported_at||new Date().toISOString(),e.validity_days||0,e.ewb_number||e.ewb_no||'',
             e.client_id||'CLIENT_001',e.ewb_no||'']
          ).catch(() => {});
        await dbRun('COMMIT');
      }

      // Restore from /data/ewb_backup.json if it exists (safety net for redeploys before volume was set up)
      const ewbBackupPath = '/data/ewb_backup.json';
      if (fs.existsSync(ewbBackupPath)) {
        try {
          const backupEwbs = JSON.parse(fs.readFileSync(ewbBackupPath, 'utf8'));
          if (Array.isArray(backupEwbs) && backupEwbs.length > 0) {
            console.log(`[Seed] Restoring ${backupEwbs.length} EWBs from /data/ewb_backup.json...`);
            await dbRun('BEGIN');
            for (const e of backupEwbs) {
              await dbRun(
                `INSERT OR IGNORE INTO eway_bills_master
                  (client_id,ewb_no,ewb_number,doc_no,vehicle_no,from_place,to_place,from_poi_id,from_poi_name,
                   to_poi_id,to_poi_name,from_trade_name,to_trade_name,from_pincode,to_pincode,total_value,
                   doc_date,valid_upto,status,movement_type,supply_type,transport_mode,distance_km,
                   munshi_id,munshi_name,validity_days,imported_at,updated_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [e.client_id||'CLIENT_001',e.ewb_no||'',e.ewb_number||e.ewb_no||'',e.doc_no||'',
                 e.vehicle_no||'',e.from_place||'',e.to_place||'',
                 e.from_poi_id||null,e.from_poi_name||'',e.to_poi_id||null,e.to_poi_name||'',
                 e.from_trade_name||'',e.to_trade_name||'',e.from_pincode||'',e.to_pincode||'',
                 e.total_value||0,e.doc_date||'',e.valid_upto||'',e.status||'active',
                 e.movement_type||'unclassified',e.supply_type||'',e.transport_mode||'Road',e.distance_km||0,
                 e.munshi_id||'',e.munshi_name||'',e.validity_days||0,
                 e.imported_at||new Date().toISOString(),e.updated_at||new Date().toISOString()]
              ).catch(() => {});
            }
            await dbRun('COMMIT');
            console.log('[Seed] EWB backup restore complete');
          }
        } catch(e) { console.warn('[Seed] EWB backup restore failed:', e.message); }
      }

      // Seed munshi_trips — always upsert by (client_id, trip_no)
      const seedTrips = seed.munshi_trips || [];
      if (seedTrips.length > 0) {
        console.log(`[Seed] Upserting ${seedTrips.length} munshi trips...`);
        await dbRun('BEGIN');
        for (const t of seedTrips)
          await dbRun(
            `INSERT INTO munshi_trips
              (client_id,trip_no,vehicle_no,driver_name,from_poi_id,from_poi_name,to_poi_id,to_poi_name,
               ewb_no,ewb_is_temp,trip_date,km,toll,exp_admin,exp_munshi,exp_pump_consignment,
               exp_cash_fuel,exp_unloading,exp_driver_debit,exp_other,munshi_id,munshi_name,
               driver_id,approved_by,status,notes,created_at,updated_at)
             SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS
               (SELECT 1 FROM munshi_trips WHERE client_id=? AND trip_no=?)`,
            [t.client_id||'CLIENT_001',t.trip_no||'',t.vehicle_no||'',t.driver_name||'',
             t.from_poi_id||null,t.from_poi_name||'',t.to_poi_id||null,t.to_poi_name||'',
             t.ewb_no||'',t.ewb_is_temp||0,t.trip_date||'',t.km||0,t.toll||0,
             t.exp_admin||0,t.exp_munshi||0,t.exp_pump_consignment||0,
             t.exp_cash_fuel||0,t.exp_unloading||0,t.exp_driver_debit||0,t.exp_other||0,
             t.munshi_id||'',t.munshi_name||'',t.driver_id||'',t.approved_by||'',
             t.status||'open',t.notes||'',t.created_at||new Date().toISOString(),t.updated_at||new Date().toISOString(),
             t.client_id||'CLIENT_001',t.trip_no||'']
          ).catch(() => {});
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
      // Use global DB path to ensure tables exist (seed creates all tables here)
      const dbPath = SQLITE_DB_PATH;
      const db2 = new sqlite3.Database(dbPath);
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
      // Use global DB path to ensure tables exist (seed creates all tables here)
      const dbPath = SQLITE_DB_PATH;
      const db2 = new sqlite3.Database(dbPath);
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
    if (!sqlite3) {
      resolve([]);
      return;
    }
    
    try {
      const dbPath = getTenantDbPath(tenantId);
      if (!fs.existsSync(dbPath)) {
        resolve([]);
        return;
      }
      
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
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
  // Log every incoming request
  console.log(`[HTTP] ${req.method} ${req.url} from ${req.headers.host}`);
  
  // ── Healthcheck – sync, outside async handler ─────────────────────────────
  const rawPath = (url.parse(req.url || '/', true).pathname || '/').replace(/\/+$/g, '') || '/';
  if (rawPath === '/health' || rawPath === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', ts: Date.now(), sqlite: !!sqlite3, v: 4, build: 'ewb-import-fix' }));
  }
  // Delegate everything else to async handler
  handleRequest(req, res, rawPath).catch(err => {
    console.error('[server] unhandled error in handleRequest:', err.message || err);
    console.error('[server] error stack:', err.stack || 'no stack');
    console.error('[server] headers sent?', res.headersSent);
    if (!res.headersSent) { 
      res.writeHead(500, { 'Content-Type': 'application/json' }); 
      res.end(JSON.stringify({ error: 'Internal Server Error', details: err.message })); 
    }
  });
});

async function handleRequest(req, res, rawPath) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[HTTP-${requestId}] START ${req.method} ${rawPath}`);
  
  // Add response timeout
  const timeout = setTimeout(() => {
    console.error(`[HTTP-${requestId}] TIMEOUT after 30s - forcing close`);
    if (!res.headersSent) {
      res.writeHead(503);
      res.end('Request timeout');
    } else {
      res.destroy();
    }
  }, 30000);
  
  res.on('finish', () => {
    clearTimeout(timeout);
    const elapsed = Date.now() - startTime;
    console.log(`[HTTP-${requestId}] END ${res.statusCode} (${elapsed}ms)`);
  });

  try {
  const parsed = url.parse(req.url, true);
  // normalize pathname by stripping trailing slashes so routes match consistently
  const pathname = rawPath;
  // enable simple CORS for local dashboard
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Tenant-ID, Authorization');
  if (req.method === 'OPTIONS') return res.end();

  // ── JWT Authentication endpoint ────────────────────────────────────────────
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { email, password } = body;

      if (!email || !password) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        logUnauthorizedAccess('UNKNOWN', pathname, 'POST', 'Missing credentials', { email: email || 'unknown' });
        return res.end(JSON.stringify({ error: 'email and password required' }));
      }

      // Validate credentials against tenant config
      const user = validateCredentials(email, password);
      if (!user) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        logAuth(false, email, 'UNKNOWN', { reason: 'Invalid credentials' });
        return res.end(JSON.stringify({ error: 'Invalid credentials' }));
      }

      // Generate JWT token
      const tokenData = generateToken({
        userId: user.userId,
        email: user.email,
        clientId: user.clientId,
        name: user.name,
        isAdmin: user.isAdmin,
      });

      console.log(`[Auth] Login successful: ${email} for ${user.clientId}`);
      // AUDIT: Log successful authentication
      logAuth(true, email, user.clientId, { userId: user.userId, name: user.name });
      
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        ok: true,
        token: tokenData.token,
        expiresIn: tokenData.expiresIn,
        user: {
          id: user.userId,
          email: user.email,
          name: user.name,
          clientId: user.clientId,
          isAdmin: user.isAdmin,
        },
      }));
    } catch (err) {
      console.error('[Auth] Login error:', err.message);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Login failed' }));
    }
  }

  // ── JWT Token verification helper ──────────────────────────────────────────
  // Extract and verify JWT from Authorization header
  const authHeader = req.headers.authorization || '';
  
  // Skip JWT validation for Master Key authentication
  const isMasterKeyAuth = authHeader.startsWith('MasterKey ');
  
  const token = !isMasterKeyAuth ? extractToken(authHeader) : null;
  const jwtPayload = token ? verifyToken(token) : null;
  
  // If Authorization header is present but invalid, reject (skip if Master Key auth)
  if (authHeader && !isMasterKeyAuth && !jwtPayload) {
    // Allow public endpoints without auth (e-way bill read endpoints)
    const publicEndpoints = [
      '/api/health', '/api/updates',
      '/api/eway-bills-hub', '/api/eway-bills-hub/summary', '/api/eway-bills-hub/active-list',
      '/api/eway-bills-hub/vehicle-movement', '/api/eway-bills-hub/warnings',
      '/api/eway-bills-hub/unmatched-pois', '/api/eway-bills-hub/suggest-pois'
    ];
    if (!publicEndpoints.includes(pathname)) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Invalid or expired token' }));
    }
  }

  // Inject tenantId from JWT (takes precedence over query/header)
  // For now we still allow query params for backward compat, but JWT is preferred
  const tenantIdFromJwt = jwtPayload?.clientId;
  const tenantIdParam = parsed.query.tenantId || req.headers['x-tenant-id'];
  const resolvedTenantId = tenantIdFromJwt || tenantIdParam;

  // ── Row-Level Security Middleware ─────────────────────────────────────────
  // Enforce that clientId in request matches JWT clientId (if JWT present)
  // Prevents unauthorized cross-tenant data access
  async function enforceClientId(requestBody) {
    if (!jwtPayload) {
      // No JWT: allow legacy query-param based access (for backward compatibility)
      return true;
    }
    
    // JWT present: enforce client_id match
    const requestClientId = requestBody?.client_id || requestBody?.clientId || tenantIdParam;
    const jwtClientId = jwtPayload.clientId;
    
    if (requestClientId && requestClientId !== jwtClientId) {
      // Mismatch: user trying to access another tenant's data
      // ⚠️  SECURITY EVENT: Log cross-tenant access attempt
      logCrossTenantAttempt(requestClientId, jwtClientId, jwtPayload.userId, jwtPayload.email, pathname, {
        requestBody: JSON.stringify(requestBody).substring(0, 200),
        method: req.method,
      });
      
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Forbidden: clientId mismatch',
        detail: `Request clientId '${requestClientId}' does not match JWT clientId '${jwtClientId}'`
      }));
      return false;
    }
    
    return true;
  }

  // Server-Sent Events subscription: clients can connect to receive live updates
  if (pathname === '/api/updates' && req.method === 'GET') {
    const tenantId = resolvedTenantId || null;
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

  // GET /api/admin/export-seed — exports all current data as seed_data.json format
  // Use this to snapshot live Railway data before redeploying
  if (pathname === '/api/admin/export-seed' && req.method === 'GET') {
    try {
      const [pois, vehicles, munshis, eway_bills, fuel_type_rates, munshi_trips] = await Promise.all([
        sqAll('SELECT * FROM pois WHERE client_id=? ORDER BY id', ['CLIENT_001']),
        sqAll('SELECT * FROM vehicles WHERE client_id=? ORDER BY id', ['CLIENT_001']),
        sqAll('SELECT * FROM munshis WHERE client_id=? ORDER BY id', ['CLIENT_001']),
        sqAll('SELECT * FROM eway_bills_master WHERE client_id=? ORDER BY id', ['CLIENT_001']),
        sqAll('SELECT * FROM fuel_type_rates WHERE client_id=? ORDER BY id', ['CLIENT_001']),
        sqAll('SELECT * FROM munshi_trips WHERE client_id=? ORDER BY id', ['CLIENT_001']),
      ]);
      const payload = { pois, vehicles, munshis, eway_bills, fuel_type_rates, munshi_trips, exported_at: new Date().toISOString() };
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="seed_data_export.json"');
      return res.end(JSON.stringify(payload, null, 2));
    } catch (e) {
      return jsonResp(res, { error: e.message }, 500);
    }
  }

  // GET /api/pois
  if (pathname === '/api/pois' && req.method === 'GET') {
    const clientId = parsed.query.clientId || parsed.query.client_id || 'CLIENT_001';
    return sqliteJson(res, 'SELECT * FROM pois WHERE client_id=? ORDER BY poi_name', [clientId], null);
  }

  // POST /api/pois
  if (pathname === '/api/pois' && req.method === 'POST') {
    const body = await readBody(req);
    if (!await enforceClientId(body)) return;
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const clientId = jwtPayload?.clientId || body.clientId || 'CLIENT_001';
    db2.run(
      'INSERT INTO pois (client_id,poi_name,latitude,longitude,city,address,radius_meters,type,state,pin_code,munshi_id,munshi_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [clientId, body.poi_name, body.latitude, body.longitude, body.city||'', body.address||'', body.radius_meters||500, body.type||'primary', body.state||'', body.pin_code||'', body.munshi_id||'', body.munshi_name||''],
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
    if (!await enforceClientId(body)) return;
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const clientId = jwtPayload?.clientId;
    // Ensure update only affects records belonging to the JWT clientId
    db2.run('UPDATE pois SET poi_name=?,latitude=?,longitude=?,city=?,address=?,radius_meters=?,type=?,state=?,pin_code=?,munshi_id=?,munshi_name=? WHERE id=? AND client_id=?',
      [body.poi_name, body.latitude, body.longitude, body.city||'', body.address||'', body.radius_meters||500, body.type||'primary', body.state||'', body.pin_code||'', body.munshi_id||'', body.munshi_name||'', poiId, clientId],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); 
        if (err) return res.end(JSON.stringify({ error: err.message }));
        if (this.changes === 0) return res.statusCode = 404, res.end(JSON.stringify({ error: 'POI not found or unauthorized' }));
        res.end(JSON.stringify({ success: true }));
      });
    return;
  }

  // DELETE /api/pois/:id
  if (/^\/api\/pois\/\d+$/.test(pathname) && req.method === 'DELETE') {
    const poiId = pathname.split('/').pop();
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const clientId = jwtPayload?.clientId;
    if (!clientId) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'Unauthorized' })); }
    // Ensure delete only affects records belonging to the JWT clientId
    db2.run('DELETE FROM pois WHERE id=? AND client_id=?', [poiId, clientId], function(err) { 
      db2.close(); res.setHeader('Content-Type','application/json');
      if (err) return res.end(JSON.stringify({ error: err.message }));
      if (this.changes === 0) return res.statusCode = 404, res.end(JSON.stringify({ error: 'POI not found or unauthorized' }));
      res.end(JSON.stringify({ success: true }));
    });
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
    if (!await enforceClientId(body)) return;
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const clientId = jwtPayload?.clientId || body.client_id || 'CLIENT_001';
    db2.run('INSERT OR REPLACE INTO vehicles (vehicle_no, client_id, driver_name, vehicle_size) VALUES (?,?,?,?)',
      [body.vehicle_no || body.vehicle_reg_no, clientId, body.driver_name||'', body.type||body.vehicle_size||''],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true, id: this.lastID })); });
    return;
  }

  // PUT /api/vehicles-master/:id
  if (/^\/api\/vehicles-master\/[^/]+$/.test(pathname) && req.method === 'PUT') {
    const vId = decodeURIComponent(pathname.split('/').pop());
    const body = await readBody(req);
    if (!await enforceClientId(body)) return;
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const clientId = jwtPayload?.clientId;
    // Ensure update only affects vehicles belonging to the JWT clientId
    db2.run('UPDATE vehicles SET driver_name=?, vehicle_size=?, driver_id=?, munshi_id=?, munshi_name=?, fuel_type=?, kmpl=?, fuel_cost_per_liter=?, driver_pin=? WHERE (vehicle_no=? OR id=?) AND client_id=?',
      [body.driver_name||'', body.type||body.vehicle_size||'', body.driver_id||null, body.munshi_id||null, body.munshi_name||null, body.fuel_type||null, body.kmpl!=null?body.kmpl:null, body.fuel_cost_per_liter!=null?body.fuel_cost_per_liter:null, body.driver_pin||'', vId, vId, clientId],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); 
        if (err) return res.end(JSON.stringify({ error: err.message }));
        if (this.changes === 0) return res.statusCode = 404, res.end(JSON.stringify({ error: 'Vehicle not found or unauthorized' }));
        res.end(JSON.stringify({ success: true }));
      });
    return;
  }

  // PUT /api/vehicles-master/:id/fuel-rate (bulk fuel rate set)
  if (/^\/api\/vehicles-master\/[^/]+\/fuel-rate$/.test(pathname) && req.method === 'PUT') {
    const vId = decodeURIComponent(pathname.split('/').slice(-2)[0]);
    const body = await readBody(req);
    if (!await enforceClientId(body)) return;
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const clientId = jwtPayload?.clientId;
    // Ensure update only affects vehicles belonging to the JWT clientId
    db2.run('UPDATE vehicles SET kmpl=?, fuel_cost_per_liter=? WHERE (vehicle_no=? OR id=?) AND client_id=?',
      [body.kmpl != null ? body.kmpl : null, body.fuel_cost_per_liter != null ? body.fuel_cost_per_liter : null, vId, vId, clientId],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); 
        if (err) return res.end(JSON.stringify({ error: err.message }));
        if (this.changes === 0) return res.statusCode = 404, res.end(JSON.stringify({ error: 'Vehicle not found or unauthorized' }));
        res.end(JSON.stringify({ success: true }));
      });
    return;
  }

  // DELETE /api/vehicles-master/:id
  if (/^\/api\/vehicles-master\/[^/]+$/.test(pathname) && req.method === 'DELETE') {
    const vId = decodeURIComponent(pathname.split('/').pop());
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const clientId = jwtPayload?.clientId;
    if (!clientId) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'Unauthorized' })); }
    // Ensure delete only affects vehicles belonging to the JWT clientId
    db2.run('DELETE FROM vehicles WHERE (vehicle_no=? OR id=?) AND client_id=?', [vId, vId, clientId],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); 
        if (err) return res.end(JSON.stringify({ error: err.message }));
        if (this.changes === 0) return res.statusCode = 404, res.end(JSON.stringify({ error: 'Vehicle not found or unauthorized' }));
        res.end(JSON.stringify({ success: true }));
      });
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
    if (!await enforceClientId(body)) return;
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const clientId = jwtPayload?.clientId || body.client_id || 'CLIENT_001';
    db2.run('INSERT INTO drivers (name, phone, client_id) VALUES (?,?,?)',
      [body.driver_name||body.name||'', body.phone||'', clientId],
      function(err) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(err ? { error: err.message } : { success: true, id: this.lastID })); });
    return;
  }

  // DELETE /api/drivers/:id
  if (/^\/api\/drivers\/\d+$/.test(pathname) && req.method === 'DELETE') {
    const dId = pathname.split('/').pop();
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const clientId = jwtPayload?.clientId;
    if (!clientId) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'Unauthorized' })); }
    db2.run('DELETE FROM drivers WHERE id=? AND client_id=?', [dId, clientId], function(err) { db2.close(); res.setHeader('Content-Type','application/json'); 
      if (err) return res.end(JSON.stringify({ error: err.message }));
      if (this.changes === 0) return res.statusCode = 404, res.end(JSON.stringify({ error: 'Driver not found or unauthorized' }));
      res.end(JSON.stringify({ success: true }));
    });
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
    if (!await enforceClientId(body)) return;
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const clientId = jwtPayload?.clientId || body.client_id || 'CLIENT_001';
    db2.run('INSERT INTO munshis (name, phone, client_id) VALUES (?,?,?)',
      [body.name||'', body.phone||'', clientId],
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
    if (!await enforceClientId(body)) return;
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const rows = Array.isArray(body) ? body : (body.rates || []);
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const clientId = jwtPayload?.clientId || body.client_id || 'CLIENT_001';
    let done = 0;
    if (!rows.length) { db2.close(); res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({ success: true, updated: 0 })); }
    rows.forEach(row => {
      db2.run(`INSERT INTO poi_unloading_rates_v2 (client_id,poi_id,category_1_32ft_34ft,category_2_22ft_24ft,category_3_small,notes,updated_at)
               VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
               ON CONFLICT(client_id,poi_id) DO UPDATE SET category_1_32ft_34ft=excluded.category_1_32ft_34ft, category_2_22ft_24ft=excluded.category_2_22ft_24ft, category_3_small=excluded.category_3_small, notes=excluded.notes, updated_at=CURRENT_TIMESTAMP`,
        [clientId, row.poi_id, row.category_1_32ft_34ft||0, row.category_2_22ft_24ft||0, row.category_3_small||0, row.notes||''],
        () => { if (++done === rows.length) { db2.close(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({ success: true, updated: done })); } }
      );
    });
    return;
  }

  // GET /api/ewaybills
  if (pathname === '/api/ewaybills' && req.method === 'GET') {
    const clientId = parsed.query.clientId || parsed.query.client_id || 'CLIENT_001';
    const status   = parsed.query.status   || '';
    const fromPoi  = parsed.query.from_poi_id || '';
    const toPoi    = parsed.query.to_poi_id   || '';
    let sql = 'SELECT * FROM eway_bills_master WHERE client_id=?';
    const params = [clientId];
    if (status)  { sql += ' AND status=?';       params.push(status);  }
    if (fromPoi) { sql += ' AND from_poi_id=?';  params.push(fromPoi); }
    if (toPoi)   { sql += ' AND to_poi_id=?';    params.push(toPoi);   }
    sql += ' ORDER BY imported_at DESC LIMIT 500';
    return sqliteJson(res, sql, params, rows => ({ ewaybills: rows }));
  }

  // POST /api/ewaybills
  if (pathname === '/api/ewaybills' && req.method === 'POST') {
    const body = await readBody(req);
    if (!await enforceClientId(body)) return;
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const clientId = jwtPayload?.clientId || body.client_id || 'CLIENT_001';
    db2.run(`INSERT INTO eway_bills_master (client_id,vehicle_no,ewb_no,total_value,from_place,to_place,doc_date,status,notes,transport_mode,distance_km)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [clientId, body.vehicle_number||body.vehicle_no||'', body.ewb_number||body.ewb_no||'', body.consignment_value||body.total_value||0, body.from_location||body.from_place||'', body.to_location||body.to_place||'', body.issue_date||body.doc_date||'', 'active', body.notes||'', body.transport_mode||'Road', body.distance_km||0],
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

  // PUT /api/ewaybills/:id/close — mark as delivered
  if (/^\/api\/ewaybills\/[^/]+\/close$/.test(pathname) && req.method === 'PUT') {
    const ewbId = pathname.split('/')[3];
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.run("UPDATE eway_bills_master SET status='delivered', delivered_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=? OR ewb_no=?",
      [ewbId, ewbId],
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

  // ── Munshi Trips (expense-based) ─────────────────────────────────────────
  // GET /api/munshi-trips
  if (pathname === '/api/munshi-trips' && req.method === 'GET') {
    const cid      = parsed.query.clientId || 'CLIENT_001';
    const munshiId = parsed.query.munshiId || '';
    const vno      = parsed.query.vehicle_no || '';
    let sql = 'SELECT * FROM munshi_trips WHERE client_id=?';
    const p = [cid];
    if (munshiId) { sql += ' AND munshi_id=?'; p.push(munshiId); }
    if (vno)      { sql += ' AND vehicle_no=?'; p.push(vno); }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    return sqliteJson(res, sql, p, null);
  }

  // POST /api/munshi-trips
  if (pathname === '/api/munshi-trips' && req.method === 'POST') {
    const b = await readBody(req);
    if (!sqlite3) { res.statusCode=503; return res.end(JSON.stringify({error:'db unavailable'})); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const tripNo = b.trip_no || (() => {
      const ds = new Date().toISOString().slice(0,10).replace(/-/g,'');
      return `T${ds}${String(Math.floor(Math.random()*9000)+1000)}`;
    })();
    const _ewbNosArr = Array.isArray(b.ewb_nos) ? b.ewb_nos : [];
    const _ewbNo     = _ewbNosArr[0] || b.ewb_no || '';
    const _ewbNosJson = JSON.stringify(_ewbNosArr.length > 0 ? _ewbNosArr : (_ewbNo ? [_ewbNo] : []));
    db2.run(`INSERT INTO munshi_trips
      (client_id,trip_no,vehicle_no,driver_name,from_poi_id,from_poi_name,to_poi_id,to_poi_name,
       ewb_no,ewb_is_temp,trip_date,km,toll,exp_admin,exp_munshi,exp_pump_consignment,exp_cash_fuel,
       exp_unloading,exp_driver_debit,exp_other,munshi_id,munshi_name,driver_id,approved_by,status,notes,ewb_nos,process_step)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.client_id||'CLIENT_001', tripNo, b.vehicle_no||'', b.driver_name||'',
       b.from_poi_id||'', b.from_poi_name||'', b.to_poi_id||'', b.to_poi_name||'',
       _ewbNo, b.ewb_is_temp||0,
       b.trip_date||new Date().toISOString().slice(0,10),
       b.km||0, b.toll||0,
       b.exp_admin||0, b.exp_munshi||0, b.exp_pump_consignment||0, b.exp_cash_fuel||0,
       b.exp_unloading||0, b.exp_driver_debit||0, b.exp_other||0,
       b.munshi_id||'', b.munshi_name||'', b.driver_id||'', b.approved_by||'',
       b.status||'open', b.notes||'', _ewbNosJson, b.process_step||'loading'],
      function(err) {
        db2.close();
        if (err) { res.statusCode=500; return res.end(JSON.stringify({error:err.message})); }
        res.setHeader('Content-Type','application/json');
        res.end(JSON.stringify({ success:true, id:this.lastID, trip_no:tripNo }));
      }
    );
    return;
  }

  // PUT /api/munshi-trips/:id
  if (/^\/api\/munshi-trips\/\d+$/.test(pathname) && req.method === 'PUT') {
    const id = pathname.split('/').pop();
    const b  = await readBody(req);
    if (!sqlite3) { res.statusCode=503; return res.end(JSON.stringify({error:'db unavailable'})); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    const allowed = ['vehicle_no','driver_name','from_poi_id','from_poi_name','to_poi_id','to_poi_name',
      'ewb_no','ewb_is_temp','trip_date','km','toll','exp_admin','exp_munshi','exp_pump_consignment',
      'exp_cash_fuel','exp_unloading','exp_driver_debit','exp_other','munshi_name','approved_by','status','notes','process_step'];
    const sets=[], vals=[];
    allowed.forEach(k => { if (b[k] !== undefined) { sets.push(`${k}=?`); vals.push(b[k]); }});
    if (b.ewb_nos !== undefined) {
      const _arr = Array.isArray(b.ewb_nos) ? b.ewb_nos : [];
      sets.push('ewb_nos=?'); vals.push(JSON.stringify(_arr));
      if (_arr.length > 0 && b.ewb_no === undefined) { sets.push('ewb_no=?'); vals.push(_arr[0]); }
    }
    sets.push('updated_at=CURRENT_TIMESTAMP');
    vals.push(id);
    db2.run(`UPDATE munshi_trips SET ${sets.join(',')} WHERE id=?`, vals, function(err) {
      db2.close();
      res.setHeader('Content-Type','application/json');
      res.end(JSON.stringify(err ? {error:err.message} : {success:true}));
    });
    return;
  }

  // GET /api/munshi-trips/ewb-download-csv — download EWBs as CSV, vehicle-wise
  if (pathname === '/api/munshi-trips/ewb-download-csv' && req.method === 'GET') {
    const cid     = parsed.query.clientId || 'CLIENT_001';
    const rawVnos = parsed.query.vehicle_nos || '';
    const vnos    = rawVnos.split(',').map(s => s.trim()).filter(Boolean);
    if (!vnos.length) { res.statusCode = 400; res.setHeader('Content-Type','text/plain'); return res.end('vehicle_nos required'); }
    const ph = vnos.map(() => '?').join(',');
    db.all(
      `SELECT ewb_no, vehicle_no, from_poi_name, from_place, to_poi_name, to_place, doc_date, valid_upto, total_value, status, movement_type, supply_type, doc_no
       FROM eway_bills_master WHERE client_id=? AND vehicle_no IN (${ph})
       ORDER BY vehicle_no, doc_date DESC LIMIT 1000`,
      [cid, ...vnos],
      (err, rows) => {
        if (err) { res.statusCode = 500; res.setHeader('Content-Type','text/plain'); return res.end('DB error'); }
        const fname = vnos.length === 1 ? `EWB_${vnos[0]}.csv` : `EWB_vehicles.csv`;
        const cols = ['EWB No','Vehicle No','Doc No','From','From Place','To','To Place','Date','Valid Upto','Value (₹)','Status','Movement','Supply Type'];
        const esc = v => `"${String(v||'').replace(/"/g,'""')}"`;
        const lines = [cols.join(',')];
        (rows||[]).forEach(r => {
          lines.push([
            esc(r.ewb_no), esc(r.vehicle_no), esc(r.doc_no),
            esc(r.from_poi_name), esc(r.from_place),
            esc(r.to_poi_name), esc(r.to_place),
            esc(r.doc_date), esc(r.valid_upto),
            esc(r.total_value), esc(r.status),
            esc(r.movement_type), esc(r.supply_type)
          ].join(','));
        });
        const csv = lines.join('\r\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
        res.end('\uFEFF' + csv); // BOM for Excel compatibility
      }
    );
    return;
  }

  // GET /api/munshi-trips/all-ewbs — batch fetch EWBs for multiple vehicles at once
  if (pathname === '/api/munshi-trips/all-ewbs' && req.method === 'GET') {
    const cid      = parsed.query.clientId || 'CLIENT_001';
    const rawVnos  = parsed.query.vehicle_nos || '';
    const vnos     = rawVnos.split(',').map(s => s.trim()).filter(Boolean);
    if (!vnos.length) { res.setHeader('Content-Type','application/json'); return res.end('[]'); }
    const ph = vnos.map(() => '?').join(',');
    return sqliteJson(res,
      `SELECT id, ewb_no, vehicle_no, to_place, to_poi_name, from_poi_name, doc_date, total_value, status, movement_type
       FROM eway_bills_master WHERE client_id=? AND vehicle_no IN (${ph})
         AND (status NOT IN ('cancelled') OR date(doc_date) >= date('now','-30 days'))
       ORDER BY CASE WHEN status NOT IN ('delivered','cancelled') THEN 0 ELSE 1 END, doc_date DESC LIMIT 300`,
      [cid, ...vnos], null);
  }

  // GET /api/munshi-trips/ewb-search — find EWBs for a vehicle or munshi POI (from+to direction)
  if (pathname === '/api/munshi-trips/ewb-search' && req.method === 'GET') {
    const cid    = parsed.query.clientId || 'CLIENT_001';
    const vno    = parsed.query.vehicle_no || '';
    const rawPoi = parsed.query.poi_ids || '';
    const poiIds = rawPoi.split(',').map(s => s.trim()).filter(Boolean);
    if (poiIds.length > 0) {
      const ph = poiIds.map(() => '?').join(',');
      // params: CASE WHEN list (poiIds), client_id, from IN (poiIds), to IN (poiIds)
      const params = [...poiIds, cid, ...poiIds, ...poiIds];
      return sqliteJson(res,
        `SELECT id, ewb_no, vehicle_no, to_place, to_poi_id, to_poi_name, from_poi_id, from_poi_name,
                doc_date, total_value, status, movement_type,
                CASE WHEN from_poi_id IN (${ph}) THEN 'outbound' ELSE 'inbound' END AS direction
         FROM eway_bills_master
         WHERE client_id=? AND (from_poi_id IN (${ph}) OR to_poi_id IN (${ph}))
           AND status NOT IN ('cancelled','delivered')
         ORDER BY doc_date DESC LIMIT 100`,
        params, null);
    }
    return sqliteJson(res,
      `SELECT id, ewb_no, vehicle_no, to_place, to_poi_name, from_poi_name, doc_date, total_value, status, movement_type
       FROM eway_bills_master WHERE client_id=? AND vehicle_no=?
         AND (status NOT IN ('cancelled') OR date(doc_date) >= date('now','-60 days'))
       ORDER BY CASE WHEN status NOT IN ('delivered','cancelled') THEN 0 ELSE 1 END, doc_date DESC LIMIT 50`,
      [cid, vno], null);
  }

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

  // POST /api/driver/report
  if (pathname === '/api/driver/report' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const vno = (body.vehicle_no || '').toUpperCase().trim();
      if (!vno) return jsonResp(res, { error: 'vehicle_no required' }, 400);
      if (!body.description || !body.description.trim()) return jsonResp(res, { error: 'description required' }, 400);
      const now = new Date().toISOString();
      await sqRun(
        `INSERT INTO driver_reports (client_id, vehicle_no, driver_name, issue_type, description, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
        [body.client_id||'CLIENT_001', vno, body.driver_name||'', body.issue_type||'Other', body.description.trim(), 'open', now, now]
      );
      return jsonResp(res, { success: true });
    } catch (e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // GET /api/driver/reports
  if (pathname === '/api/driver/reports' && req.method === 'GET') {
    try {
      const vno = (parsed.query.vehicle_no || '').toUpperCase().trim();
      const cid = parsed.query.client_id || 'CLIENT_001';
      const rows = vno
        ? await sqAll('SELECT * FROM driver_reports WHERE client_id=? AND vehicle_no=? ORDER BY created_at DESC LIMIT 50', [cid, vno])
        : await sqAll('SELECT * FROM driver_reports WHERE client_id=? ORDER BY created_at DESC LIMIT 200', [cid]);
      return jsonResp(res, rows);
    } catch (e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // PUT /api/driver/reports/:id/reply — admin reply
  if (/^\/api\/driver\/reports\/\d+\/reply$/.test(pathname) && req.method === 'PUT') {
    try {
      const rId = pathname.split('/')[4];
      const body = await readBody(req);
      await sqRun('UPDATE driver_reports SET admin_reply=?, status=?, updated_at=? WHERE id=?',
        [body.admin_reply||'', body.status||'resolved', new Date().toISOString(), rId]);
      return jsonResp(res, { success: true });
    } catch (e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // POST /api/munshis/login
  if (pathname === '/api/munshis/login' && req.method === 'POST') {
    const body = await readBody(req);
    if (!sqlite3) { res.statusCode = 503; return res.end(JSON.stringify({ error: 'sqlite3 unavailable' })); }
    const db2 = new sqlite3.Database(SQLITE_DB_PATH);
    db2.get('SELECT id, name, phone, area, pin, primary_poi_ids FROM munshis WHERE pin=? AND client_id=?',
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
  // sqAll and sqRun are now defined at module level (see top of file)
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
  // Returns { poi, score } — threshold 5 for auto-create, 8 for confident match
  function matchPoiByName(tradeName, place, pincode, pois) {
    if (!tradeName && !place) return { poi: null, score: 0 };
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
    return { poi: bestScore >= 5 ? best : null, score: bestScore };
  }
  // Auto-create a POI if none matched; pushes into the pois cache array and returns the row
  async function autoCreatePoi(tradeName, place, pincode, type, pois) {
    const name = (tradeName || place || '').trim();
    if (!name) return null;
    // Exact name check (avoid duplicates within this import batch)
    const normName = name.toLowerCase().replace(/\s+/g, ' ');
    const dup = pois.find(p => (p.poi_name || '').toLowerCase().replace(/\s+/g, ' ') === normName);
    if (dup) return dup;
    try {
      const r = await sqRun(
        `INSERT INTO pois (client_id, poi_name, city, pin_code, type) VALUES (?,?,?,?,?)`,
        ['CLIENT_001', name, (place || '').trim(), (pincode || '').trim(), type || 'secondary']);
      const newPoi = { id: r.lastID, poi_name: name, city: (place||'').trim(), pin_code: (pincode||'').trim(), type: type||'secondary' };
      pois.push(newPoi); // update cache for subsequent rows
      return newPoi;
    } catch { return null; }
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

        // POI matching — auto-create if no confident match
        let { poi: fromPoi } = matchPoiByName(fromTrade, fromPlace, fromPin, pois);
        let { poi: toPoi }   = matchPoiByName(toTrade, toPlace, toPin, pois);
        if (!fromPoi && (fromTrade || fromPlace)) fromPoi = await autoCreatePoi(fromTrade, fromPlace, fromPin, 'primary', pois);
        if (!toPoi   && (toTrade   || toPlace))   toPoi   = await autoCreatePoi(toTrade, toPlace, toPin, 'secondary', pois);
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

      // Auto-backup all EWBs to /data/ewb_backup.json so they survive redeploys
      if (inserted > 0) writeEwbBackup().catch(() => {});

      return jsonResp(res, { success: true, inserted, updated, skipped, total: rows.length, message: `Imported ${inserted} EWBs from ${rows.length} rows. New POIs auto-created are visible in the Unmatched POIs tab if any needed review.` });
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
        where.push('(ewb_no LIKE ? OR vehicle_no LIKE ? OR from_place LIKE ? OR to_place LIKE ? OR from_trade_name LIKE ? OR to_trade_name LIKE ? OR doc_no LIKE ?)');
        const like = `%${search}%`;
        params.push(like, like, like, like, like, like, like);
      }
      const whereClause = where.join(' AND ');
      // De-duplicate by ewb_no at query time — keep the row with lowest id per (client_id, ewb_no)
      // OPTIMIZED: Filter by client_id in subquery to reduce result set scanned
      const dedupClause = `AND id IN (SELECT MIN(id) FROM eway_bills_master WHERE client_id = ? GROUP BY ewb_no)`;
      const countParams = [...params, cid], billParams = [...params, cid, perPage, (page - 1) * perPage];
      const [cntRows, bills] = await Promise.all([
        sqAll(`SELECT COUNT(*) as cnt FROM eway_bills_master WHERE ${whereClause} ${dedupClause}`, countParams),
        sqAll(`SELECT * FROM eway_bills_master WHERE ${whereClause} ${dedupClause} ORDER BY doc_date DESC, id DESC LIMIT ? OFFSET ?`, billParams),
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
      // Pre-build indices for efficient lookup (avoid O(n*m) loops)
      const ewbsByVehicle = {}, ewbsByVehicleAndPoi = {};
      for (const ewb of activeEwbs) {
        const vno = (ewb.vehicle_no || '').trim();
        if (!ewbsByVehicle[vno]) ewbsByVehicle[vno] = [];
        ewbsByVehicle[vno].push(ewb);
        const poiKey = `${vno}|${ewb.to_poi_id}`;
        ewbsByVehicleAndPoi[poiKey] = ewb;
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
      // Use pre-built indices for O(1) lookups
      for (const [vno, poi] of Object.entries(vehiclePoi)) {
        if ((poi.type || '') === 'primary') {
          const hasEwb = (ewbsByVehicle[vno] || []).some(e => (e.movement_type || '').startsWith('primary'));
          if (!hasEwb) alerts.push({ warning_type: 'vehicle_at_loading_no_ewb', severity: 'LOW', vehicle_no: vno, ewb_no: null,
            poi_name: poi.poi_name, message: `${vno} at "${poi.poi_name}" with no active outward EWB` });
        }
        if (['secondary','tertiary'].includes(poi.type || '')) {
          const poiKey = `${vno}|${poi.id}`;
          const matchEwb = ewbsByVehicleAndPoi[poiKey];
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
        sqAll(`SELECT * FROM eway_bills_master WHERE client_id=? AND status IN ('active','at_destination')`, [cid]),
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
      // GPS auto-flag: when vehicle is unloading AT its EWB destination POI → mark at_destination
      for (const v of result) {
        if (v.load_status === 'unloading_at_delivery' && v.current_poi && v.active_ewbs?.length) {
          const poiId = String(v.current_poi.id);
          for (const ewb of v.active_ewbs) {
            if (String(ewb.to_poi_id) === poiId && ewb.status === 'active') {
              sqRun(`UPDATE eway_bills_master SET status='at_destination', updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='active'`, [ewb.id]).catch(() => {});
              ewb.status = 'at_destination'; // update in-memory for this response
            }
          }
        }
      }
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
        sqAll(`SELECT id, poi_name, city, pin_code, type FROM pois WHERE client_id=?`, [cid]),
        sqAll(sql, [cid]),
      ]);
      let updated = 0;
      for (const bill of bills) {
        let { poi: fp } = matchPoiByName(bill.from_trade_name, bill.from_place, bill.from_pincode, pois);
        let { poi: tp } = matchPoiByName(bill.to_trade_name, bill.to_place, bill.to_pincode, pois);
        // Auto-create POIs for sides that still have no match
        if (!fp && !bill.from_poi_id && (bill.from_trade_name || bill.from_place))
          fp = await autoCreatePoi(bill.from_trade_name, bill.from_place, bill.from_pincode, 'primary', pois);
        if (!tp && !bill.to_poi_id && (bill.to_trade_name || bill.to_place))
          tp = await autoCreatePoi(bill.to_trade_name, bill.to_place, bill.to_pincode, 'secondary', pois);
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
      const truncDel = new Set();
      for (const row of truncRows) {
        if (row.doc_no) {
          const good = await sqAll(
            `SELECT id FROM eway_bills_master WHERE doc_no=? AND client_id=? AND ewb_no NOT LIKE '%000000' AND id != ?`,
            [row.doc_no, cid, row.id]);
          if (good.length) truncDel.add(row.id);
        } else { truncDel.add(row.id); }
      }
      const dupRows = await sqAll(
        `SELECT doc_no, COUNT(*) as cnt FROM eway_bills_master WHERE client_id=? AND doc_no IS NOT NULL GROUP BY doc_no HAVING cnt > 1`, [cid]);
      const dupDel = new Set();
      for (const row of dupRows) {
        const ids = await sqAll(`SELECT id FROM eway_bills_master WHERE doc_no=? AND client_id=? ORDER BY id ASC`, [row.doc_no, cid]);
        for (const r of ids.slice(0, -1)) dupDel.add(r.id);
      }
      // Also dedup by ewb_no — keep lowest id per (client_id, ewb_no)
      const ewbDupRows = await sqAll(
        `SELECT ewb_no, COUNT(*) as cnt FROM eway_bills_master WHERE client_id=? AND ewb_no IS NOT NULL AND ewb_no != '' GROUP BY ewb_no HAVING cnt > 1`, [cid]);
      const ewbDupDel = new Set();
      for (const row of ewbDupRows) {
        const ids = await sqAll(`SELECT id FROM eway_bills_master WHERE ewb_no=? AND client_id=? ORDER BY id ASC`, [row.ewb_no, cid]);
        for (const r of ids.slice(0, -1)) ewbDupDel.add(r.id);
      }
      const allDel = [...new Set([...truncDel, ...dupDel, ...ewbDupDel])];
      if (!dryRun && allDel.length) {
        await sqRun(`DELETE FROM eway_bills_master WHERE id IN (${allDel.map(()=>'?').join(',')})`, allDel);
        // After dedup, ensure unique index exists to prevent future duplicates
        await sqRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ewbm_client_ewbno ON eway_bills_master(client_id, ewb_no)`).catch(() => {});
      }
      return jsonResp(res, { success: true, dry_run: dryRun, truncated_removed: truncDel.size, doc_dup_removed: dupDel.size, ewb_dup_removed: ewbDupDel.size, total_removed: allDel.length });
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

  // POST /api/eway-bills-hub/purge-old — delete EWBs with doc_date before a given cutoff
  if (pathname === '/api/eway-bills-hub/purge-old' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (body.confirm !== 'DELETE_OLD') return jsonResp(res, { error: 'Send { "confirm": "DELETE_OLD", "before_date": "YYYY-MM-DD" }' }, 400);
      const cid = body.client_id || 'CLIENT_001';
      const beforeDate = body.before_date;
      if (!beforeDate || !/^\d{4}-\d{2}-\d{2}$/.test(beforeDate))
        return jsonResp(res, { error: 'before_date must be YYYY-MM-DD format' }, 400);
      const result = await sqRun(
        `DELETE FROM eway_bills_master WHERE client_id=? AND (doc_date < ? OR (doc_date IS NULL AND imported_at < ?))`,
        [cid, beforeDate, beforeDate]
      );
      return jsonResp(res, { success: true, deleted: result.changes, cutoff: beforeDate });
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

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTOMATED EXPORT ENDPOINTS (Master API Key Required)
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/eway-bills-hub/export/xlsx
  // Export e-way bills to Excel (supports master API key automation)
  if (pathname === '/api/eway-bills-hub/export/xlsx' && req.method === 'GET') {
    try {
      const clientId = parsed.query.client_id || parsed.query.clientId || (jwtPayload?.clientId) || 'CLIENT_001';
      const useAuth = parsed.query.auth !== 'false'; // Allow bypass with ?auth=false for JWT bearer tokens
      
      // Verify either JWT or Master API Key
      const hasJwt = jwtPayload && jwtPayload.clientId === clientId;
      const hasMasterKey = requireMasterApiKey(req, res);
      
      if (!hasJwt && !hasMasterKey) {
        // requireMasterApiKey already sent 401 response
        return;
      }

      // Query bills for the client
      const bills = await sqAll(
        `SELECT * FROM eway_bills_master WHERE client_id=? ORDER BY imported_at DESC LIMIT 10000`,
        [clientId]
      );

      console.log(`[Export] Generated ${bills.length} e-way bills for ${clientId}`);
      
      // Generate Excel buffer
      const buffer = await exportEwayBillsToExcel(bills, clientId);
      
      // AUDIT: Log data export
      logDataRead(clientId, jwtPayload?.userId || 'automation', jwtPayload?.email || 'master-key', 
                  pathname, 'GET', 'eway_bills_master', bills.length, { action: 'bulk_export_xlsx' });
      
      // Set response headers
      const filename = generateExportFilename(clientId, 'xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      
      return res.end(buffer);
    } catch(e) {
      console.error('[Export] Error:', e.message);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // GET /api/eway-bills-hub/export/csv
  // Export e-way bills to CSV
  if (pathname === '/api/eway-bills-hub/export/csv' && req.method === 'GET') {
    try {
      const clientId = parsed.query.client_id || parsed.query.clientId || (jwtPayload?.clientId) || 'CLIENT_001';
      
      // Verify JWT or Master API Key
      if (!jwtPayload && !requireMasterApiKey(req, res)) return;
      
      const bills = await sqAll(
        `SELECT ewb_no, doc_no, vehicle_no, from_place, to_place, total_value, status, munshi_name, valid_upto, notes 
         FROM eway_bills_master WHERE client_id=? ORDER BY imported_at DESC LIMIT 10000`,
        [clientId]
      );

      // Build CSV
      const headers = ['EWB No', 'Doc No', 'Vehicle No', 'From', 'To', 'Value', 'Status', 'Munshi', 'Valid Upto', 'Notes'];
      const rows = bills.map(b => [
        b.ewb_no || '', b.doc_no || '', b.vehicle_no || '', b.from_place || '', b.to_place || '',
        b.total_value || 0, b.status || '', b.munshi_name || '', b.valid_upto || '', b.notes || ''
      ]);
      
      const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
      const buffer = Buffer.from(csv, 'utf-8');
      
      const filename = generateExportFilename(clientId, 'csv');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      
      return res.end(buffer);
    } catch(e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  // GET /api/eway-bills-hub/export/recent
  // List recent export files
  if (pathname === '/api/eway-bills-hub/export/recent' && req.method === 'GET') {
    try {
      // Master key only
      if (!requireMasterApiKey(req, res)) return;
      
      const clientId = parsed.query.client_id || undefined;
      const limit = Math.min(parseInt(parsed.query.limit || '10'), 50);
      const recentExports = getRecentExports(clientId, limit);
      
      return jsonResp(res, {
        success: true,
        clientId: clientId || 'all',
        count: recentExports.length,
        exports: recentExports,
      });
    } catch(e) {
      res.statusCode = 500;
      return jsonResp(res, { error: e.message });
    }
  }

  // GET /api/eway-bills-hub/export/download/:filename
  // Download a specific export file
  if (/^\/api\/eway-bills-hub\/export\/download\/[^/]+$/.test(pathname) && req.method === 'GET') {
    try {
      // Master key only
      if (!requireMasterApiKey(req, res)) return;
      
      const filename = decodeURIComponent(pathname.split('/').pop());
      const buffer = downloadExport(filename);
      
      if (!buffer) {
        res.statusCode = 404;
        return jsonResp(res, { error: 'File not found' });
      }
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      
      return res.end(buffer);
    } catch(e) {
      res.statusCode = 500;
      return jsonResp(res, { error: e.message });
    }
  }

  // POST /api/eway-bills-hub/export/schedule
  // Configure automatic export scheduling
  if (pathname === '/api/eway-bills-hub/export/schedule' && req.method === 'POST') {
    try {
      // Master key only
      if (!requireMasterApiKey(req, res)) return;
      
      const body = await readBody(req);
      
      // Validate schedule parameters
      const interval = body.interval || 'daily'; // hourly, daily, weekly
      const hour = Math.max(0, Math.min(23, body.hour || 2));
      const clients = body.clients || 'auto';
      
      if (!['hourly', 'daily', 'weekly'].includes(interval)) {
        res.statusCode = 400;
        return jsonResp(res, { error: 'interval must be: hourly, daily, or weekly' });
      }
      
      const status = getSchedulerStatus();
      
      return jsonResp(res, {
        success: true,
        message: `Export scheduler configured: ${interval} @ ${hour}:00`,
        scheduled: {
          interval,
          hour,
          clients,
        },
        status,
      });
    } catch(e) {
      res.statusCode = 500;
      return jsonResp(res, { error: e.message });
    }
  }

  // GET /api/eway-bills-hub/export/status
  // Get export scheduler status
  if (pathname === '/api/eway-bills-hub/export/status' && req.method === 'GET') {
    try {
      // Master key only
      if (!requireMasterApiKey(req, res)) return;
      
      const status = getSchedulerStatus();
      return jsonResp(res, status);
    } catch(e) {
      res.statusCode = 500;
      return jsonResp(res, { error: e.message });
    }
  }

  // POST /api/eway-bills-hub/export/run-now
  // Trigger an immediate export run
  if (pathname === '/api/eway-bills-hub/export/run-now' && req.method === 'POST') {
    try {
      // Master key only
      if (!requireMasterApiKey(req, res)) return;
      
      const body = await readBody(req);
      const clients = body.clients || ['CLIENT_001'];
      
      // Trigger export asynchronously (don't wait for completion)
      setImmediate(async () => {
        for (const clientId of clients) {
          try {
            const bills = await sqAll(
              `SELECT * FROM eway_bills_master WHERE client_id=? ORDER BY imported_at DESC LIMIT 10000`,
              [clientId]
            );
            const buffer = await exportEwayBillsToExcel(bills, clientId);
            console.log(`[Export] Manually triggered: ${clientId} (${bills.length} bills)`);
          } catch(err) {
            console.error(`[Export] Error for ${clientId}:`, err.message);
          }
        }
      });
      
      return jsonResp(res, {
        success: true,
        message: 'Export job triggered for ' + clients.join(', '),
        clients,
      });
    } catch(e) {
      res.statusCode = 500;
      return jsonResp(res, { error: e.message });
    }
  }

  // POST /api/eway-bills-hub/discover-now
  // Trigger immediate e-way bill discovery from Masters India
  if (pathname === '/api/eway-bills-hub/discover-now' && req.method === 'POST') {
    try {
      // Master key only
      if (!requireMasterApiKey(req, res)) return;
      
      const body = await readBody(req);
      const daysBack = Math.min(Math.max(parseInt(body.days_back) || 5, 1), 30); // 1-30 days, default 5
      
      console.log(`[EWB Discovery] Manual trigger initiated (last ${daysBack} days)`);
      
      // Trigger discovery asynchronously (don't wait for completion)
      setImmediate(async () => {
        try {
          const totalNew = await runFetchEwbsForDays(daysBack);
          console.log(`[EWB Discovery] Manual sync complete: ${totalNew} new EWB(s) added`);
        } catch(e) {
          console.warn('[EWB Discovery] Manual sync error:', e.message);
        }
      });
      
      return jsonResp(res, {
        success: true,
        message: `Manual e-way bill discovery triggered - checking last ${daysBack} days from Masters India`,
        status: 'in-progress',
        days_requested: daysBack,
      });
    } catch(e) {
      res.statusCode = 500;
      return jsonResp(res, { error: e.message });
    }
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
               movement_type, distance_km, total_value, munshi_id, munshi_name, delivered_at,
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

  // POST /api/ewb/sync-last-days — refresh EWBs from last N days via Masters India
  if (pathname === '/api/ewb/sync-last-days' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const cid = body.client_id || 'CLIENT_001';
      const days = parseInt(body.days) || 5;
      const since = new Date(); since.setDate(since.getDate() - days); since.setHours(0,0,0,0);
      const sinceStr = since.toISOString().slice(0, 10);

      const rows = await sqAll(
        `SELECT COALESCE(ewb_no, ewb_number) as no FROM eway_bills_master WHERE client_id=? AND (doc_date >= ? OR imported_at >= ?) AND (status IS NULL OR LOWER(status) NOT IN ('cancelled','cancel'))`,
        [cid, sinceStr, sinceStr]
      );

      if (!MASTERS_USERNAME || rows.length === 0) {
        return jsonResp(res, { synced: rows.length, refreshed: 0, since: sinceStr, status: 'ok' });
      }

      let refreshed = 0, errors = 0;
      for (const row of rows.slice(0, 50)) {
        try {
          const { status: apiStatus, data: apiData } = await mastersGet(
            `/api/v1/getEwayBillData/?action=GetEwayBill&gstin=${encodeURIComponent(MASTERS_GSTIN)}&eway_bill_number=${encodeURIComponent(row.no)}`
          );
          if (apiStatus === 200 && apiData?.results?.message) {
            const m = apiData.results.message;
            const validUpto = m.eway_bill_valid_date
              ? (() => { const [d,mn,y,t] = m.eway_bill_valid_date.split(/[/ ]/); return `${y}-${mn}-${d} ${t||'23:59:00'}`; })()
              : null;
            const ewbStatus = m.eway_bill_status === 'Active' ? 'active' : m.eway_bill_status === 'Cancelled' ? 'cancelled' : (m.eway_bill_status || '').toLowerCase();
            await sqRun(
              `UPDATE eway_bills_master SET valid_upto=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE (ewb_no=? OR ewb_number=?) AND client_id=?`,
              [validUpto, ewbStatus, String(row.no), String(row.no), cid]
            );
            refreshed++;
          }
        } catch (e2) { console.warn(`[sync-last-days] EWB ${row.no}:`, e2.message); errors++; }
      }
      return jsonResp(res, { synced: rows.length, refreshed, errors, since: sinceStr, status: 'ok' });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // POST /api/ewb/sync-this-month — refresh all active EWBs from Masters India
  if (pathname === '/api/ewb/sync-this-month' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const cid = body.client_id || 'CLIENT_001';
      const since = new Date(); since.setDate(1); since.setHours(0,0,0,0);
      const sinceStr = since.toISOString().slice(0, 10);

      // Get all non-cancelled EWBs for this month from local DB
      const rows = await sqAll(
        `SELECT COALESCE(ewb_no, ewb_number) as no FROM eway_bills_master WHERE client_id=? AND (doc_date >= ? OR imported_at >= ?) AND (status IS NULL OR LOWER(status) NOT IN ('cancelled','cancel'))`,
        [cid, sinceStr, sinceStr]
      );

      if (!MASTERS_USERNAME || rows.length === 0) {
        return jsonResp(res, { synced: rows.length, refreshed: 0, since: sinceStr, status: 'ok', message: rows.length === 0 ? 'No EWBs found for this month' : 'Masters India not configured' });
      }

      let refreshed = 0, errors = 0;
      for (const row of rows.slice(0, 100)) { // cap at 100 per sync
        try {
          const { status: apiStatus, data: apiData } = await mastersGet(
            `/api/v1/getEwayBillData/?action=GetEwayBill&gstin=${encodeURIComponent(MASTERS_GSTIN)}&eway_bill_number=${encodeURIComponent(row.no)}`
          );
          if (apiStatus === 200 && apiData?.results?.message) {
            const m = apiData.results.message;
            const validUpto = m.eway_bill_valid_date
              ? (() => { const [d,mn,y,t] = m.eway_bill_valid_date.split(/[/ ]/); return `${y}-${mn}-${d} ${t||'23:59:00'}`; })()
              : null;
            const ewbStatus = m.eway_bill_status === 'Active' ? 'active' : m.eway_bill_status === 'Cancelled' ? 'cancelled' : (m.eway_bill_status || '').toLowerCase();
            await sqRun(
              `UPDATE eway_bills_master SET valid_upto=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE (ewb_no=? OR ewb_number=?) AND client_id=?`,
              [validUpto, ewbStatus, String(row.no), String(row.no), cid]
            );
            refreshed++;
          }
        } catch (e2) { console.warn(`[sync-this-month] EWB ${row.no}:`, e2.message); errors++; }
      }
      return jsonResp(res, { synced: rows.length, refreshed, errors, since: sinceStr, status: 'ok' });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // GET /api/ewb/details/:no — fetch live EWB details from Masters India + local DB
  if (pathname.startsWith('/api/ewb/details/') && req.method === 'GET') {
    try {
      const ewbNo = decodeURIComponent(pathname.replace('/api/ewb/details/', '').trim());
      if (!ewbNo) return jsonResp(res, { status: 'error', message: 'EWB number required' }, 400);
      const cid = parsed.query.client_id || 'CLIENT_001';

      // Try Masters India live lookup first
      if (MASTERS_GSTIN && MASTERS_USERNAME) {
        try {
          const { status: apiStatus, data: apiData } = await mastersGet(
            `/api/v1/getEwayBillData/?action=GetEwayBill&gstin=${encodeURIComponent(MASTERS_GSTIN)}&eway_bill_number=${encodeURIComponent(ewbNo)}`
          );
          if (apiStatus === 200 && apiData?.results?.message) {
            const m = apiData.results.message;
            // Upsert local DB with fresh data (INSERT if new, UPDATE if existing)
            const validUpto = m.eway_bill_valid_date
              ? (() => { const [d,mn,y,t] = m.eway_bill_valid_date.split(/[/ ]/); return `${y}-${mn}-${d} ${t||'23:59:00'}`; })()
              : null;
            const ewbStatus = m.eway_bill_status === 'Active' ? 'active' : m.eway_bill_status === 'Cancelled' ? 'cancelled' : (m.eway_bill_status || '').toLowerCase();
            const latestVehicle = m.VehiclListDetails?.[0]?.vehicle_number || null;
            // Parse doc_date from document_date (DD/MM/YYYY)
            const rawDocDate = m.document_date || '';
            const parsedDocDate = rawDocDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
              ? rawDocDate.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$2-$1') : null;
            // Auto-save to DB if not already present (e.g. EWBs assigned to KD as transporter by customers)
            await sqRun(
              `INSERT OR IGNORE INTO eway_bills_master (client_id, ewb_no, ewb_number, doc_no, doc_date, from_trade_name, to_trade_name, from_place, to_place, total_value, valid_upto, status, distance_km, vehicle_no, imported_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
              [cid, String(m.eway_bill_number||ewbNo), String(m.eway_bill_number||ewbNo),
               m.document_number||'', parsedDocDate,
               m.legal_name_of_consignor||'', m.legal_name_of_consignee||'',
               m.place_of_consignor||'', m.place_of_consignee||'',
               m.total_invoice_value||0, validUpto, ewbStatus,
               m.transportation_distance||0, latestVehicle||'']
            );
            await sqRun(
              `UPDATE eway_bills_master SET valid_upto=?, status=?, vehicle_no=?, updated_at=CURRENT_TIMESTAMP WHERE (ewb_no=? OR ewb_number=?) AND client_id=?`,
              [validUpto, ewbStatus, latestVehicle, ewbNo, ewbNo, cid]
            );
            const validUptoDate = validUpto ? new Date(validUpto) : null;
            const hoursLeft = validUptoDate ? (validUptoDate - Date.now()) / 3600000 : null;
            return jsonResp(res, { status: 'ok', source: 'live', data: { ...m, hours_left: hoursLeft != null ? Math.round(hoursLeft) : null, is_expired: validUptoDate ? validUptoDate < new Date() : false } });
          }
        } catch (apiErr) {
          console.warn('[EWB details] Masters India error, falling back to local DB:', apiErr.message);
        }
      }

      // Fallback: local DB
      const rows = await sqAll(`SELECT * FROM eway_bills_master WHERE (ewb_no=? OR ewb_number=?) AND client_id=? LIMIT 1`, [ewbNo, ewbNo, cid]);
      if (!rows.length) return jsonResp(res, { status: 'error', message: `EWB ${ewbNo} not found` });
      const r = rows[0];
      const validUpto = r.valid_upto ? new Date(r.valid_upto) : null;
      const hoursLeft = validUpto ? (validUpto - Date.now()) / 3600000 : null;
      return jsonResp(res, { status: 'ok', source: 'local', data: { ...r, hours_left: hoursLeft != null ? Math.round(hoursLeft) : null, is_expired: validUpto ? validUpto < new Date() : false } });
    } catch(e) { return jsonResp(res, { status: 'error', message: e.message }, 500); }
  }

  // POST /api/ewb/fetch-today — discover & save EWBs for today (and optionally N past days) from Masters India
  if (pathname === '/api/ewb/fetch-today' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const cid = body.client_id || 'CLIENT_001';
      const daysBack = parseInt(body.days_back) || 0; // 0 = only today, 1 = today + yesterday, etc.

      if (!MASTERS_USERNAME || !MASTERS_GSTIN) {
        return jsonResp(res, { error: 'Masters India credentials not configured' }, 500);
      }

      let totalNew = 0, totalSeen = 0, errors = 0;
      const datesToFetch = [];
      for (let i = 0; i <= daysBack; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        datesToFetch.push(`${dd}/${mm}/${yyyy}`);
      }

      for (const dateStr of datesToFetch) {
        try {
          const { status: apiStatus, data: apiData } = await mastersGet(
            `/api/v1/getEwayBillData/?action=GetEwayBillsByDate&gstin=${encodeURIComponent(MASTERS_GSTIN)}&date=${encodeURIComponent(dateStr)}`
          );
          if (apiStatus !== 200 || !Array.isArray(apiData?.results?.message)) continue;

          for (const item of apiData.results.message) {
            totalSeen++;
            const ewbNo = String(item.eway_bill_number || '');
            if (!ewbNo) continue;

            // Parse dates
            const parseEwbDate = (s) => {
              if (!s) return null;
              const [d2, mn2, y2] = s.split('/');
              return y2 && mn2 && d2 ? `${y2}-${mn2}-${d2}` : null;
            };
            const parseEwbDateTime = (s) => {
              if (!s) return null;
              const parts = s.split(/[/ ]/);
              const [d2, mn2, y2, t] = parts;
              return y2 && mn2 && d2 ? `${y2}-${mn2}-${d2} ${t || '23:59:00'}` : null;
            };
            const docDate = parseEwbDate(item.document_date);
            const validUpto = parseEwbDateTime(item.eway_bill_valid_date);
            const ewbStatus = item.eway_bill_status === 'Active' ? 'active'
              : item.eway_bill_status === 'Cancelled' ? 'cancelled'
              : (item.eway_bill_status || '').toLowerCase();

            // INSERT OR IGNORE — only adds if EWB not already in DB
            const result = await sqRun(
              `INSERT OR IGNORE INTO eway_bills_master
               (client_id, ewb_no, ewb_number, doc_no, doc_date, to_place, to_pincode, valid_upto, status, imported_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
              [cid, ewbNo, ewbNo, item.document_number || '', docDate || '', item.place_of_delivery || '', item.pincode_of_delivery || '', validUpto || '', ewbStatus]
            );
            if (result && result.changes > 0) totalNew++;
          }
        } catch (e2) {
          console.warn(`[fetch-today] Date ${dateStr}:`, e2.message);
          errors++;
        }
      }

      console.log(`[fetch-today] Dates: ${datesToFetch.join(', ')} → seen ${totalSeen}, new ${totalNew}`);
      return jsonResp(res, { seen: totalSeen, new: totalNew, errors, dates: datesToFetch, status: 'ok' });
    } catch(e) { return jsonResp(res, { error: e.message }, 500); }
  }

  // POST /api/ewb/fetch-from-nic — fetch & refresh EWB from Masters India by EWB number or date
  if (pathname === '/api/ewb/fetch-from-nic' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const cid = body.client_id || 'CLIENT_001';
      const ewbNos = body.ewb_numbers || []; // array of EWB numbers to refresh

      if (!MASTERS_USERNAME) {
        // Fallback: return local DB records
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
        return jsonResp(res, { status: 'ok', fetched: rows.length, new_in_master: 0, message: 'Masters India not configured — returned from local DB' });
      }

      // Fetch live details for requested EWB numbers
      if (ewbNos.length === 0) {
        // No specific numbers — return local DB count
        const rawDate = (body.date || '');
        const dateStr = rawDate.match(/^\d{2}\/\d{2}\/\d{4}$/)
          ? rawDate.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')
          : rawDate;
        let rows;
        if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          rows = await sqAll(`SELECT ewb_no, ewb_number FROM eway_bills_master WHERE client_id=? AND doc_date=?`, [cid, dateStr]);
        } else {
          rows = await sqAll(`SELECT ewb_no, ewb_number FROM eway_bills_master WHERE client_id=? ORDER BY imported_at DESC LIMIT 50`, [cid]);
        }
        return jsonResp(res, { status: 'ok', fetched: rows.length, new_in_master: 0, message: 'Pass ewb_numbers array to refresh from Masters India API' });
      }

      // Refresh each requested EWB from Masters India
      let refreshed = 0, errors = 0;
      for (const no of ewbNos.slice(0, 50)) { // cap at 50 per call
        try {
          const { status: apiStatus, data: apiData } = await mastersGet(
            `/api/v1/getEwayBillData/?action=GetEwayBill&gstin=${encodeURIComponent(MASTERS_GSTIN)}&eway_bill_number=${encodeURIComponent(no)}`
          );
          if (apiStatus === 200 && apiData?.results?.message) {
            const m = apiData.results.message;
            const validUpto = m.eway_bill_valid_date
              ? (() => { const [d,mn,y,t] = m.eway_bill_valid_date.split(/[/ ]/); return `${y}-${mn}-${d} ${t||'23:59:00'}`; })()
              : null;
            const ewbStatus2 = m.eway_bill_status === 'Active' ? 'active' : m.eway_bill_status === 'Cancelled' ? 'cancelled' : (m.eway_bill_status || '').toLowerCase();
            await sqRun(
              `UPDATE eway_bills_master SET valid_upto=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE (ewb_no=? OR ewb_number=?) AND client_id=?`,
              [validUpto, ewbStatus2, String(no), String(no), cid]
            );
            refreshed++;
          }
        } catch (e2) { console.warn(`[fetch-from-nic] EWB ${no}:`, e2.message); errors++; }
      }
      return jsonResp(res, { status: 'ok', fetched: ewbNos.length, refreshed, errors, message: `Refreshed ${refreshed} EWBs from Masters India` });
    } catch(e) { return jsonResp(res, { status: 'error', message: e.message }, 500); }
  }

  // POST /api/ewb/extend-validity — extend EWB validity via Masters India API
  if (pathname === '/api/ewb/extend-validity' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { ewb_no, from_place, state_of_consignor, remaining_distance, mode_of_transport, extend_validity_reason, extend_remarks, vehicle_number, transporter_document_number, transporter_document_date } = body;
      if (!ewb_no) return jsonResp(res, { status: 'error', message: 'ewb_no required' }, 400);
      if (!from_place) return jsonResp(res, { status: 'error', message: 'from_place required' }, 400);

      if (MASTERS_USERNAME) {
        const km = parseInt(remaining_distance) || 100;
        const payload = {
          userGstin: MASTERS_GSTIN,
          eway_bill_number: parseInt(ewb_no),
          vehicle_number: vehicle_number || '',
          place_of_consignor: from_place,
          state_of_consignor: state_of_consignor || 'Rajasthan',
          remaining_distance: km,
          transporter_document_number: transporter_document_number || '',
          transporter_document_date: transporter_document_date || '',
          mode_of_transport: mode_of_transport || '1',
          extend_validity_reason: extend_validity_reason || 'Others',
          extend_remarks: extend_remarks || '',
          consignment_status: 'M',
          from_pincode: parseInt(body.from_pincode) || 0,
          transit_type: ''
        };
        const { status: apiStatus, data: apiData } = await mastersPost('/api/v1/ewayBillValidityExtend/', payload);
        if (apiStatus === 200 && apiData?.results?.status === 'Success') {
          const newValidity = apiData.results.message?.extendedValidDate || null;
          if (newValidity) {
            const [d,mn,y,t] = newValidity.split(/[/ ]/);
            const dbVal = `${y}-${mn}-${d} ${t||'23:59:00'}`;
            await sqRun(`UPDATE eway_bills_master SET valid_upto=?, updated_at=CURRENT_TIMESTAMP WHERE ewb_no=?`, [dbVal, ewb_no]);
          }
          return jsonResp(res, { status: 'success', new_validity: newValidity, source: 'masters_india', api_response: apiData });
        }
        return jsonResp(res, { status: 'error', message: apiData?.results?.message || 'Masters India API error', api_status: apiStatus }, 400);
      }

      // Local DB fallback (no Masters India configured)
      const km = parseInt(remaining_distance) || 100;
      const extraDays = Math.max(1, Math.ceil(km / 250));
      const rows = await sqAll(`SELECT valid_upto FROM eway_bills_master WHERE ewb_no=? LIMIT 1`, [ewb_no]);
      const base = rows.length && rows[0].valid_upto ? new Date(rows[0].valid_upto) : new Date();
      if (base < new Date()) base.setTime(Date.now());
      base.setDate(base.getDate() + extraDays);
      const newValidity = base.toISOString().slice(0, 19).replace('T', ' ');
      await sqRun(`UPDATE eway_bills_master SET valid_upto=?, updated_at=CURRENT_TIMESTAMP WHERE ewb_no=?`, [newValidity, ewb_no]);
      return jsonResp(res, { status: 'success', new_validity: newValidity, extended_days: extraDays, source: 'local' });
    } catch(e) { return jsonResp(res, { status: 'error', message: e.message }, 500); }
  }

  // POST /api/ewb/update-vehicle — update vehicle number (Part B) via Masters India
  if (pathname === '/api/ewb/update-vehicle' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { ewb_no, vehicle_number, place_of_consignor, state_of_consignor, reason_code, transporter_document_number, transporter_document_date, mode_of_transport } = body;
      if (!ewb_no) return jsonResp(res, { status: 'error', message: 'ewb_no required' }, 400);
      if (!vehicle_number) return jsonResp(res, { status: 'error', message: 'vehicle_number required' }, 400);

      if (!MASTERS_USERNAME) return jsonResp(res, { status: 'error', message: 'Masters India API not configured' }, 503);

      const payload = {
        userGstin: MASTERS_GSTIN,
        eway_bill_number: parseInt(ewb_no),
        vehicle_number: vehicle_number.replace(/\s+/g, '').toUpperCase(),
        vehicle_type: body.vehicle_type || 'R',
        place_of_consignor: place_of_consignor || '',
        state_of_consignor: state_of_consignor || '',
        reason_code_for_vehicle_updation: reason_code || 'Others',
        reason_for_vehicle_updation: body.reason_description || '',
        transporter_document_number: transporter_document_number || '',
        transporter_document_date: transporter_document_date || '',
        mode_of_transport: parseInt(mode_of_transport) || 1,
        data_source: 'erp'
      };
      const { status: apiStatus, data: apiData } = await mastersPost('/api/v1/updateVehicleNumber/', payload);
      if (apiStatus === 200 && apiData?.results?.status === 'Success') {
        // Update local DB vehicle_no and from_place (also insert if not yet saved — e.g. transporter-assigned EWBs)
        const cleanVehicle = vehicle_number.replace(/\s+/g, '').toUpperCase();
        await sqRun(
          `INSERT OR IGNORE INTO eway_bills_master (client_id, ewb_no, ewb_number, vehicle_no, from_place, status, imported_at, updated_at)
           VALUES ('CLIENT_001',?,?,?,'','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
          [String(ewb_no), String(ewb_no), cleanVehicle]
        );
        await sqRun(
          `UPDATE eway_bills_master SET vehicle_no=?, from_place=?, updated_at=CURRENT_TIMESTAMP WHERE ewb_no=?`,
          [cleanVehicle, place_of_consignor || '', ewb_no]
        );
        return jsonResp(res, { status: 'success', api_response: apiData });
      }
      return jsonResp(res, { status: 'error', message: apiData?.results?.message || 'Masters India API error', api_status: apiStatus }, 400);
    } catch(e) { return jsonResp(res, { status: 'error', message: e.message }, 500); }
  }

  // POST /api/ewb/cancel — cancel EWB via Masters India
  if (pathname === '/api/ewb/cancel' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { ewb_no, reason_of_cancel, cancel_remark } = body;
      if (!ewb_no) return jsonResp(res, { status: 'error', message: 'ewb_no required' }, 400);

      if (!MASTERS_USERNAME) return jsonResp(res, { status: 'error', message: 'Masters India API not configured' }, 503);

      const payload = {
        userGstin: MASTERS_GSTIN,
        eway_bill_number: parseInt(ewb_no),
        reason_of_cancel: reason_of_cancel || 'Others',
        cancel_remark: cancel_remark || '',
        data_source: 'erp'
      };
      const { status: apiStatus, data: apiData } = await mastersPost('/api/v1/ewayBillCancel/', payload);
      if (apiStatus === 200 && apiData?.results?.status === 'Success') {
        await sqRun(
          `UPDATE eway_bills_master SET status='cancelled', updated_at=CURRENT_TIMESTAMP WHERE ewb_no=?`,
          [ewb_no]
        );
        return jsonResp(res, { status: 'success', api_response: apiData });
      }
      return jsonResp(res, { status: 'error', message: apiData?.results?.message || 'Masters India API error', api_status: apiStatus }, 400);
    } catch(e) { return jsonResp(res, { status: 'error', message: e.message }, 500); }
  }

  // POST /api/ewb/update-transporter — update transporter ID via Masters India
  if (pathname === '/api/ewb/update-transporter' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { ewb_no, transporter_id, transporter_name } = body;
      if (!ewb_no) return jsonResp(res, { status: 'error', message: 'ewb_no required' }, 400);
      if (!transporter_id) return jsonResp(res, { status: 'error', message: 'transporter_id required' }, 400);

      if (!MASTERS_USERNAME) return jsonResp(res, { status: 'error', message: 'Masters India API not configured' }, 503);

      const payload = {
        userGstin: MASTERS_GSTIN,
        eway_bill_number: parseInt(ewb_no),
        transporter_id,
        transporter_name: transporter_name || ''
      };
      const { status: apiStatus, data: apiData } = await mastersPost('/api/v1/transporterIdUpdate/', payload);
      if (apiStatus === 200 && apiData?.results?.status === 'Success') {
        await sqRun(
          `UPDATE eway_bills_master SET notes=COALESCE(notes,'')||' Transporter: '||?, updated_at=CURRENT_TIMESTAMP WHERE ewb_no=?`,
          [transporter_name || transporter_id, ewb_no]
        );
        return jsonResp(res, { status: 'success', api_response: apiData });
      }
      return jsonResp(res, { status: 'error', message: apiData?.results?.message || 'Masters India API error', api_status: apiStatus }, 400);
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
    console.error('[server] unhandled request error:', err.message || err);
    console.error('[server] stack:', err.stack || 'no stack');
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal server error' }));
    }
  }
}

// ── Masters India E-Way Bill API helpers ─────────────────────────────────────
const MASTERS_API_URL  = (process.env.MASTERS_API_URL  || 'https://sandb-api.mastersindia.co').replace(/\/$/, '');
const MASTERS_USERNAME = process.env.MASTERS_USERNAME  || '';
const MASTERS_PASSWORD = process.env.MASTERS_PASSWORD  || '';
const MASTERS_GSTIN    = process.env.MASTERS_GSTIN     || '';

// Token cache — refreshed whenever expiry is within 5 minutes
let mastersTokenCache = { token: null, expiresAt: 0 };

async function mastersAuth() {
  if (mastersTokenCache.token && Date.now() < mastersTokenCache.expiresAt - 300000) {
    return mastersTokenCache.token;
  }
  const r = await fetch(`${MASTERS_API_URL}/api/v1/token-auth/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: MASTERS_USERNAME, password: MASTERS_PASSWORD })
  });
  if (!r.ok) throw new Error(`Masters India auth failed: ${r.status}`);
  const data = await r.json();
  if (!data.token) throw new Error(`Masters India: no token in response`);
  mastersTokenCache = { token: data.token, expiresAt: Date.now() + 23 * 3600 * 1000 };
  return data.token;
}

async function mastersGet(path) {
  const token = await mastersAuth();
  const r = await fetch(`${MASTERS_API_URL}${path}`, {
    headers: { 'Authorization': `JWT ${token}`, 'Content-Type': 'application/json' }
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { throw new Error(`Masters India non-JSON: ${text.substring(0,200)}`); }
  return { status: r.status, data: json };
}

async function mastersPost(path, body) {
  const token = await mastersAuth();
  const r = await fetch(`${MASTERS_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `JWT ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { throw new Error(`Masters India non-JSON: ${text.substring(0,200)}`); }
  return { status: r.status, data: json };
}

// ─────────────────────────────────────────────────────────────────────────────

// Use PORT env var set by Railway, default to 3000 for local development
const PORT = process.env.PORT || 3000;

// Global error handlers to prevent crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', reason);
  console.error(reason?.stack);
});

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error.message);
  console.error(error?.stack);
  // Re-throw to let process manager handle restart
  process.exit(1);
});

console.log(`[SERVER] Environment: NODE_ENV=${process.env.NODE_ENV}, PORT=${PORT}, PID=${process.pid}`);
console.log(`[SERVER] About to listen on PORT=${PORT}...`);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ [SERVER] Listening on http://0.0.0.0:${PORT}`);
  console.log(`[DEBUG] distDir=${path.join(__dirname, 'dist')}, exists=${fs.existsSync(path.join(__dirname, 'dist'))}`);

  // Seed SQLite from seed_data.json if DB is empty (Railway ephemeral filesystem)
  // Run async to not block healthcheck responses
  setImmediate(() => {
    try {
      // CLEANUP: Delete dummy EWBs added from Masters India Discovery
      const cleanupDummyEwbs = () => {
        if (!sqlite3) return;
        const db = new sqlite3.Database(SQLITE_DB_PATH);
        // Delete EWBs imported in last 10 minutes (the 44 dummy ones from Masters)
        db.run(
          `DELETE FROM eway_bills_master WHERE imported_at > datetime('now', '-10 minutes')`,
          function(err) {
            if (err) {
              console.warn('[Cleanup] Failed to delete dummy EWBs:', err.message);
            } else {
              console.log(`[Cleanup] Deleted ${this.changes} dummy EWBs added from Masters India`);
            }
            db.close();
          }
        );
      };
      // Run cleanup before seed
      cleanupDummyEwbs();
      
      seedSqliteIfEmpty();
      console.log('[Seed] Background initialization started');
    } catch (err) {
      console.error('[Seed] Initialization error:', err.message);
    }
  });

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
    setTimeout(() => { 
      runAutoSync().catch(err => console.error('[AutoSync] Startup error:', err.message)); 
      setInterval(() => runAutoSync().catch(err => console.error('[AutoSync] Error:', err.message)), AUTO_SYNC_INTERVAL_MS); 
    }, 8000);
    console.log(`[AutoSync] Scheduler started — every ${AUTO_SYNC_INTERVAL_MS / 1000}s`);
  } else {
    console.warn('[AutoSync] PROVIDER_API_URL not set — auto-sync disabled');
  }

  // ── Masters India EWB Discovery: Parameterized fetch from N days back ────────── 
  // Available globally for both scheduler and manual discovery endpoint
  async function runFetchEwbsForDays(daysBack = 2) {
    try {
      // Guards: require Masters credentials to be configured
      if (!MASTERS_USERNAME || !MASTERS_GSTIN) {
        console.warn('[EWB Discovery] Masters India credentials not configured — skipping discovery');
        return 0;
      }

      const datesToCheck = [];
      const today = new Date();
      const fmt = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      
      // Build list of dates to check (today and N-1 days back)
      for (let i = 0; i < daysBack; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        datesToCheck.push(fmt(d));
      }
      
      let totalNew = 0;
      for (const dateStr of datesToCheck) {
        const { status: apiStatus, data: apiData } = await mastersGet(
          `/api/v1/getEwayBillData/?action=GetEwayBillsByDate&gstin=${encodeURIComponent(MASTERS_GSTIN)}&date=${encodeURIComponent(dateStr)}`
        ).catch(() => ({ status: 0, data: null }));
        
        if (apiStatus !== 200 || !Array.isArray(apiData?.results?.message)) continue;
        
        for (const item of apiData.results.message) {
          const ewbNo = String(item.eway_bill_number || '');
          if (!ewbNo) continue;
          
          // VALIDATION: Skip dummy/test bills (require real business data)
          // Only import if: has document number AND has both from/to details
          const hasDocNumber = !!(item.document_number || '').trim();
          const hasFromData = !!(item.from_gstin || item.from_trade_name || item.from_place || '').trim();
          const hasToData = !!(item.to_gstin || item.to_trade_name || item.to_place || '').trim();
          
          // Skip bills that lack essential business data (likely test/dummy)
          if (!hasDocNumber || !hasFromData || !hasToData) {
            continue; // Silently skip invalid bills
          }
          
          const parseDate = (s) => { if (!s) return null; const [d2,mn2,y2] = s.split('/'); return y2&&mn2&&d2?`${y2}-${mn2}-${d2}`:null; };
          const parseDateTime = (s) => { if (!s) return null; const p = s.split(/[/ ]/); return p[2]&&p[1]&&p[0]?`${p[2]}-${p[1]}-${p[0]} ${p[3]||'23:59:00'}`:null; };
          const ewbStatus = item.eway_bill_status === 'Active' ? 'active' : item.eway_bill_status === 'Cancelled' ? 'cancelled' : (item.eway_bill_status||'').toLowerCase();
          
          const result = await sqRun(
            `INSERT OR IGNORE INTO eway_bills_master (client_id, ewb_no, ewb_number, doc_no, doc_date, to_place, to_pincode, valid_upto, status, imported_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
            ['CLIENT_001', ewbNo, ewbNo, item.document_number||'', parseDate(item.document_date)||'', item.place_of_delivery||'', item.pincode_of_delivery||'', parseDateTime(item.eway_bill_valid_date)||'', ewbStatus]
          ).catch(() => null);
          
          if (result?.changes > 0) totalNew++;
        }
      }
      if (totalNew > 0) console.log(`[EWB Discovery] ${totalNew} new EWB(s) added from Masters India (last ${daysBack} days)`);
      return totalNew;
    } catch(e) { 
      console.warn('[EWB Discovery]', e.message);
      return 0;
    }
  }

  // ── Masters India EWB auto-refresh ─────────────────────────────────────────
  // Every 4 hours: refresh status of active EWBs from the last 30 days
  if (MASTERS_USERNAME && MASTERS_GSTIN) {
    const EWB_REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
    async function runEwbAutoRefresh() {
      try {
        const since = new Date(); since.setDate(since.getDate() - 30); since.setHours(0,0,0,0);
        const sinceStr = since.toISOString().slice(0, 10);
        const rows = await sqAll(
          `SELECT COALESCE(ewb_no, ewb_number) as no FROM eway_bills_master WHERE (doc_date >= ? OR imported_at >= ?) AND (status IS NULL OR LOWER(status) NOT IN ('cancelled','cancel')) LIMIT 100`,
          [sinceStr, sinceStr]
        );
        if (!rows.length) return;
        let refreshed = 0;
        for (const row of rows) {
          try {
            const { status: apiStatus, data: apiData } = await mastersGet(
              `/api/v1/getEwayBillData/?action=GetEwayBill&gstin=${encodeURIComponent(MASTERS_GSTIN)}&eway_bill_number=${encodeURIComponent(row.no)}`
            );
            if (apiStatus === 200 && apiData?.results?.message) {
              const m = apiData.results.message;
              const validUpto = m.eway_bill_valid_date
                ? (() => { const [d,mn,y,t] = m.eway_bill_valid_date.split(/[/ ]/); return `${y}-${mn}-${d} ${t||'23:59:00'}`; })()
                : null;
              const ewbStatusAuto = m.eway_bill_status === 'Active' ? 'active' : m.eway_bill_status === 'Cancelled' ? 'cancelled' : (m.eway_bill_status || '').toLowerCase();
              await sqRun(
                `UPDATE eway_bills_master SET valid_upto=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE (ewb_no=? OR ewb_number=?)`,
                [validUpto, ewbStatusAuto, String(row.no), String(row.no)]
              );
              refreshed++;
            }
          } catch(e2) { /* individual EWB errors are non-fatal */ }
        }
        if (refreshed > 0) console.log(`[EWB AutoRefresh] Refreshed ${refreshed}/${rows.length} EWBs from Masters India`);
      } catch(e) { console.error('[EWB AutoRefresh]', e.message); }
    }
    // ── Daily EWB discovery: fetch all EWBs from Masters India by date ───────
    // Discovers NEW EWBs assigned by customers (not yet in local DB)
    // Keep backward compatibility - original scheduler runs 2-day discovery every 30 min
    async function runFetchTodayEwbs() {
      return await runFetchEwbsForDays(2);
    }

    // First run after 30s startup delay, then every 4 hours
    setTimeout(() => {
      runFetchTodayEwbs(); // discovery first
      runEwbAutoRefresh();
      setInterval(runEwbAutoRefresh, EWB_REFRESH_INTERVAL_MS);
      setInterval(runFetchTodayEwbs, 30 * 60 * 1000); // re-discover every 30 min
    }, 30000);
    console.log('[EWB AutoRefresh] Scheduler started — every 4 hours + discovery every 30 min');
  } else {
    console.warn('[EWB AutoRefresh] MASTERS_USERNAME/MASTERS_GSTIN not set — EWB auto-refresh disabled');
  }
});
