# 🛢️ Fuel Control Module - Phase 1 API Documentation

## Overview
Complete fuel advance, transaction, and approval workflow for KD-Logistics.

**Base URL:** `http://localhost:3000/api/fuel`

---

## 🔧 Fuel Planning Endpoints

### POST `/plan/<trip_id>`
Auto-plan fuel for a trip based on policy rules.

**Request:**
```bash
POST /api/fuel/plan/123
```

**Response:**
```json
{
  "trip_id": 123,
  "fuel_plan": {
    "fuel_mode": "driver_advance",
    "expected_fuel_ltr": 45.5,
    "fuel_with_buffer_ltr": 50.05,
    "fuel_limit_ltr": 50.05,
    "fuel_limit_amount": 5005.0,
    "fuel_payment_responsibility": "company",
    "max_advance": 5000.0
  },
  "status": "planned"
}
```

---

## 💰 Fuel Advance Endpoints

### POST `/advance/request`
Driver requests fuel advance.

**Payload:**
```json
{
  "trip_id": 123,
  "driver_id": "DRV001",
  "amount_requested": 4500,
  "remarks": "Long highway trip, need quick advance"
}
```

**Response:**
```json
{
  "advance_id": 47,
  "trip_id": 123,
  "amount_requested": 4500,
  "approval_status": "requested",
  "status": "created"
}
```

---

### POST `/advance/<advance_id>/approve`
Munshi/Finance approves expense.

**Payload:**
```json
{
  "approved_amount": 4500,
  "approved_by": "munshi_001"
}
```

**Response:**
```json
{
  "advance_id": 47,
  "approval_status": "approved",
  "amount_approved": 4500,
  "status": "approved"
}
```

---

### POST `/advance/<advance_id>/issue`
Finance issues cash/UPI to driver.

**Payload:**
```json
{
  "issued_amount": 4500,
  "issue_mode": "cash",
  "issued_by": "finance_001"
}
```

**Response:**
```json
{
  "advance_id": 47,
  "issued_amount": 4500,
  "issue_mode": "cash",
  "issued_at": "2026-04-05T10:30:00",
  "status": "issued"
}
```

---

### GET `/advance/<advance_id>`
Get fuel advance details.

**Response:**
```json
{
  "advance_id": 47,
  "trip_id": 123,
  "driver_id": "DRV001",
  "amount_requested": 4500,
  "amount_approved": 4500,
  "issued_amount": 4500,
  "approval_status": "issued",
  "settlement_status": "pending"
}
```

---

## 📝 Fuel Transaction Endpoints

### POST `/transaction/create`
Record fuel transaction (driver uploads bill).

**Payload:**
```json
{
  "trip_id": 123,
  "litres": 45.5,
  "amount": 4500,
  "bill_number": "P2604050001",
  "location": "Shell Pump, Pune",
  "remarks": "Filled at Pune highway pump"
}
```

**Response:**
```json
{
  "fuel_txn_id": 89,
  "trip_id": 123,
  "litres": 45.5,
  "amount": 4500,
  "status": "recorded"
}
```

---

### GET `/transaction/<txn_id>`
Get transaction details.

**Response:**
```json
{
  "fuel_txn_id": 89,
  "trip_id": 123,
  "vehicle_id": "VEH001",
  "driver_id": "DRV001",
  "fuel_mode": "driver_advance",
  "litres": 45.5,
  "amount": 4500,
  "bill_number": "P2604050001",
  "transaction_time": "2026-04-05T10:35:00",
  "payment_status": "pending"
}
```

---

## 📊 Fuel Variance & Alerts

### GET `/variance/<trip_id>`
Calculate fuel variance (expected vs actual).

**Response:**
```json
{
  "trip_id": 123,
  "expected_fuel": 45.5,
  "actual_fuel": 48.2,
  "variance_ltr": 2.7,
  "variance_percent": 5.9,
  "status": "normal"
}
```

**Alerts:**
- `status: "high"` if variance > 15%

---

## 📈 Fuel Dashboard Endpoints

### GET `/dashboard/pending-approvals`
Get all pending fuel advance approvals.

**Query Params:**
- `client_id` (optional): Filter by client

**Response:**
```json
{
  "count": 3,
  "approvals": [
    {
      "advance_id": 47,
      "trip_no": "T123",
      "driver_name": "Pardeep Sharma",
      "amount_requested": 4500,
      "approval_status": "requested",
      "created_at": "2026-04-05T09:00:00"
    }
  ],
  "status": "success"
}
```

---

### GET `/dashboard/summary/<client_id>`
Get fuel dashboard summary.

**Response:**
```json
{
  "summary": {
    "pending_approvals": 3,
    "fuel_issued_today": 15000.50,
    "high_variance_trips": 2,
    "outstanding_driver_advances": 8500.00
  },
  "status": "success"
}
```

---

## 🔍 Workflow Example

### Complete Trip Fuel Lifecycle

```
1. Trip Created
   → POST /api/fuel/plan/123

2. Driver Requests Advance
   → POST /api/fuel/advance/request
   Response: advance_id = 47

3. Munshi Approves
   → POST /api/fuel/advance/47/approve

4. Finance Issues Cash
   → POST /api/fuel/advance/47/issue

5. Driver Records Fuel
   → POST /api/fuel/transaction/create

6. Check Variance
   → GET /api/fuel/variance/123

7. Dashboard View
   → GET /api/fuel/dashboard/summary/CLIENT_001
```

---

## 📋 Fuel Policy Rules

**Saved in:** `fuel_policy_rules` table

**Fields:**
- `fuel_mode`: 'driver_advance' | 'designated_pump_credit' | 'owner_self_paid' | 'hybrid'
- `fuel_payment_responsibility`: 'company' | 'owner' | 'client' | 'mixed'
- `max_advance_amount`: Maximum INR advance allowed
- `expected_kmpl`: Kms per liter for vehicle type
- `buffer_percent`: Extra buffer (default 10%)
- `approval_required`: 0=auto approve, 1=manual

---

## 🚨 Status Codes

| Code | Meaning |
|------|-----------|
| 200 | Success |
| 400 | Bad Request |
| 404 | Not Found |
| 500 | Server Error |

---

## 📱 Frontend Integration (Next Phase)

Will build React components for:
- Fuel Request Form
- Approval Dashboard
- Fuel Bill Upload
- Driver Settle Sheet
- Finance Ledger

---

## ⚙️ Database Tables

1. **fuel_policy_rules** - Policy engine
2. **vehicle_mileage_rules** - KMPL by vehicle/condition
3. **trip_fuel_advances** - Driver advance tracking
4. **fuel_transactions** - Bill/receipt tracking
5. **fuel_authorizations** - OTP/token system (Phase 2)
6. **trip_financials** - Trip-level fuel accounting

---

## 🔐 Security Notes

- All approvals logged with user IDs
- Bill numbers validated for duplicates
- Mileage variance alerts for anomalies
- Driver advance limits enforced by policy

---

## 📞 Support

For issues or questions about fuel module:
- Check trip's `fuel_approval_status` field
- Review `trip_financials` for complete accounting
- Use `/api/fuel/health` to test connectivity

