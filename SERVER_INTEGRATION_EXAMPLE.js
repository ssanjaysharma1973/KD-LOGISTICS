/**
 * HOW TO INTEGRATE CLIENT OPERATION ENGINE INTO server.js
 * 
 * Copy these examples into your server.js at appropriate locations
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. AT TOP OF server.js (Add imports)
// ═══════════════════════════════════════════════════════════════════════════

/*
import clientOpsRoutes from './src/api/clientOperationRoutes.js';
import {
  initializeClientOperationTables,
  setupClientRules,
} from './src/services/clientOperationEngine.js';
import { CLIENT_CONFIGURATIONS } from './src/config/clientConfigurations.js';
*/

// ═══════════════════════════════════════════════════════════════════════════
// 2. DURING SERVER INITIALIZATION (After database connection)
// ═══════════════════════════════════════════════════════════════════════════

/*
// Initialize Client Operation Engine
(async () => {
  try {
    console.log('[System] Initializing Client Operation Engine...');
    
    // Create operation tables
    await initializeClientOperationTables();
    console.log('[✓] Client operation tables initialized');
    
    // Setup default client configurations
    await setupClientRules(CLIENT_CONFIGURATIONS);
    console.log('[✓] Default client rules loaded (6 clients configured)');
    
  } catch (err) {
    console.error('[ERROR] Failed to initialize Client Operation Engine:', err.message);
    // Non-fatal - system continues with existing clients
  }
})();
*/

// ═══════════════════════════════════════════════════════════════════════════
// 3. ADD ROUTES TO server.js (Find where other routes are mounted)
// ═══════════════════════════════════════════════════════════════════════════

/*
// Client Operations Engine endpoints
server.on('request', (req, res) => {
  
  // ... existing routes ...
  
  // NEW ROUTES for Client Operations
  if (req.url.startsWith('/api/client-ops/')) {
    const urlPath = req.url.split('?')[0];
    
    if (urlPath === '/api/client-ops/init' && req.method === 'POST') {
      return clientOpsRoutes.handleInitializeOps(req, res);
    }
    
    if (urlPath === '/api/client-ops/rules' && req.method === 'GET') {
      return clientOpsRoutes.handleGetClientRules(req, res);
    }
    
    if (urlPath === '/api/client-ops/process-ewb' && req.method === 'POST') {
      return clientOpsRoutes.handleProcessEwb(req, res);
    }
    
    if (urlPath === '/api/client-ops/queue' && req.method === 'GET') {
      return clientOpsRoutes.handleGetOperationQueue(req, res);
    }
    
    if (urlPath === '/api/client-ops/configs' && req.method === 'GET') {
      return clientOpsRoutes.handleGetConfigurations(req, res);
    }
    
    if (urlPath === '/api/client-ops/matrix' && req.method === 'GET') {
      return clientOpsRoutes.handleGetOperationMatrix(req, res);
    }
    
    if (urlPath === '/api/client-ops/operation-types' && req.method === 'GET') {
      return clientOpsRoutes.handleGetOperationTypes(req, res);
    }
    
    if (urlPath === '/api/client-ops/scenarios' && req.method === 'GET') {
      return clientOpsRoutes.handleGetScenarios(req, res);
    }
    
    if (urlPath === '/api/client-ops/dashboard' && req.method === 'GET') {
      return clientOpsRoutes.handleGetDashboard(req, res);
    }
  }
  
  // ... rest of routes ...
});
*/

// ═══════════════════════════════════════════════════════════════════════════
// 4. INTEGRATE WITH EXISTING E-WAY BILL IMPORTS
// ═══════════════════════════════════════════════════════════════════════════

/*
// When importing E-way bills (existing code location)
import { processEwayBill } from './src/services/clientOperationEngine.js';

// In import/trigger function:
async function importEwayBills(records) {
  for (const record of records) {
    try {
      // NEW: Route through operation engine
      const result = await processEwayBill({
        client_id: record.client_id || 'DEFAULT',
        invoice_no: record.invoice_no,
        vehicle_no: record.vehicle_no,
        from_place: record.from_place,
        to_place: record.to_place,
        total_value: record.total_value,
        eway_bill_no: record.eway_bill_no || null,
        is_approved: false,
      });
      
      if (!result.success) {
        console.warn(`[Import] Failed to process ${record.invoice_no}: ${result.message}`);
      }
    } catch (err) {
      console.error(`[Import] Error processing ${record.invoice_no}:`, err.message);
    }
  }
}
*/

// ═══════════════════════════════════════════════════════════════════════════
// 5. SCHEDULER INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════

/*
import { processOperationQueue } from './src/services/clientOperationEngine.js';

// Add new scheduler for operation queue processing
// Every 5 minutes, process pending operations for each client
setInterval(async () => {
  try {
    const clients = ['CLIENT_A', 'CLIENT_B', 'CLIENT_C', 'CLIENT_D', 'CLIENT_E'];
    
    for (const clientId of clients) {
      const result = await processOperationQueue(clientId);
      if (result.length > 0) {
        console.log(`[Operation Queue] Processed ${result.length} operations for ${clientId}`);
      }
    }
  } catch (err) {
    console.error('[Operation Queue] Error:', err.message);
  }
}, 5 * 60 * 1000); // 5 minutes
*/

// ═══════════════════════════════════════════════════════════════════════════
// 6. PRACTICAL EXAMPLE: POST endpoint to submit invoice for processing
// ═══════════════════════════════════════════════════════════════════════════

/*
// Add this to your routes - allows submitting invoice for operation
if (req.url === '/api/invoice/submit' && req.method === 'POST') {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      
      // Route through operation engine
      const result = await processEwayBill({
        client_id: data.client_id || 'DEFAULT',
        invoice_no: data.invoice_no,
        vehicle_no: data.vehicle_no || null,
        from_place: data.from_place,
        to_place: data.to_place,
        total_value: data.total_value,
      });
      
      res.statusCode = result.success ? 200 : 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  });
  return;
}
*/

// ═══════════════════════════════════════════════════════════════════════════
// 7. TEST COMMANDS
// ═══════════════════════════════════════════════════════════════════════════

const TEST_COMMANDS = {
  
  // Initialize system
  init: `
  curl -X POST http://localhost:3000/api/client-ops/init \\
    -H "Authorization: MasterKey your-key"
  `,
  
  // Check CLIENT_A rules
  check_rules_a: `
  curl "http://localhost:3000/api/client-ops/rules?client_id=CLIENT_A"
  `,
  
  // Check CLIENT_B rules (approval-based)
  check_rules_b: `
  curl "http://localhost:3000/api/client-ops/rules?client_id=CLIENT_B"
  `,
  
  // Process invoice for CLIENT_A (auto)
  process_auto: `
  curl -X POST http://localhost:3000/api/client-ops/process-ewb \\
    -H "Content-Type: application/json" \\
    -d '{
      "client_id": "CLIENT_A",
      "invoice_no": "INV001",
      "vehicle_no": "KJ01AB1234",
      "from_place": "Delhi",
      "to_place": "Bangalore",
      "total_value": 50000
    }'
  `,
  
  // Process invoice for CLIENT_B (needs approval)
  process_approval: `
  curl -X POST http://localhost:3000/api/client-ops/process-ewb \\
    -H "Content-Type: application/json" \\
    -d '{
      "client_id": "CLIENT_B",
      "invoice_no": "PHARM001",
      "vehicle_no": "KJ01CD5678",
      "from_place": "Mumbai",
      "to_place": "Pune",
      "total_value": 2000000
    }'
  `,
  
  // Get queue for CLIENT_B
  get_queue: `
  curl "http://localhost:3000/api/client-ops/queue?client_id=CLIENT_B"
  `,
  
  // View all configs
  view_configs: `
  curl "http://localhost:3000/api/client-ops/configs"
  `,
  
  // View operation matrix
  view_matrix: `
  curl "http://localhost:3000/api/client-ops/matrix"
  `,
  
  // View dashboard
  dashboard: `
  curl "http://localhost:3000/api/client-ops/dashboard"
  `,
};

// ═══════════════════════════════════════════════════════════════════════════
// 8. EXPECTED API RESPONSES
// ═══════════════════════════════════════════════════════════════════════════

const RESPONSE_EXAMPLES = {
  
  // CLIENT_A (AUTO) processes immediately
  auto_response: {
    success: true,
    status: 'GENERATED',  // or PARTB_UPDATED, IN_TRANSIT, etc.
    message: 'E-way bill generated successfully',
    eway_bill_no: 'EWB0000123456',
    operation_type: 'GEN_PLUS_PARTB',
    client_id: 'CLIENT_A',
    invoice_no: 'INV001',
  },
  
  // CLIENT_B (APPROVAL) queues for review
  approval_response: {
    success: true,
    status: 'WAITING_APPROVAL',
    message: 'Operation queued. Awaiting admin approval.',
    operation_id: 1,
    priority: 10,
    client_id: 'CLIENT_B',
    next_action: 'Manual review required by admin',
  },
  
  // CLIENT_D (TRACKING) monitors external EWB
  tracking_response: {
    success: true,
    status: 'IN_TRANSIT',
    message: 'EWB imported and monitoring started',
    eway_bill_no: 'EWB0000654321',
    operation_type: 'TRACK_ONLY',
    monitoring: true,
    gps_tracking: 'ACTIVE',
  },
  
  // Queue response
  queue_response: {
    client_id: 'CLIENT_B',
    pending_operations: 3,
    operations: [
      {
        operation_id: 1,
        eway_bill_id: 100,
        invoke_type: 'WAITING_APPROVAL',
        priority: 10,
        queued_at: '2026-04-04T10:30:00Z',
      },
      {
        operation_id: 2,
        eway_bill_id: 101,
        operation_type: 'WAITING_APPROVAL',
        priority: 9,
        queued_at: '2026-04-04T10:35:00Z',
      }
    ],
  },
  
  // Rules response
  rules_response: {
    client_id: 'CLIENT_A',
    rules: {
      auto_generate: true,
      auto_part_b_update: true,
      auto_extend: true,
      approval_required: false,
      gps_required: true,
      monitoring_only: false,
      api_mode: 'AUTO',
      operation_type: 'GEN_PLUS_PARTB',
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 9. DAILY DOWNLOAD AUTOMATION (For CLIENT_A example)
// ═══════════════════════════════════════════════════════════════════════════

/*
import fs from 'fs';
import path from 'path';

// Add scheduler for daily downloads
setInterval(async () => {
  const now = new Date();
  const isNoon = now.getHours() === 12 && now.getMinutes() === 0;
  
  if (isNoon) {
    try {
      console.log('[Scheduler] Daily EWB download triggered');
      
      // Get active EWBs for CLIENT_A from last 24 hours
      const query = `
        SELECT * FROM eway_bill_master_v2
        WHERE client_id = 'CLIENT_A'
        AND created_at > datetime('now', '-1 day')
        AND status IN ('GENERATED', 'IN_TRANSIT', 'COMPLETED')
        ORDER BY created_at DESC
      `;
      
      const results = db.prepare(query).all();
      
      if (results.length > 0) {
        // Generate Excel file
        const fileName = \`\${now.toISOString().split('T')[0]}_CLIENT_A_EWBs.xlsx\`;
        const filePath = path.join('./exports', fileName);
        
        // Create export (assuming you have export logic)
        await createExcelExport(results, filePath);
        
        // Optional: Upload to S3, email, move to NAS, etc.
        console.log(\`[Export] Created: \${fileName}\`);
      }
    } catch (err) {
      console.error('[Scheduler Error]', err.message);
    }
  }
}, 60 * 1000); // Check every minute
*/

// ═══════════════════════════════════════════════════════════════════════════
// 10. MONITORING & ALERTS
// ═══════════════════════════════════════════════════════════════════════════

/*
// Alert if too many operations in queue
setInterval(async () => {
  try {
    const query = `
      SELECT client_id, COUNT(*) count
      FROM eway_operation_queue
      WHERE status = 'PENDING'
      GROUP BY client_id
    `;
    
    const results = db.prepare(query).all();
    
    results.forEach(row => {
      if (row.count > 100) {
        console.warn(
          \`[ALERT] Client \${row.client_id} has \${row.count} pending operations!\`
        );
        // Send email alert, Slack notification, etc.
      }
    });
  } catch (err) {
    console.error('[Monitoring Error]', err.message);
  }
}, 10 * 60 * 1000); // Every 10 minutes
*/

export { TEST_COMMANDS, RESPONSE_EXAMPLES };
