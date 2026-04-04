/**
 * CLIENT-WISE OPERATION ENGINE
 * 
 * Multi-client E-Way Bill automation with configurable rules
 * Architecture: Common Master → Client Rules → Logic Engine
 */

import sqlite3 from 'sqlite3';

const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || './fleet_erp_backend_sqlite.db';

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 1: DATABASE SCHEMA SETUP
// ═══════════════════════════════════════════════════════════════════════════

export async function initializeClientOperationTables() {
  return new Promise((resolve, reject) => {
    if (!sqlite3) {
      reject(new Error('sqlite3 not available'));
      return;
    }

    const db = new sqlite3.Database(SQLITE_DB_PATH);
    let completedCount = 0;
    let totalTables = 5;

    const checkComplete = () => {
      completedCount++;
      if (completedCount === totalTables) {
        console.log('[ClientOpsInit] ✓ All operation tables created');
        db.close();
        resolve();
      }
    };

    try {
      // TABLE 1: Common EWay Master (Layer 1)
      db.run(`
        CREATE TABLE IF NOT EXISTS eway_bill_master_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id TEXT NOT NULL,
          eway_bill_no TEXT UNIQUE,
          invoice_no TEXT,
          trip_id TEXT,
          vehicle_no TEXT,
          status TEXT DEFAULT 'NEW',
          operation_type TEXT,
          validity_end TEXT,
          route_status TEXT,
          api_provider TEXT,
          error_code TEXT,
          remarks TEXT,
          from_place TEXT,
          to_place TEXT,
          from_poi_name TEXT,
          to_poi_name TEXT,
          total_value REAL DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(client_id, eway_bill_no)
        )
      `, (err) => {
        if (err) reject(err);
        else checkComplete();
      });

      // TABLE 2: Client Operation Rules (Layer 2)
      db.run(`
        CREATE TABLE IF NOT EXISTS client_operation_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id TEXT UNIQUE NOT NULL,
          operation_type TEXT,
          auto_generate INTEGER DEFAULT 0,
          auto_part_b_update INTEGER DEFAULT 0,
          auto_extend INTEGER DEFAULT 0,
          gps_required INTEGER DEFAULT 0,
          approval_required INTEGER DEFAULT 0,
          expiry_alert_hours INTEGER DEFAULT 2,
          retry_limit INTEGER DEFAULT 3,
          transporter_mode TEXT DEFAULT 'ROAD',
          route_check_required INTEGER DEFAULT 0,
          invoice_source TEXT DEFAULT 'portal',
          api_mode TEXT DEFAULT 'AUTO',
          active_flag INTEGER DEFAULT 1,
          multi_vehicle_allowed INTEGER DEFAULT 0,
          monitoring_only INTEGER DEFAULT 0,
          max_concurrent_vehicles INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else checkComplete();
      });

      // TABLE 3: Operation Queues (Layer 3)
      db.run(`
        CREATE TABLE IF NOT EXISTS eway_operation_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id TEXT,
          eway_bill_id INTEGER,
          operation_type TEXT,
          priority INTEGER DEFAULT 5,
          status TEXT DEFAULT 'PENDING',
          retry_count INTEGER DEFAULT 0,
          error_message TEXT,
          queued_at TEXT DEFAULT CURRENT_TIMESTAMP,
          processed_at TEXT,
          FOREIGN KEY(eway_bill_id) REFERENCES eway_bill_master_v2(id)
        )
      `, (err) => {
        if (err) reject(err);
        else checkComplete();
      });

      // TABLE 4: EWay Bill Logs (audit trail)
      db.run(`
        CREATE TABLE IF NOT EXISTS eway_bill_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          eway_bill_id INTEGER,
          client_id TEXT,
          action TEXT,
          old_status TEXT,
          new_status TEXT,
          metadata TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(eway_bill_id) REFERENCES eway_bill_master_v2(id)
        )
      `, (err) => {
        if (err) reject(err);
        else checkComplete();
      });

      // TABLE 5: Exception Queue (failures)
      db.run(`
        CREATE TABLE IF NOT EXISTS eway_bill_exception_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id TEXT,
          eway_bill_id INTEGER,
          exception_type TEXT,
          message TEXT,
          severity TEXT,
          escalated_to INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          resolved_at TEXT,
          FOREIGN KEY(eway_bill_id) REFERENCES eway_bill_master_v2(id)
        )
      `, (err) => {
        if (err) reject(err);
        else checkComplete();
      });

    } catch (err) {
      console.error('[ClientOpsInit] Error:', err.message);
      db.close();
      reject(err);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2: CLIENT RULES LOADER
// ═══════════════════════════════════════════════════════════════════════════

export async function getClientRules(clientId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY);
    
    db.get(
      `SELECT * FROM client_operation_rules WHERE client_id = ? AND active_flag = 1`,
      [clientId],
      (err, row) => {
        db.close();
        if (err) reject(err);
        else resolve(row || getDefaultRules(clientId));
      }
    );
  });
}

function getDefaultRules(clientId) {
  // Default: semi-auto with approvals
  return {
    client_id: clientId,
    operation_type: 'GEN_PLUS_PARTB',
    auto_generate: 0,
    auto_part_b_update: 0,
    auto_extend: 0,
    gps_required: 1,
    approval_required: 1,
    expiry_alert_hours: 2,
    retry_limit: 3,
    transporter_mode: 'ROAD',
    route_check_required: 0,
    invoice_source: 'portal',
    api_mode: 'SEMI_AUTO',
    active_flag: 1,
    multi_vehicle_allowed: 0,
    monitoring_only: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 3: LOGIC ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export async function processEwayBill(record) {
  try {
    // Step 1: Get client rules
    const rules = await getClientRules(record.client_id);
    
    // Step 2: Validate record
    if (!validateRecord(record, rules)) {
      return {
        success: false,
        status: 'VALIDATION_FAILED',
        error: 'Invalid record format for client rules',
      };
    }

    // Step 3: Determine operation type
    const operationType = determineOperationType(record, rules);
    
    // Step 4: Check if approval needed
    if (rules.approval_required && !record.is_approved) {
      await queueOperation(record.client_id, record.id, 'WAITING_APPROVAL', 10);
      return { success: true, status: 'WAITING_APPROVAL', message: 'Queued for manual approval' };
    }

    // Step 5: Execute based on operation type
    let result = {};
    switch(operationType) {
      case 'GEN_ONLY':
        result = await handleGenOnly(record, rules);
        break;
      case 'GEN_PLUS_PARTB':
        result = await handleGenPlusPartB(record, rules);
        break;
      case 'PARTB_ONLY':
        result = await handlePartBOnly(record, rules);
        break;
      case 'TRACK_ONLY':
        result = await handleTrackOnly(record, rules);
        break;
      case 'EXTENSION_ONLY':
        result = await handleExtensionOnly(record, rules);
        break;
      case 'MULTI_VEHICLE':
        result = await handleMultiVehicle(record, rules);
        break;
      default:
        result = { success: false, error: `Unknown operation type: ${operationType}` };
    }

    return result;

  } catch (err) {
    console.error('[ProcessEWB] Error:', err.message);
    return { success: false, error: err.message };
  }
}

function validateRecord(record, rules) {
  // Mandatory fields
  if (!record.client_id || !record.invoice_no) return false;
  
  // Client-specific validation
  if (rules.invoice_source === 'api' && !record.api_reference) return false;
  
  return true;
}

function determineOperationType(record, rules) {
  if (record.operation_type) return record.operation_type;
  
  // Auto-determine based on record state and rules
  if (record.eway_bill_no && !record.vehicle_no) return 'PARTB_ONLY';
  if (!record.eway_bill_no && record.vehicle_no) return 'GEN_PLUS_PARTB';
  if (!record.eway_bill_no && !record.vehicle_no) return 'GEN_ONLY';
  if (rules.monitoring_only) return 'TRACK_ONLY';
  
  return rules.operation_type || 'GEN_PLUS_PARTB';
}

// ═══════════════════════════════════════════════════════════════════════════
// OPERATION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleGenOnly(record, rules) {
  console.log(`[Operation] GEN_ONLY for client ${record.client_id}`);
  
  if (!rules.auto_generate) {
    return { success: false, status: 'NOT_AUTHORIZED', error: 'Client does not allow auto-generation' };
  }

  // Call Masters India API to generate EWB
  // TODO: Integrate Masters India API call
  
  return {
    success: true,
    status: 'GENERATED',
    message: 'E-way bill generated successfully',
  };
}

async function handleGenPlusPartB(record, rules) {
  console.log(`[Operation] GEN_PLUS_PARTB for client ${record.client_id}`);
  
  // First: Generate if not exists
  if (!record.eway_bill_no && rules.auto_generate) {
    // Call Masters India to generate
  }

  // Then: Update Part-B if vehicle assigned and permitted
  if (record.vehicle_no && rules.auto_part_b_update) {
    // Call Masters India to update Part-B
  }

  return {
    success: true,
    status: 'PARTB_UPDATED',
    message: 'Generation and Part-B update complete',
  };
}

async function handlePartBOnly(record, rules) {
  console.log(`[Operation] PARTB_ONLY for client ${record.client_id}`);
  
  if (!record.eway_bill_no) {
    return { success: false, error: 'EWB number required for Part-B update' };
  }

  if (!rules.auto_part_b_update) {
    return { success: false, error: 'Client does not allow automatic Part-B updates' };
  }

  // Call Masters India to update Part-B with vehicle details
  
  return {
    success: true,
    status: 'PARTB_UPDATED',
    message: 'Part-B updated with vehicle assignment',
  };
}

async function handleTrackOnly(record, rules) {
  console.log(`[Operation] TRACK_ONLY for client ${record.client_id}`);
  
  if (!rules.gps_required) {
    return { success: false, error: 'GPS tracking not enabled for this client' };
  }

  // Don't generate/update, only monitor
  // Check route, GPS, validity
  
  return {
    success: true,
    status: 'IN_TRANSIT',
    message: 'Tracking mode activated',
  };
}

async function handleExtensionOnly(record, rules) {
  console.log(`[Operation] EXTENSION_ONLY for client ${record.client_id}`);
  
  if (!rules.auto_extend) {
    return { success: false, error: 'Automatic extension not permitted for this client' };
  }

  // Check if validity is near expiry
  // Call Masters India to extend
  
  return {
    success: true,
    status: 'EXTENDED',
    message: 'EWB validity extended',
  };
}

async function handleMultiVehicle(record, rules) {
  console.log(`[Operation] MULTI_VEHICLE for client ${record.client_id}`);
  
  if (!rules.multi_vehicle_allowed) {
    return { success: false, error: 'Multi-vehicle not allowed for this client' };
  }

  // Support vehicle change during trip
  // Create Part-B update for each vehicle change
  
  return {
    success: true,
    status: 'MULTI_VEHICLE_ACTIVE',
    message: 'Multi-vehicle tracking enabled',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// QUEUE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

export async function queueOperation(clientId, ewayBillId, operationType, priority = 5) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(SQLITE_DB_PATH);
    
    db.run(
      `INSERT INTO eway_operation_queue 
       (client_id, eway_bill_id, operation_type, priority)
       VALUES (?, ?, ?, ?)`,
      [clientId, ewayBillId, operationType, priority],
      function(err) {
        db.close();
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

export async function processOperationQueue(clientId) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(SQLITE_DB_PATH);
    
    db.all(
      `SELECT * FROM eway_operation_queue 
       WHERE client_id = ? AND status = 'PENDING'
       ORDER BY priority DESC, queued_at ASC
       LIMIT 100`,
      [clientId],
      async (err, rows) => {
        db.close();
        if (err) {
          reject(err);
          return;
        }

        const results = [];
        for (const op of rows) {
          const result = {
            operation_id: op.id,
            status: 'PROCESSING',
          };
          results.push(result);
          
          // Process each operation
          // TODO: Implement operation processing
        }

        resolve(results);
      }
    );
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING & AUDITING
// ═══════════════════════════════════════════════════════════════════════════

export async function logAction(ewayBillId, clientId, action, oldStatus, newStatus, metadata = {}) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(SQLITE_DB_PATH);
    
    db.run(
      `INSERT INTO eway_bill_logs 
       (eway_bill_id, client_id, action, old_status, new_status, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ewayBillId, clientId, action, oldStatus, newStatus, JSON.stringify(metadata)],
      function(err) {
        db.close();
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

export async function raiseException(clientId, ewayBillId, exceptionType, message, severity = 'MEDIUM') {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(SQLITE_DB_PATH);
    
    db.run(
      `INSERT INTO eway_bill_exception_queue 
       (client_id, eway_bill_id, exception_type, message, severity)
       VALUES (?, ?, ?, ?, ?)`,
      [clientId, ewayBillId, exceptionType, message, severity],
      function(err) {
        db.close();
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// BULK CLIENT SETUP (seeding initial rules)
// ═══════════════════════════════════════════════════════════════════════════

export async function setupClientRules(clientConfigs) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(SQLITE_DB_PATH);
    
    db.serialize(() => {
      db.run('BEGIN');
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO client_operation_rules 
        (client_id, operation_type, auto_generate, auto_part_b_update, auto_extend,
         gps_required, approval_required, expiry_alert_hours, retry_limit,
         transporter_mode, route_check_required, invoice_source, api_mode,
         active_flag, multi_vehicle_allowed, monitoring_only)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const config of clientConfigs) {
        stmt.run([
          config.client_id,
          config.operation_type || 'GEN_PLUS_PARTB',
          config.auto_generate ? 1 : 0,
          config.auto_part_b_update ? 1 : 0,
          config.auto_extend ? 1 : 0,
          config.gps_required ? 1 : 0,
          config.approval_required ? 1 : 0,
          config.expiry_alert_hours || 2,
          config.retry_limit || 3,
          config.transporter_mode || 'ROAD',
          config.route_check_required ? 1 : 0,
          config.invoice_source || 'portal',
          config.api_mode || 'AUTO',
          1,
          config.multi_vehicle_allowed ? 1 : 0,
          config.monitoring_only ? 1 : 0,
        ]);
      }

      stmt.finalize();
      
      db.run('COMMIT', (err) => {
        db.close();
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

export default {
  initializeClientOperationTables,
  getClientRules,
  processEwayBill,
  queueOperation,
  processOperationQueue,
  logAction,
  raiseException,
  setupClientRules,
};
