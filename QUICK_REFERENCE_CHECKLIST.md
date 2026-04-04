
# ✅ MULTI-CLIENT OPERATION ENGINE - QUICK REFERENCE

## 📦 Files Created

| File | Purpose | Status |
|------|---------|--------|
| [clientOperationEngine.js](./src/services/clientOperationEngine.js) | Core engine with handlers & queue | ✅ Complete |
| [clientConfigurations.js](./src/config/clientConfigurations.js) | 5 client types pre-configured | ✅ Complete |
| [clientOperationRoutes.js](./src/api/clientOperationRoutes.js) | REST API endpoints | ✅ Complete |
| [MULTI_CLIENT_OPERATION_GUIDE.md](./MULTI_CLIENT_OPERATION_GUIDE.md) | Full documentation | ✅ Complete |
| [SERVER_INTEGRATION_EXAMPLE.js](./SERVER_INTEGRATION_EXAMPLE.js) | How to integrate into server | ✅ Complete |
| **THIS FILE** | Quick reference checklist | ✅ Complete |

---

## 🎯 Five Client Types (Ready to Use)

### CLIENT_A: Large Manufacturing Plant
```
Profile: High volume, regular routes, fully automatic
Rules: auto_generate=✓ auto_part_b=✓ auto_extend=✓ approval=✗ gps=✓
What: Invoice → Auto-generate → Auto-Part-B → Auto-extend
```

### CLIENT_B: Premium Pharma (Approval-Based)
```
Profile: High-value, sensitive, manual approvals
Rules: auto_generate=✗ auto_part_b=✗ auto_extend=✗ approval=✓ gps=✓
What: Invoice → Queue for approval → Manual actions → Strict route check
```

### CLIENT_C: Retail Distribution
```
Profile: Customer entry, auto transport, multi-vehicle
Rules: auto_generate=✓ auto_part_b=✓ auto_extend=✓ approval=✗ multi_vehicle=✓
What: Invoice → Auto-generate → Auto-vehicle → Multi-leg support
```

### CLIENT_D: 3PL Tracking (Monitoring Only)
```
Profile: EWB pre-generated, we only track & monitor
Rules: auto_generate=✗ auto_part_b=✗ monitoring_only=✓ gps=✓
What: Import EWB → Track GPS → Monitor validity → Alert on expiry
```

### CLIENT_E: Multi-Vehicle Long-Haul
```
Profile: Vehicle changes during transit, multiple stops
Rules: auto_generate=✓ auto_part_b=✓ multi_vehicle=✓ gps=✓
What: Generate → Vehicle 1 Part-B → Vehicle change → Vehicle 2 Part-B...
```

---

## 📊 Database Tables

```
TABLE 1: eway_bill_master_v2
├─ Common for ALL clients
├─ Columns: client_id, eway_bill_no, status, operation_type, ...
└─ Same schema, different rules by client_id

TABLE 2: client_operation_rules
├─ One row PER CLIENT
├─ Columns: client_id, auto_generate, auto_part_b_update, approval_required, ...
└─ Determines behavior without code change

TABLE 3: eway_operation_queue
├─ Pending operations
├─ Columns: client_id, operation_type, priority, status, retry_count
└─ For async processing with retries

TABLE 4: eway_bill_logs
├─ Audit trail
├─ Columns: eway_bill_id, action, old_status, new_status, created_at
└─ Full traceability

TABLE 5: eway_bill_exception_queue
├─ Failed/manual cases
├─ Columns: client_id, exception_type, message, severity, escalated_to
└─ Exception visibility
```

---

## 🚀 Getting Started (5 Steps)

### Step 1: Copy Files
```bash
# Files already created in:
📁 src/services/clientOperationEngine.js
📁 src/config/clientConfigurations.js
📁 src/api/clientOperationRoutes.js
```

### Step 2: Initialize System (First Time)
```bash
curl -X POST http://localhost:3000/api/client-ops/init \
  -H "Authorization: MasterKey your-key"
```

**Response:**
```json
{
  "success": true,
  "message": "Client operation tables initialized",
  "clients_configured": 6,
  "operations_setup": "Complete"
}
```

### Step 3: Check Client Rules
```bash
curl "http://localhost:3000/api/client-ops/rules?client_id=CLIENT_A"
```

**Response shows: auto_generate, auto_part_b_update, approval_required, etc.**

### Step 4: Process Invoice
```bash
curl -X POST http://localhost:3000/api/client-ops/process-ewb \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "CLIENT_A",
    "invoice_no": "INV001",
    "vehicle_no": "KJ01AB1234",
    "from_place": "Delhi",
    "to_place": "Bangalore",
    "total_value": 50000
  }'
```

**CLIENT_A Response (Auto):**
```json
{
  "success": true,
  "status": "GENERATED",
  "eway_bill_no": "EWB0000123456"
}
```

**CLIENT_B Response (Needs Approval):**
```json
{
  "success": true,
  "status": "WAITING_APPROVAL",
  "message": "Operation queued. Awaiting admin approval."
}
```

### Step 5: Monitor Queue
```bash
curl "http://localhost:3000/api/client-ops/queue?client_id=CLIENT_B"
```

---

## 🔧 Integration Checklist

- [ ] Import clientOperationEngine.js into server.js
- [ ] Import clientConfigurations.js into server.js
- [ ] Import clientOperationRoutes.js into server.js
- [ ] Add route handlers for `/api/client-ops/*` endpoints
- [ ] Call `initializeClientOperationTables()` on server startup
- [ ] Call `setupClientRules(CLIENT_CONFIGURATIONS)` on startup
- [ ] Replace hardcoded client logic with `processEwayBill()`
- [ ] Add operation queue scheduler (every 5 minutes)
- [ ] Add monitoring/alerts for queue backlog
- [ ] Test with each client type

---

## 🧪 Testing Scenarios

### Test 1: CLIENT_A (Auto)
```bash
# Expected: Processes immediately (status: GENERATED)
POST /api/client-ops/process-ewb {
  "client_id": "CLIENT_A",
  "invoice_no": "TEST_A_001",
  "vehicle_no": "KJ01AB1234",
  "from_place": "Delhi",
  "to_place": "Mumbai",
  "total_value": 100000
}
```

### Test 2: CLIENT_B (Approval)
```bash
# Expected: Queues for approval (status: WAITING_APPROVAL)
POST /api/client-ops/process-ewb {
  "client_id": "CLIENT_B",
  "invoice_no": "TEST_B_001",
  "vehicle_no": "KJ01CD5678",
  "from_place": "Mumbai",
  "to_place": "Pune",
  "total_value": 2000000
}
# Then check queue
GET /api/client-ops/queue?client_id=CLIENT_B
```

### Test 3: CLIENT_D (Tracking)
```bash
# Expected: Imports for tracking (status: IN_TRANSIT)
POST /api/client-ops/process-ewb {
  "client_id": "CLIENT_D",
  "invoice_no": "EXT_D_001",
  "eway_bill_no": "EWB0000654321",
  "vehicle_no": "KJ01EF9999",
  "from_place": "Bangalore",
  "to_place": "Hyderabad",
  "total_value": 500000
}
```

### Test 4: CLIENT_E (Multi-Vehicle)
```bash
# Expected: Handles multi-leg (status: GENERATED, then tracks for Part-B updates)
POST /api/client-ops/process-ewb {
  "client_id": "CLIENT_E",
  "invoice_no": "MULTI_E_001",
  "vehicle_no": "KJ01GH1111",  # First vehicle
  "from_place": "Delhi",
  "to_place": "Kolkata",        # Multi-leg
  "total_value": 750000
}
```

---

## 📋 API Endpoints Summary

| Endpoint | Method | Purpose | Returns |
|----------|--------|---------|---------|
| `/api/client-ops/init` | POST | Initialize system | success, clients_configured |
| `/api/client-ops/rules?client_id=X` | GET | Get client rules | rules object |
| `/api/client-ops/process-ewb` | POST | Process invoice | status, eway_bill_no |
| `/api/client-ops/queue?client_id=X` | GET | View pending ops | pending_operations |
| `/api/client-ops/configs` | GET | View all configs | configurations |
| `/api/client-ops/matrix` | GET | View decision matrix | operation matrix |
| `/api/client-ops/operation-types` | GET | View op types | operation_types |
| `/api/client-ops/scenarios` | GET | View scenarios | scenarios |
| `/api/client-ops/dashboard` | GET | System overview | system stats |

---

## 💾 Status Workflow (Universal)

```
NEW
  ↓
VALIDATED
  ↓
WAITING_APPROVAL (if needed)
  ↓
READY_FOR_GENERATION
  ↓
GENERATED
  ↓
PARTB_UPDATED
  ↓
IN_TRANSIT
  ├─ NEAR_EXPIRY
  │   └─ EXTENDED
  ↓
COMPLETED
```

**Same workflow for ALL clients** - only behavior changes based on rules

---

## ⚙️ Operation Types

| Type | Generates | Updates Part-B | Use Case |
|------|-----------|-----------------|----------|
| GEN_ONLY | ✓ | ✗ | Initial generation |
| GEN_PLUS_PARTB | ✓ | ✓ | Standard operation |
| PARTB_ONLY | ✗ | ✓ | Vehicle reassignment |
| TRACK_ONLY | ✗ | ✗ | 3PL monitoring |
| EXTENSION_ONLY | ✗ | ✗ | Expiry extension |
| MULTI_VEHICLE | ✓ | ✓ | Long-haul multi-stop |
| MANUAL_APPROVAL | ✀ | ✀ | High-value sensitive |

---

## 🔑 Key Configuration Options

```javascript
{
  // Behavior
  auto_generate: boolean,           // Auto-create EWB?
  auto_part_b_update: boolean,      // Auto-update Part-B?
  auto_extend: boolean,             // Auto-extend near expiry?
  
  // Approval & Validation
  approval_required: boolean,       // Need manual approval?
  gps_required: boolean,            // Mandatory GPS tracking?
  route_check_required: boolean,    // Validate route?
  
  // Operation Type
  monitoring_only: boolean,         // Only track (don't generate)?
  multi_vehicle_allowed: boolean,   // Support vehicle changes?
  
  // Mode & Source
  api_mode: 'AUTO'|'SEMI_AUTO'|'PASSIVE', // Automation level?
  invoice_source: 'api'|'portal'|'external',   // Where invoices from?
  
  // Limits
  retry_limit: number,              // Retry count on failure
  expiry_alert_hours: number,       // When to alert before expiry
  max_concurrent_vehicles: number,  // Max simultaneous shipments
}
```

---

## 🎓 Real-World Mapping

| Company Type | Use | Client Type |
|--------------|-----|-------------|
| Large factory, own transport | Bulk invoke, auto | CLIENT_A |
| Pharma, high-value | Manual approvals | CLIENT_B |
| E-commerce distribution | Customer portal | CLIENT_C |
| Transport contractor | Fleet tracking | CLIENT_D |
| Long-haul logistics | Multi-vehicle | CLIENT_E |

---

## ❌ Common Mistakes to Avoid

```javascript
// ❌ DON'T: Hardcode per-client logic
if (clientId === 'ABC') generateEWB();
if (clientId === 'XYZ') queueForApproval();

// ✅ DO: Use database rules
const rules = await getClientRules(clientId);
if (rules.auto_generate) generateEWB();

// ❌ DON'T: Different statuses per client
CLIENT_A's status: 'APPROVED'
CLIENT_B's status: 'OK'
CLIENT_C's status: 'YES'

// ✅ DO: Use universal statuses
All clients use: GENERATED, IN_TRANSIT, COMPLETED

// ❌ DON'T: Skip exception handling
try { updatePartB(); } catch(e) { }

// ✅ DO: Log and raise exceptions
try { updatePartB(); } 
catch(e) { await raiseException(...); }
```

---

## 📈 Migration Path (If Existing)

**Phase 1: Parallel Run (1-2 weeks)**
- New system processes 5% of volume
- Old system continues as primary
- Monitor for differences

**Phase 2: Ramp Up (1 week)**
- Increase to 25% of volume
- Fine-tune client rules
- Team familiarization

**Phase 3: Main (1 week)**
- Move to 75% of volume
- Old system backup only
- Real client testing

**Phase 4: Cutover (1 day)**
- 100% to new system
- Old system retired
- Monitoring intensified

---

## 📱 Monitoring Points

**Should Alert On:**

1. Queue depth > 100 operations
2. Same operation failed 3+ times
3. Operation stuck > 1 hour
4. Approval pending > 2 hours
5. GPS tracking failure for critical shipment
6. Masters API errors (> 2 failures/hour)
7. Database connection issues

**Should Dashboard Show:**

1. By Client:
   - Today's volume
   - Success %
   - Avg processing time
   - Pending approvals

2. By Status:
   - Count in each status
   - Time in status
   - Stuck operations

3. By Operation:
   - Gen operations: X
   - Part-B ops: Y
   - Extensions: Z
   - Success rate: %

---

## 🔗 Links

- **Full Guide**: [MULTI_CLIENT_OPERATION_GUIDE.md](./MULTI_CLIENT_OPERATION_GUIDE.md)
- **Integration Help**: [SERVER_INTEGRATION_EXAMPLE.js](./SERVER_INTEGRATION_EXAMPLE.js)
- **Core Engine**: [src/services/clientOperationEngine.js](./src/services/clientOperationEngine.js)
- **Client Configs**: [src/config/clientConfigurations.js](./src/config/clientConfigurations.js)
- **API Routes**: [src/api/clientOperationRoutes.js](./src/api/clientOperationRoutes.js)

---

## 📞 Next Steps

1. **Review** the complete guide: MULTI_CLIENT_OPERATION_GUIDE.md
2. **Integrate** routes into server.js (copy from SERVER_INTEGRATION_EXAMPLE.js)
3. **Initialize** system: `POST /api/client-ops/init`
4. **Test** with each client type (see Testing Scenarios)
5. **Monitor** queue and exceptions
6. **Expand** to more clients as needed

---

**This system replaces client-specific code with database-driven configuration.**

**No code changes needed to add new clients or modify behavior — just update database rules.**

---

*System designed: April 4, 2026*
*Archive: KD-LOGISTICS Multi-Client Operation Engine v1.0*
