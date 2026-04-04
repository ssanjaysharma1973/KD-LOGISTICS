/**
 * CLIENT OPERATION CONFIGURATIONS
 * 
 * Pre-configured rule sets for different client types
 * These can be loaded into client_operation_rules table on startup
 */

export const CLIENT_CONFIGURATIONS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENT A: FULL AUTOMATION (Large regular plant)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    client_id: 'CLIENT_A',
    client_name: 'Large Manufacturing Plant',
    operation_type: 'GEN_PLUS_PARTB',
    auto_generate: true,           // ✓ Auto-generate from invoice
    auto_part_b_update: true,      // ✓ Auto-update with vehicle
    auto_extend: true,             // ✓ Auto-extend near expiry
    gps_required: true,            // ✓ Mandatory GPS tracking
    approval_required: false,      // ✗ No approval needed
    expiry_alert_hours: 2,         // Alert 2 hours before expiry
    retry_limit: 3,
    transporter_mode: 'ROAD',
    route_check_required: true,    // ✓ Validate route
    invoice_source: 'api',         // Invoices come via API
    api_mode: 'AUTO',              // Fully automatic
    multi_vehicle_allowed: false,
    monitoring_only: false,
    max_concurrent_vehicles: 50,
    description: 'High-volume regular client. Invoices automated. Full auto operation.'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENT B: APPROVAL-BASED (Sensitive/High-value transactions)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    client_id: 'CLIENT_B',
    client_name: 'Premium Pharmaceutical Client',
    operation_type: 'GEN_PLUS_PARTB',
    auto_generate: false,          // ✗ Manual approval for generation
    auto_part_b_update: false,     // ✗ Manual approval for Part-B
    auto_extend: false,            // ✗ Manual approval for extension
    gps_required: true,            // ✓ Mandatory GPS tracking
    approval_required: true,       // ✓ All actions need manual approval
    expiry_alert_hours: 4,         // Alert 4 hours before expiry
    retry_limit: 1,                // Strict - low retry
    transporter_mode: 'ROAD',
    route_check_required: true,    // ✓ Strict route validation
    invoice_source: 'portal',      // Manual invoice entry
    api_mode: 'SEMI_AUTO',         // Semi-automatic
    multi_vehicle_allowed: false,
    monitoring_only: false,
    max_concurrent_vehicles: 5,
    description: 'High-value sensitive shipments. All actions require manual admin approval.'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENT C: CUSTOMER ENTRY + AUTO TRANSPORT (Retail/Distribution)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    client_id: 'CLIENT_C',
    client_name: 'Retail Distribution Network',
    operation_type: 'GEN_PLUS_PARTB',
    auto_generate: true,           // ✓ Auto-generate once data complete
    auto_part_b_update: true,      // ✓ Auto-update after vehicle assignment
    auto_extend: true,             // ✓ Auto-extend
    gps_required: false,           // ✗ GPS not required (local routes)
    approval_required: false,      // ✗ No approval needed
    expiry_alert_hours: 3,
    retry_limit: 2,
    transporter_mode: 'ROAD',
    route_check_required: false,   // ✗ No strict route check
    invoice_source: 'portal',      // Customer fills invoice
    api_mode: 'AUTO',              // Automatic once filled
    multi_vehicle_allowed: true,   // ✓ Route via multiple vehicles
    monitoring_only: false,
    max_concurrent_vehicles: 20,
    description: 'Customer enters invoice/consignment. System auto-handles vehicle assignment & Part-B.'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENT D: TRACKING & MONITORING ONLY (3PL integration)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    client_id: 'CLIENT_D',
    client_name: '3PL Logistics Partner',
    operation_type: 'TRACK_ONLY',
    auto_generate: false,          // ✗ EWBs generated externally
    auto_part_b_update: false,     // ✗ Part-B updated externally
    auto_extend: false,            // ✗ Extension handled externally
    gps_required: true,            // ✓ Mandatory tracking
    approval_required: false,      // ✗ No approval (external system)
    expiry_alert_hours: 6,         // Early alert (6 hours)
    retry_limit: 1,
    transporter_mode: 'ROAD',
    route_check_required: true,    // ✓ Strict route validation
    invoice_source: 'external',    // EWBs imported from 3PL system
    api_mode: 'PASSIVE',           // Only import & monitor
    multi_vehicle_allowed: false,
    monitoring_only: true,         // ✓ Tracking mode only
    max_concurrent_vehicles: 100,
    description: 'EWBs managed by 3PL. Our system imports, monitors route, tracks validity, alerts on expiry.'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENT E: MULTI-VEHICLE TRANSPORT (Long-haul with vehicle changes)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    client_id: 'CLIENT_E',
    client_name: 'Inter-State Transport Operator',
    operation_type: 'MULTI_VEHICLE',
    auto_generate: true,           // ✓ Auto-generate
    auto_part_b_update: true,      // ✓ Auto-update with first vehicle
    auto_extend: true,             // ✓ Auto-extend if needed
    gps_required: true,            // ✓ GPS tracking mandatory
    approval_required: false,      // ✗ No approval
    expiry_alert_hours: 2,
    retry_limit: 3,
    transporter_mode: 'ROAD',
    route_check_required: true,    // ✓ Validate multi-leg route
    invoice_source: 'api',
    api_mode: 'AUTO',
    multi_vehicle_allowed: true,   // ✓ CRITICAL: Multi-vehicle support
    monitoring_only: false,
    max_concurrent_vehicles: 200,
    description: 'Long-haul routes with vehicle changes. Auto Part-B updates for each vehicle change. Multi-stop support.'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENT_001: ATUL LOGISTICS (Client generates & updates, we monitor)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    client_id: 'CLIENT_001',
    client_name: 'Atul logistics',
    operation_type: 'TRACK_ONLY',
    auto_generate: false,          // ✗ Client generates EWB
    auto_part_b_update: false,     // ✗ Client updates Part-B
    auto_extend: true,             // ✓ Auto-extend near expiry (our system)
    gps_required: true,            // ✓ Mandatory GPS tracking
    approval_required: false,      // ✗ No approval needed (client handles)
    expiry_alert_hours: 8,         // Alert 8 hours before expiry
    retry_limit: 3,
    transporter_mode: 'ROAD',
    route_check_required: true,    // ✓ Validate route
    invoice_source: 'external',    // Client generates EWB, we import
    api_mode: 'PASSIVE',           // Import & monitor only
    multi_vehicle_allowed: true,   // ✓ Supports vehicle changes
    monitoring_only: true,         // ✓ Tracking mode only
    max_concurrent_vehicles: 100,
    description: 'Client generates EWB & updates Part-B. We import, track GPS, validate route, auto-extend, & alert on expiry.'
  },

  // Default fallback for unmapped clients
  {
    client_id: 'DEFAULT',
    client_name: 'Default (mapped clients)',
    operation_type: 'GEN_PLUS_PARTB',
    auto_generate: false,
    auto_part_b_update: false,
    auto_extend: false,
    gps_required: true,
    approval_required: true,
    expiry_alert_hours: 2,
    retry_limit: 3,
    transporter_mode: 'ROAD',
    route_check_required: false,
    invoice_source: 'portal',
    api_mode: 'SEMI_AUTO',
    multi_vehicle_allowed: false,
    monitoring_only: false,
    max_concurrent_vehicles: 100,
    description: 'Conservative defaults. Requires manual approval.'
  }
];

/**
 * DECISION MATRIX: Client-wise operation capabilities
 * 
 * Format: Shows what each client can do
 */
export const OPERATION_MATRIX = {
  headers: ['Client', 'Generate', 'Part-B', 'Extend', 'GPS', 'Approval', 'Mode', 'Multi-Vehicle'],
  rows: [
    ['CLIENT_A', 'Y', 'Y', 'Y', 'Y', 'N', 'AUTO', 'N'],
    ['CLIENT_B', 'Y', 'Y', 'N', 'Y', 'Y', 'SEMI', 'N'],
    ['CLIENT_C', 'Y', 'Y', 'Y', 'N', 'N', 'AUTO', 'Y'],
    ['CLIENT_D', 'N', 'N', 'Y', 'Y', 'N', 'TRACK', 'N'],
    ['CLIENT_E', 'Y', 'Y', 'Y', 'Y', 'N', 'AUTO', 'Y'],
    ['CLIENT_001', 'N', 'N', 'Y', 'Y', 'N', 'TRACK', 'Y'],
  ]
};

/**
 * OPERATION TYPE MAPPING
 * Defines what operations each type handles
 */
export const OPERATION_TYPES = {
  'GEN_ONLY': {
    description: 'Generate EWB only (no Part-B)',
    steps: ['Generate from Masters'],
    applicable_for: ['Initial generation', 'Partial shipments']
  },
  
  'GEN_PLUS_PARTB': {
    description: 'Generate EWB + update Part-B with vehicle',
    steps: ['Generate from Masters', 'Update Part-B with vehicle', 'Set route'],
    applicable_for: ['Complete shipments', 'Most standard operations']
  },
  
  'PARTB_ONLY': {
    description: 'Update Part-B only (EWB exists)',
    steps: ['Update vehicle details in Part-B', 'Verify route'],
    applicable_for: ['Vehicle reassignment', 'Mid-trip vehicle change']
  },
  
  'TRACK_ONLY': {
    description: 'Import & monitor external EWB',
    steps: ['Import EWB', 'Monitor GPS', 'Check route', 'Alert on expiry'],
    applicable_for: ['3PL integration', 'External EWBs']
  },
  
  'EXTENSION_ONLY': {
    description: 'Extend EWB validity',
    steps: ['Check expiry time', 'Call extension API', 'Update validity_end'],
    applicable_for: ['Delayed shipments', 'Route delays']
  },
  
  'MULTI_VEHICLE': {
    description: 'Support vehicle changes during transit',
    steps: ['Generate with Vehicle 1', 'Update Part-B', 'On change: Part-B with Vehicle 2', 'Continue...'],
    applicable_for: ['Long-haul routes', 'Multi-leg shipments']
  },
  
  'MANUAL_APPROVAL': {
    description: 'Await manual approval before action',
    steps: ['Queue for approval', 'Wait for admin action', 'Execute upon approval'],
    applicable_for: ['High-value shipments', 'Sensitive clients']
  },
  
  'BULK_UPLOAD': {
    description: 'Process bulk invoice upload',
    steps: ['Parse file', 'Validate records', 'Queue for generation'],
    applicable_for: ['Batch imports', 'Month-end uploads']
  }
};

/**
 * STATUS WORKFLOW
 * Universal statuses used across all clients
 */
export const UNIVERSAL_STATUSES = [
  'NEW',                    // Record just created
  'VALIDATED',              // Format/data validation passed
  'WAITING_APPROVAL',       // Awaiting manual approval
  'READY_FOR_GENERATION',   // Ready to call Masters API
  'GENERATED',              // EWB generated successfully
  'PARTB_UPDATED',          // Part-B updated with vehicle
  'IN_TRANSIT',             // Active shipment in transport
  'NEAR_EXPIRY',            // Within expiry alert window
  'EXTENSION_PENDING',      // Extension in progress
  'EXTENDED',               // EWB extended successfully
  'COMPLETED',              // Delivery completed
  'CANCELLED',              // EWB cancelled
  'ERROR',                  // Failed/error state
];

/**
 * Real-life scenario mapping
 */
export const SCENARIOS = {
  'scenario_1_plant': {
    name: 'Big Manufacturing Plant',
    client_id: 'CLIENT_A',
    characteristics: ['Many invoices', 'Standard route', 'Own transport', 'Regular timing'],
    use: ['Bulk import', 'Auto generate', 'Auto vehicle mapping', 'GPS expiry check'],
    config_key: 'auto_generate + auto_part_b_update + auto_extend'
  },
  
  'scenario_2_manual': {
    name: 'Small Manual Client',
    client_id: 'CLIENT_B',
    characteristics: ['Low volume', 'Variable format', 'High value', 'Manual approvals'],
    use: ['Portal entry', 'Manual validation', 'Admin confirm before API', 'Strict audit'],
    config_key: 'approval_required + route_check_required'
  },
  
  'scenario_3_3pl': {
    name: '3PL Transport Company',
    client_id: 'CLIENT_D',
    characteristics: ['EWB pre-generated', 'Vehicle already assigned', 'Extended routes'],
    use: ['Import external EWB', 'Part-B update', 'Route tracking', 'Expiry alert'],
    config_key: 'monitoring_only + auto_part_b_update'
  },
  
  'scenario_4_multibranch': {
    name: 'Multi-branch Same Client',
    client_id: 'CLIENT_C',
    characteristics: ['Same GSTIN', 'Different rules by branch', 'Various warehouses'],
    use: ['Branch-level config', 'client_id + branch_id config key', 'Flexible auto/manual'],
    config_key: 'client_id + branch_code = config_key'
  },
  
  'scenario_5_multileg': {
    name: 'Multi-leg Long-haul Transport',
    client_id: 'CLIENT_E',
    characteristics: ['Vehicle changes', 'Multiple stops', 'Extended routes', 'Repeated Part-B'],
    use: ['Multi-vehicle Part-B', 'Stop-level tracking', 'Re-assignment support'],
    config_key: 'multi_vehicle_allowed + auto_part_b_update'
  }
};

export default {
  CLIENT_CONFIGURATIONS,
  OPERATION_MATRIX,
  OPERATION_TYPES,
  UNIVERSAL_STATUSES,
  SCENARIOS,
};
