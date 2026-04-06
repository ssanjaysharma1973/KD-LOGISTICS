# KD-LOGISTICS: Client Login & Business Rules Management Guide

## 🔍 FOR DEVELOPERS & APP OWNERS (Troubleshooting & Management)

---

## 1. CLIENT LOGIN ISSUES - HOW TO FIX

### Issue: "Invalid PIN" Error

**Root Causes:**
- Client PIN not in database or incorrect
- Client status is `inactive` instead of `active`
- PIN has extra spaces or formatting issues

**How to Debug:**

#### Option A: Check Database Directly
```bash
# SSH/Terminal access to backend
cd backend
sqlite3 fleet_erp_backend_sqlite.db

# Query clients table
SELECT id, client_code, pin, name, status FROM clients;

# Check specific client
SELECT * FROM clients WHERE client_code = 'CLIENT_001';
```

#### Option B: View Backend Logs
```bash
# Check server logs for authentication errors
cd backend
tail -f logs/app.log | grep -i "client\|pin\|auth"
```

#### Option C: Test API Endpoint Directly
```bash
# Test client authentication
curl -X POST http://localhost:3000/api/clients/get-by-pin \
  -H "Content-Type: application/json" \
  -d '{"pin": "001"}'

# Expected response:
# {"success": true, "client_id": "CLIENT_001", "client_name": "Atul Logistics", "vehicles": [...]}

# Error response:
# {"error": "Invalid PIN"}  → PIN doesn't exist
# {"error": "Client not active"} → Status issue
```

---

### Issue: "No Vehicles Assigned" Error

**Root Cause:** Client has no active vehicles linked

**How to Fix:**

```sql
-- Check vehicles for a client
SELECT * FROM client_vehicles 
WHERE client_id = (SELECT id FROM clients WHERE client_code = 'CLIENT_001')
AND status = 'active';

-- Add missing vehicle
INSERT INTO client_vehicles (client_id, vehicle_number, model, status)
VALUES (
  (SELECT id FROM clients WHERE client_code = 'CLIENT_001'),
  'MH01AB1234',
  'Tata 1109',
  'active'
);
```

---

### Issue: Login Hangs or 500 Error

**How to Debug:**

1. **Check Backend Running:**
   ```bash
   netstat -ano | findstr :3000  # Windows
   lsof -i :3000                 # Mac/Linux
   ```

2. **View Real-time Errors:**
   ```bash
   cd backend
   tail -50 logs/app.log
   ```

3. **Test Health Check:**
   ```bash
   curl http://localhost:3000/api/health
   # Should return: {"status": "ok"}
   ```

---

## 2. MANAGING CLIENT CREDENTIALS & BUSINESS RULES

### View All Clients
```bash
cd backend

# Option 1: SQLite CLI
sqlite3 fleet_erp_backend_sqlite.db \
  "SELECT id, client_code, pin, name, status FROM clients LIMIT 20;"

# Option 2: Python script
python3 -c "
import sqlite3
conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
conn.row_factory = sqlite3.Row
cursor = conn.cursor()
cursor.execute('SELECT * FROM clients')
for row in cursor.fetchall():
    print(dict(row))
"
```

---

### Create New Client (Via Database)

```sql
-- 1. Insert client
INSERT INTO clients (client_code, pin, name, status)
VALUES ('CLIENT_004', '004', 'New Company Name', 'active');

-- Get the ID
SELECT id FROM clients WHERE client_code = 'CLIENT_004';

-- 2. Add vehicles for this client (assuming client_id = 4)
INSERT INTO client_vehicles (client_id, vehicle_number, model, status)
VALUES 
  (4, 'MH04AB5000', 'Tata 1109', 'active'),
  (4, 'MH04CD5001', 'Ashok Leyland', 'active');

-- 3. Verify
SELECT * FROM clients WHERE client_code = 'CLIENT_004';
SELECT * FROM client_vehicles WHERE client_id = 4;
```

---

### Update Client PIN (Reset Credentials)

```sql
-- Change client PIN
UPDATE clients 
SET pin = '9999' 
WHERE client_code = 'CLIENT_001';

-- Verify
SELECT client_code, pin FROM clients WHERE client_code = 'CLIENT_001';
```

---

### Deactivate Client (Disable Login)

```sql
-- Disable a client
UPDATE clients 
SET status = 'inactive' 
WHERE client_code = 'CLIENT_001';

-- This prevents:
-- ❌ PIN login (client not found)
-- ❌ Vehicle selection
-- ❌ Portal access

-- Re-enable:
UPDATE clients 
SET status = 'active' 
WHERE client_code = 'CLIENT_001';
```

---

### Disable Specific Vehicle for Client

```sql
-- Prevent a vehicle from being selected
UPDATE client_vehicles 
SET status = 'inactive' 
WHERE vehicle_number = 'MH01AB1234';

-- Re-enable
UPDATE client_vehicles 
SET status = 'active' 
WHERE vehicle_number = 'MH01AB1234';
```

---

## 3. BUSINESS RULES MANAGEMENT

### View Fuel Policy Rules (By Client)

```sql
-- Get fuel rules for a client
SELECT * FROM fuel_policy_rules 
WHERE client_id = 'CLIENT_001';

-- Sample output:
-- id | client_id    | vehicle_cat | trip_type | fuel_mode      | max_advance
-- 1  | CLIENT_001   | 32ft        | frl       | company_paid   | 5000
-- 2  | CLIENT_001   | 22ft        | partial   | driver_paid    | 3000
```

---

### Update Fuel Budget Limits

```sql
-- Increase fuel advance for a vehicle type
UPDATE fuel_policy_rules 
SET max_advance_amount = 6000 
WHERE client_id = 'CLIENT_001' 
  AND vehicle_category = '32ft'
  AND trip_type = 'frl';

-- Add new fuel rule
INSERT INTO fuel_policy_rules (
  client_id, vehicle_category, trip_type, 
  fuel_mode, fuel_payment_responsibility, 
  max_advance_amount, buffer_liters
)
VALUES (
  'CLIENT_001', 'small', 'partial', 
  'driver_paid', 'driver', 2000, 5
);
```

---

## 4. ADMIN & MUNSHI PERMISSIONS

### View Admin Users
```sql
SELECT id, username, name, admin_type, status, client_id 
FROM admins;

-- admin_type: 'system_admin' or 'client_admin'
-- status: 'active' or 'inactive'
```

### Create Admin User

```sql
INSERT INTO admins (username, pin, name, admin_type, status, client_id)
VALUES ('admin123', '5555', 'Admin Name', 'system_admin', 'active', NULL);
```

### Create Munshi (for a client)

```sql
INSERT INTO munshis (
  client_id, name, email, phone, pin, 
  permissions, status
)
VALUES (
  (SELECT id FROM clients WHERE client_code = 'CLIENT_001'),
  'Suresh Kumar',
  'suresh@atullogistics.com',
  '9876543210',
  '1111',
  'approve_fuel,assign_vehicle,view_drivers',
  'active'
);
```

---

## 5. FRONTEND LOGIN FLOW (For Admins to Explain to Users)

### **🚗 Driver Login:**
1. **Enter Client Code** → System fetches vehicles
2. **Select Vehicle** → Pick from assigned fleet
3. **Confirm** → Login as driver for that vehicle

### **👨‍💼 Munshi Login:**
1. **Enter Email or Phone**
2. **Enter PIN**
3. **Roles:** Approve fuel requests, assign vehicles, view drivers

### **🏢 Client Login (NEW):**
1. **Enter Company ID**
2. **Enter Password**
3. **Access:** View reports, manage operations

### **👨‍💻 Admin Login:**
1. **Enter Username**
2. **Enter PIN**
3. **System vs Client Admin** depending on role

---

## 6. COMMON FIXES CHECKLIST

| Issue | Fix | Command |
|-------|-----|---------|
| Client can't login | Check PIN exists, status='active' | `SELECT * FROM clients WHERE client_code='CLIENT_001';` |
| No vehicles show | Ensure vehicles linked & active | `SELECT * FROM client_vehicles WHERE client_id=1 AND status='active';` |
| Wrong fuel budget | Update max_advance_amount | `UPDATE fuel_policy_rules SET max_advance_amount=5000 WHERE...` |
| Munshi can't approve fuel | Check munshi status='active' & permissions | `SELECT * FROM munshis WHERE email='munshi@email.com';` |
| Admin locked out | Reset admin pin or status | `UPDATE admins SET status='active', pin='1234' WHERE username='admin';` |
| Backend not responding | Check port 3000 | `netstat -ano \| findstr :3000` |
| Vite proxy not working | Verify backend returns CORS headers | Check vite.config.js proxy settings |

---

## 7. MONITORING & LOGS

### View Recent Login Attempts
```bash
cd backend
grep -i "login\|auth\|pin" logs/app.log | tail -20
```

### Check Database Integrity
```bash
sqlite3 fleet_erp_backend_sqlite.db
PRAGMA integrity_check;  # Returns 'ok' if database is healthy
```

### Backup Database Before Changes
```bash
cd backend
cp fleet_erp_backend_sqlite.db flight_erp_backend_sqlite.db.backup_$(date +%Y%m%d_%H%M%S)
```

---

## 8. API ENDPOINTS REFERENCE

| Feature | Endpoint | Method | Body |
|---------|----------|--------|------|
| Client PIN Login | `/api/clients/get-by-pin` | POST | `{"pin": "001"}` |
| Driver Login | `/api/drivers/login` | POST | `{"vehicle_number": "MH01AB1234", "pin": "999"}` |
| Munshi Login | `/api/munshis/login` | POST | `{"email": "munshi@email.com", "pin": "1111"}` |
| Admin Login | `/api/admin-pin/login` | POST | `{"username": "admin", "pin": "5555"}` |
| Get Clients | `/api/clients` | GET | - |
| Get Fuel Rules | `/api/fuel/rules` | GET | - |

---

## 9. PRODUCTION BEST PRACTICES

✅ **DO:**
- Use environment variables for sensitive data (JWT_SECRET, credentials)
- Regularly backup database
- Monitor login failures in logs
- Use strong PINs (not `001`, `002`)
- Disable accounts when employees leave
- Keep client_vehicles updated with active fleet

❌ **DON'T:**
- Store plain passwords in code
- Use predictable credentials
- Share admin PINs insecurely
- Delete clients without backup
- Ignore database errors
- Leave debug mode enabled in production

---

**Need Help?** Check server logs, test API endpoints directly, verify database records.
