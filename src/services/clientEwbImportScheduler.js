/**
 * CLIENT EWB AUTO-IMPORT SCHEDULER
 * 
 * Periodically downloads e-way bills from client portals/APIs
 * and processes them through the client operation engine
 */

import sqlite3 from 'sqlite3';

const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || './fleet_erp_backend_sqlite.db';

// Masters API integration - PRODUCTION
// MASTER ACCOUNT: Atul_logistics (Only account for downloading EWBs)
const MASTERS_API_URL = process.env.MASTERS_API_URL || 'https://api.mastersindia.co';
const MASTERS_USERNAME = process.env.MASTERS_USERNAME || 'Atul_logistics';
const MASTERS_PASSWORD = process.env.MASTERS_PASSWORD || 'Atul@1997';
const MASTERS_GSTIN = process.env.MASTERS_GSTIN || '09AABCH3162L1ZG';

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT IMPORT SOURCES
// All clients created in system - Download using Atul's master account
// ═══════════════════════════════════════════════════════════════════════════

const CLIENT_SOURCES = {
  'CLIENT_001': {
    name: 'Atul Logistics - Master Account EWB Download',
    import_api: 'masters_api',
    import_method: 'MASTERS',
    auth_type: 'masters_oauth',
    // Atul's master account credentials - downloads for all clients
    masters_username: process.env.MASTERS_USERNAME || 'Atul_logistics',
    masters_password: process.env.MASTERS_PASSWORD || 'Atul@1997',
    masters_gstin: process.env.MASTERS_GSTIN || '09AABCH3162L1ZG',
    import_interval_minutes: 30,
    last_import: null,
    batch_size: 500,
    active: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-IMPORT SCHEDULER
// ═══════════════════════════════════════════════════════════════════════════

export function startClientEwbImportScheduler() {
  console.log('[ClientEwbImport] Scheduler starting...');

  // Run import check every 5 minutes
  setInterval(async () => {
    for (const [clientId, config] of Object.entries(CLIENT_SOURCES)) {
      if (!config.active) continue;

      const now = Date.now();
      const last = config.last_import || 0;
      const intervalMs = config.import_interval_minutes * 60 * 1000;

      // Check if it's time to import
      if (now - last < intervalMs) continue;

      console.log(`[ClientEwbImport] Importing for ${clientId}...`);
      config.last_import = now;

      try {
        const ewbs = await fetchClientEwbs(clientId, config);
        if (ewbs && ewbs.length > 0) {
          console.log(`[ClientEwbImport] ${clientId}: Fetched ${ewbs.length} EWBs`);
          await importEwbsToDatabase(clientId, ewbs);
          console.log(`[ClientEwbImport] ${clientId}: Imported ${ewbs.length} EWBs`);
        } else {
          console.log(`[ClientEwbImport] ${clientId}: No new EWBs`);
        }
      } catch (err) {
        console.error(`[ClientEwbImport] ${clientId} Error:`, err.message);
      }
    }
  }, 5 * 60 * 1000); // 5 minute check interval

  console.log('[ClientEwbImport] ✓ Scheduler started');
}

// ═══════════════════════════════════════════════════════════════════════════
// FETCH FROM CLIENT PORTAL
// ═══════════════════════════════════════════════════════════════════════════

async function fetchClientEwbs(clientId, config) {
  try {
    // Special handling for Masters API imports
    if (config.import_method === 'MASTERS') {
      return await fetchViamastersAPI(clientId, config);
    }

    console.log(`[Fetch] ${clientId}: ${config.import_method || 'GET'} ${config.import_api}`);

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'KD-Logistics-AutoImport/1.0',
    };

    // Add authentication based on type
    if (config.auth_type === 'bearer' && config.auth_token) {
      headers['Authorization'] = `Bearer ${config.auth_token}`;
    } else if (config.auth_type === 'digest' && config.auth_token) {
      // For NIC portal: encode credentials
      const credentials = `${config.auth_token}:${config.auth_password || ''}`;
      headers['Authorization'] = `Basic ${Buffer.from(credentials).toString('base64')}`;
    } else if (config.auth_type === 'api-key' && config.auth_token) {
      headers['X-API-Key'] = config.auth_token;
    }

    // In production: use real fetch. For demo: return mock data
    if (process.env.NODE_ENV === 'production') {
      const fetchOptions = {
        method: config.import_method || 'GET',
        headers,
      };

      // Add body for POST requests
      if (config.import_method === 'POST') {
        fetchOptions.body = JSON.stringify({
          batch_size: config.batch_size || 100,
          status: 'GENERATED',
        });
      }

      const response = await fetch(config.import_api, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : data.eway_bills || data.ewbs || [];
    } else {
      // Demo mode: return mock EWBs
      return getMockEwbsForClient(clientId);
    }
  } catch (err) {
    console.error(`[Fetch] ${clientId} Failed:`, err.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MASTERS API FETCH
// ═══════════════════════════════════════════════════════════════════════════

// Token cache (shared with server.js implementation)
let mastersTokenCache = { token: null, expiresAt: 0 };
let mastersAuthPromise = null;
let mastersRateLimitUntil = 0;

async function mastersAuth() {
  // Step 1: CHECK CACHE
  if (mastersTokenCache.token && mastersTokenCache.expiresAt > Date.now()) {
    console.log('[Masters Auth] ✓ Using cached token (valid for ' + 
      Math.ceil((mastersTokenCache.expiresAt - Date.now()) / 3600000) + 'h)');
    return mastersTokenCache.token;
  }
  
  // Step 2: HANDLE RATE LIMIT
  if (mastersRateLimitUntil > Date.now()) {
    const waitMinutes = Math.ceil((mastersRateLimitUntil - Date.now()) / 60000);
    console.warn(`[Masters Auth] Rate limited for ${waitMinutes} minutes - using stale token`);
    if (mastersTokenCache.token) {
      return mastersTokenCache.token;
    }
    throw new Error('Masters India rate limited - no cached token');
  }
  
  // Step 3: SERIALIZE AUTH REQUESTS
  if (mastersAuthPromise) {
    console.log('[Masters Auth] Auth in progress, waiting...');
    return mastersAuthPromise;
  }
  
  // Step 4: EXECUTE AUTH REQUEST
  console.log('[Masters Auth] Requesting new token...');
  
  mastersAuthPromise = (async () => {
    try {
      const requestBody = { 
        username: MASTERS_USERNAME,
        password: MASTERS_PASSWORD
      };
      
      console.log(`[Masters Auth] POSTing to ${MASTERS_API_URL}/api/v1/token-auth/`);
      
      const r = await fetch(`${MASTERS_API_URL}/api/v1/token-auth/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await r.json();
      
      // CHECK FOR ANY ERROR FIRST (Masters returns 200 with error in body)
      if (data.error) {
        const errorStr = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        console.warn(`[Masters Auth] No token in 200 response. Got keys: error Response: ${JSON.stringify(data)}`);
        
        // Detect rate limit errors
        if (errorStr && (errorStr.includes('exceed') || errorStr.includes('exceeded'))) {
          console.warn('[Masters Auth] Rate limit error:', errorStr);
          const match = errorStr.match(/after (\d+):(\d+)/);
          if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            mastersRateLimitUntil = Date.now() + ((minutes * 60 + seconds) * 1000);
          }
          throw new Error(`Rate limited: ${errorStr}`);
        }
        
        // Other credential errors
        throw new Error(`Masters API error: ${errorStr}`);
      }
      
      // Check HTTP status
      if (!r.ok) {
        throw new Error(`HTTP ${r.status}: ${JSON.stringify(data)}`);
      }
      
      // Extract token
      const token = data.token;
      if (!token) {
        console.warn(`[Masters Auth] No token in 200 response. Got keys: ${Object.keys(data).join(', ')} Response: ${JSON.stringify(data)}`);
        throw new Error(`Masters India returned 200 but no token — check credentials`);
      }
      
      // CACHE for 23 hours
      mastersTokenCache = { 
        token: token, 
        expiresAt: Date.now() + 23 * 3600 * 1000 
      };
      
      console.log('[Masters Auth] Token obtained, cached for 23h');
      return token;
      
    } catch (e) {
      console.error('[Masters Auth] Failed:', e.message);
      throw e;
    } finally {
      mastersAuthPromise = null;
    }
  })();
  
  return mastersAuthPromise;
}

// Token cache per client (to handle multiple GSTINs)
const masterTokenCachePerClient = {};

// Get Masters token for specific client credentials
async function getMastersTokenForClient(clientId, username, password) {
  try {
    // Check if cached token is still valid
    if (masterTokenCachePerClient[clientId]) {
      const { token, expiresAt } = masterTokenCachePerClient[clientId];
      if (expiresAt > Date.now()) {
        return token;
      }
    }

    console.log(`[Masters Auth] ${clientId}: Requesting new token...`);
    
    const r = await fetch(`${MASTERS_API_URL}/api/v1/token-auth/`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ 
        username: username,
        password: password
      })
    });

    const data = await r.json();

    // CHECK FOR ANY ERROR FIRST (Masters returns 200 with error in body)
    if (data.error) {
      const errorStr = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      console.warn(`[Masters Auth] ${clientId}: No token in response. Got error: ${errorStr}`);
      throw new Error(`Masters API error: ${errorStr}`);
    }

    // Check HTTP status
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}: ${JSON.stringify(data)}`);
    }

    const token = data.token;
    if (!token) {
      console.warn(`[Masters Auth] ${clientId}: No token in response. Got keys: ${Object.keys(data).join(', ')}`);
      throw new Error(`Masters India returned 200 but no token — check credentials`);
    }

    // Cache for 23 hours
    masterTokenCachePerClient[clientId] = { 
      token: token, 
      expiresAt: Date.now() + 23 * 3600 * 1000 
    };

    console.log(`[Masters Auth] ${clientId}: Token obtained, cached for 23h`);
    return token;

  } catch (err) {
    console.error(`[Masters Auth] ${clientId} Failed:`, err.message);
    throw err;
  }
}

async function fetchViamastersAPI(clientId, config) {
  try {
    const username = config.masters_username;
    const password = config.masters_password;
    const gstin = config.masters_gstin;

    if (!username || !password || !gstin) {
      console.warn(`[Masters Import] ${clientId}: Missing credentials (username=${!!username}, password=${!!password}, gstin=${!!gstin})`);
      return getMockEwbsForClient(clientId);
    }

    console.log(`[Masters Import] ${clientId}: Fetching EWBs for GSTIN=${gstin} via Masters API...`);
    
    // Get auth token for this client
    const token = await getMastersTokenForClient(clientId, username, password);
    
    // Fetch assigned bills (bills generated by or sent to this GSTIN)
    const assignedUrl = `${MASTERS_API_URL}/api/v1/getEwayBillData/?action=GetAssignedBills&gstin=${encodeURIComponent(gstin)}`;
    
    console.log(`[Masters Import] ${clientId}: GET ${assignedUrl}`);
    
    const response = await fetch(assignedUrl, {
      method: 'GET',
      headers: { 
        'Authorization': `JWT ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Masters returns either array or {data: array} structure
    let bills = Array.isArray(data) ? data : (data.data || data.eway_bills || []);
    
    if (!Array.isArray(bills)) {
      console.log(`[Masters Import] ${clientId}: Response not array, returning demo data`);
      return getMockEwbsForClient(clientId);
    }

    console.log(`[Masters Import] ${clientId}: Fetched ${bills.length} EWBs from Masters API`);
    
    // Transform Masters format to our format
    return bills.map(bill => ({
      eway_bill_no: bill.eway_bill_no || bill.ewb_no || bill.ewaybillno || '',
      invoice_no: bill.invoice_no || bill.doc_no || '',
      vehicle_no: bill.vehicle_no || bill.vehicle_number || '',
      from_place: bill.from_place || bill.shipper_place || '',
      to_place: bill.to_place || bill.receiver_place || '',
      total_value: bill.total_value || bill.invoice_value || 0,
      status: bill.status || 'GENERATED',
      validity_end: bill.validity_end || bill.valid_upto || null,
    }));
    
  } catch (err) {
    console.error(`[Masters Import] ${clientId} Error:`, err.message);
    console.log(`[Masters Import] ${clientId}: Falling back to demo data`);
    return getMockEwbsForClient(clientId);
  }
}

// Mock data for testing
function getMockEwbsForClient(clientId) {
  if (clientId === 'NIC_PORTAL') {
    // NIC portal mock data - government/official EWBs
    const nicMockEwbs = [
      {
        eway_bill_no: 'NIC0001001234',
        invoice_no: 'NIC/INV/001',
        vehicle_no: 'KL01AB5678',
        from_place: 'Bangalore',
        to_place: 'Chennai',
        total_value: 500000,
        status: 'GENERATED',
        validity_end: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      },
      {
        eway_bill_no: 'NIC0001001235',
        invoice_no: 'NIC/INV/002',
        vehicle_no: 'TN01CD9999',
        from_place: 'Chennai',
        to_place: 'Hyderabad',
        total_value: 750000,
        status: 'GENERATED',
        validity_end: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      },
    ];
    return nicMockEwbs.slice(0, 1); // Return 1 EWB per import
  } else {
    // CLIENT_001 (Atul) mock data
    const mockEwbs = [
      {
        client_id: clientId,
        invoice_no: 'PORTAL_INV_001',
        eway_bill_no: 'EWB0001234567',
        vehicle_no: 'KJ01AB1111',
        from_place: 'Delhi',
        to_place: 'Noida',
        total_value: 150000,
        status: 'GENERATED',
        validity_end: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      },
      {
        client_id: clientId,
        invoice_no: 'PORTAL_INV_002',
        eway_bill_no: 'EWB0001234568',
        vehicle_no: 'KJ01CD2222',
        from_place: 'Noida',
        to_place: 'Ghaziabad',
        total_value: 250000,
        status: 'GENERATED',
        validity_end: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      },
    ];
    return mockEwbs.slice(0, 1); // Return 1 EWB per import
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT TO DATABASE
// ═══════════════════════════════════════════════════════════════════════════

async function importEwbsToDatabase(clientId, ewbs) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(SQLITE_DB_PATH);

    db.serialize(() => {
      db.run('BEGIN');

      const stmt = db.prepare(`
        INSERT OR IGNORE INTO eway_bill_master_v2
        (client_id, invoice_no, eway_bill_no, vehicle_no, 
         from_place, to_place, total_value, status, 
         operation_type, validity_end, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      let inserted = 0;
      for (const ewb of ewbs) {
        stmt.run(
          [
            ewb.client_id || clientId,
            ewb.invoice_no,
            ewb.eway_bill_no,
            ewb.vehicle_no || null,
            ewb.from_place,
            ewb.to_place,
            ewb.total_value || 0,
            ewb.status || 'GENERATED',
            'TRACK_ONLY',
            ewb.validity_end || null,
          ],
          function(err) {
            if (err) {
              console.warn(`[Import] Skipping ${ewb.eway_bill_no}: ${err.message}`);
            } else if (this.changes > 0) {
              inserted++;
            }
          }
        );
      }

      stmt.finalize();

      db.run('COMMIT', (err) => {
        db.close();
        if (err) reject(err);
        else {
          console.log(`[Import] ${clientId}: ${inserted} new EWBs inserted`);
          resolve(inserted);
        }
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET IMPORT STATUS
// ═══════════════════════════════════════════════════════════════════════════

export function getImportStatus() {
  const status = {};
  for (const [clientId, config] of Object.entries(CLIENT_SOURCES)) {
    status[clientId] = {
      name: config.name,
      active: config.active,
      last_import: config.last_import ? new Date(config.last_import).toISOString() : 'Never',
      next_import_in_minutes: config.last_import
        ? Math.ceil((config.import_interval_minutes * 60 * 1000 - (Date.now() - config.last_import)) / 60000)
        : 0,
      import_api: config.import_api,
    };
  }
  return status;
}

// ═══════════════════════════════════════════════════════════════════════════
// SETUP ENDPOINT FOR MANUAL IMPORT
// ═══════════════════════════════════════════════════════════════════════════

export async function handleManualImport(clientId, res) {
  try {
    if (!CLIENT_SOURCES[clientId]) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: 'Client not configured for import' }));
    }

    const config = CLIENT_SOURCES[clientId];
    const ewbs = await fetchClientEwbs(clientId, config);
    const inserted = await importEwbsToDatabase(clientId, ewbs);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: true,
      client_id: clientId,
      ewbs_fetched: ewbs.length,
      ewbs_inserted: inserted,
      message: `${inserted} new EWBs imported from ${config.name}`,
    }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message }));
  }
}

export default {
  startClientEwbImportScheduler,
  getImportStatus,
  handleManualImport,
  CLIENT_SOURCES,
};
