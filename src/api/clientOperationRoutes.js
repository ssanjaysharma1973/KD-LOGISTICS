/**
 * CLIENT OPERATION ENGINE API ENDPOINTS
 * 
 * Exposes the multi-client automation engine via REST API
 */

import {
  initializeClientOperationTables,
  getClientRules,
  processEwayBill,
  queueOperation,
  processOperationQueue,
  logAction,
  raiseException,
  setupClientRules,
} from '../services/clientOperationEngine.js';

import {
  CLIENT_CONFIGURATIONS,
  OPERATION_MATRIX,
  OPERATION_TYPES,
  UNIVERSAL_STATUSES,
  SCENARIOS,
} from '../config/clientConfigurations.js';

/**
 * Initialize operation tables (admin only, call once)
 * POST /api/client-ops/init
 */
export async function handleInitializeOps(req, res) {
  try {
    // Master key required
    const authHeader = req.headers.authorization || '';
    if (!authHeader.includes('MasterKey')) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'Master key required' }));
    }

    await initializeClientOperationTables();
    await setupClientRules(CLIENT_CONFIGURATIONS);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      success: true,
      message: 'Client operation tables initialized',
      clients_configured: CLIENT_CONFIGURATIONS.length,
      operations_setup: 'Complete',
      operation_types: Object.keys(OPERATION_TYPES).length,
    }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Get client operation rules
 * GET /api/client-ops/rules?client_id=CLIENT_A
 */
export async function handleGetClientRules(req, res) {
  try {
    const clientId = req.query?.client_id || 'DEFAULT';
    const rules = await getClientRules(clientId);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      client_id: clientId,
      rules,
      operation_type_details: OPERATION_TYPES[rules.operation_type],
    }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Process E-Way Bill (main logic entry point)
 * POST /api/client-ops/process-ewb
 * 
 * Body:
 * {
 *   "client_id": "CLIENT_A",
 *   "invoice_no": "INV123",
 *   "vehicle_no": "KJ01AB1234",
 *   "from_place": "Delhi",
 *   "to_place": "Bangalore",
 *   "total_value": 50000,
 *   "is_approved": false
 * }
 */
export async function handleProcessEwb(req, res) {
  try {
    const body = await readBody(req);
    const {
      client_id,
      invoice_no,
      vehicle_no,
      from_place,
      to_place,
      total_value,
      eway_bill_no,
      is_approved,
    } = body;

    if (!client_id || !invoice_no) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'client_id and invoice_no required' }));
    }

    const record = {
      client_id,
      invoice_no,
      vehicle_no: vehicle_no || null,
      from_place: from_place || 'TBD',
      to_place: to_place || 'TBD',
      total_value: total_value || 0,
      eway_bill_no: eway_bill_no || null,
      is_approved: is_approved || false,
    };

    const result = await processEwayBill(record);

    res.statusCode = result.success ? 200 : 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(result));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Get Operation Queue for Client
 * GET /api/client-ops/queue?client_id=CLIENT_A
 */
export async function handleGetOperationQueue(req, res) {
  try {
    const clientId = req.query?.client_id || 'CLIENT_001';
    const results = await processOperationQueue(clientId);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      client_id: clientId,
      pending_operations: results.length,
      operations: results,
    }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Get all client configurations for reference
 * GET /api/client-ops/configs
 */
export async function handleGetConfigurations(req, res) {
  try {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      total_configs: CLIENT_CONFIGURATIONS.length,
      configurations: CLIENT_CONFIGURATIONS.map(c => ({
        client_id: c.client_id,
        client_name: c.client_name,
        operation_type: c.operation_type,
        api_mode: c.api_mode,
        approval_required: c.approval_required,
        auto_generate: c.auto_generate,
        auto_part_b_update: c.auto_part_b_update,
        auto_extend: c.auto_extend,
        monitoring_only: c.monitoring_only,
        multi_vehicle_allowed: c.multi_vehicle_allowed,
        description: c.description,
      })),
    }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Get operation matrix (decision table)
 * GET /api/client-ops/matrix
 */
export async function handleGetOperationMatrix(req, res) {
  try {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      description: 'Client-wise operation capabilities matrix',
      matrix: OPERATION_MATRIX,
      legend: {
        'Y': 'Allowed/Required',
        'N': 'Not allowed',
        'SEMI': 'Semi-automatic',
        'AUTO': 'Fully automatic',
        'TRACK': 'Tracking only',
      }
    }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Get operation type details
 * GET /api/client-ops/operation-types
 */
export async function handleGetOperationTypes(req, res) {
  try {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      total_types: Object.keys(OPERATION_TYPES).length,
      operation_types: OPERATION_TYPES,
      universal_statuses: UNIVERSAL_STATUSES,
    }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Get real-life scenarios
 * GET /api/client-ops/scenarios
 */
export async function handleGetScenarios(req, res) {
  try {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      description: 'Real-life implementation scenarios',
      scenarios: SCENARIOS,
      recommended_approach: 'Design your client configuration based on these scenarios',
    }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * Admin dashboard summary
 * GET /api/client-ops/dashboard
 */
export async function handleGetDashboard(req, res) {
  try {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      system: 'Client-wise Operation Engine',
      version: '1.0.0',
      architecture: {
        layer_1: 'Common EWay Master (eway_bill_master_v2)',
        layer_2: 'Client Operation Rules (client_operation_rules)',
        layer_3: 'Logic Engine (processEwayBill)',
      },
      capabilities: [
        'Per-client rule sets',
        'Automatic operation routing',
        'Operation queuing',
        'Multi-vehicle support',
        'Approval workflows',
        'GPS tracking enforcement',
        'Expiry management',
        'Exception handling',
        'Audit logging',
      ],
      endpoints: {
        init: 'POST /api/client-ops/init',
        get_rules: 'GET /api/client-ops/rules?client_id=CLIENT_A',
        process: 'POST /api/client-ops/process-ewb',
        queue: 'GET /api/client-ops/queue?client_id=CLIENT_A',
        configs: 'GET /api/client-ops/configs',
        matrix: 'GET /api/client-ops/matrix',
        operation_types: 'GET /api/client-ops/operation-types',
        scenarios: 'GET /api/client-ops/scenarios',
        dashboard: 'GET /api/client-ops/dashboard',
      },
      clients_configured: CLIENT_CONFIGURATIONS.length,
      operation_types: Object.keys(OPERATION_TYPES).length,
    }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message }));
  }
}

// Helper: Read request body
async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (err) {
        reject(err);
      }
    });
  });
}

export default {
  handleInitializeOps,
  handleGetClientRules,
  handleProcessEwb,
  handleGetOperationQueue,
  handleGetConfigurations,
  handleGetOperationMatrix,
  handleGetOperationTypes,
  handleGetScenarios,
  handleGetDashboard,
};
