-- KD-LOGISTICS: Quick SQL Fixes for Client Login Issues
-- ========================================================
-- Use these queries to troubleshoot and fix common authentication problems
-- 
-- ⚠️  IMPORTANT: Always backup database before running UPDATE/DELETE queries!
-- Backup command: cp fleet_erp_backend_sqlite.db fleet_erp_backend_sqlite.db.backup_$(date +%Y%m%d)

-- ============================================================================
-- 1. DIAGNOSTIC QUERIES (Just read data - safe to run)
-- ============================================================================

-- View all clients and their status
SELECT 
    id, client_code, pin, name, status, 
    datetime(created_at) as 'Created'
FROM clients
ORDER BY id;

-- Count vehicles per client
SELECT 
    c.client_code,
    c.name,
    COUNT(cv.id) as 'Total Vehicles',
    SUM(CASE WHEN cv.status = 'active' THEN 1 ELSE 0 END) as 'Active Vehicles'
FROM clients c
LEFT JOIN client_vehicles cv ON c.id = cv.client_id
GROUP BY c.id
ORDER BY c.client_code;

-- Check all tables exist
SELECT name FROM sqlite_master 
WHERE type='table' 
ORDER BY name;

-- ============================================================================
-- 2. QUICK FIXES FOR COMMON ISSUES
-- ============================================================================

-- FIX 1: Client can't login - PIN not found
-- Run this DIAGNOSTIC query first:
SELECT * FROM clients WHERE pin = '001';  -- Replace '001' with the PIN user tried

-- To CREATE THE MISSING CLIENT:
INSERT INTO clients (client_code, pin, name, status)
VALUES ('CLIENT_001', '001', 'Atul Logistics', 'active');
-- Then run: SELECT id FROM clients WHERE client_code = 'CLIENT_001';
-- Note the ID, then add vehicles using the ID

-- ============================================================================
-- FIX 2: Client has PIN but can't login - Client is INACTIVE
-- Status is 'inactive' instead of 'active'
UPDATE clients 
SET status = 'active' 
WHERE client_code = 'CLIENT_001';  -- Change to your client code

-- Verify:
SELECT client_code, status FROM clients WHERE client_code = 'CLIENT_001';

-- ============================================================================
-- FIX 3: No vehicles showing after PIN login
-- Check if vehicles exist and are active

-- View vehicles for a specific client
SELECT * FROM client_vehicles 
WHERE client_id = (SELECT id FROM clients WHERE client_code = 'CLIENT_001');

-- Activate all inactive vehicles for this client
UPDATE client_vehicles 
SET status = 'active' 
WHERE client_id = (SELECT id FROM clients WHERE client_code = 'CLIENT_001')
AND status = 'inactive';

-- Add missing vehicle for a client (if needed)
INSERT INTO client_vehicles (client_id, vehicle_number, model, status)
VALUES (
    (SELECT id FROM clients WHERE client_code = 'CLIENT_001'),
    'MH01AB1234',
    'Tata 1109',
    'active'
);

-- ============================================================================
-- FIX 4: Wrong PIN - Need to change client credentials
UPDATE clients 
SET pin = '9999' 
WHERE client_code = 'CLIENT_001';

-- Verify the change:
SELECT client_code, pin FROM clients WHERE client_code = 'CLIENT_001';

-- ============================================================================
-- FIX 5: Disable a client completely (e.g., after business ends)
UPDATE clients 
SET status = 'inactive' 
WHERE client_code = 'CLIENT_001';

-- Re-enable later
UPDATE clients 
SET status = 'active' 
WHERE client_code = 'CLIENT_001';

-- ============================================================================
-- FIX 6: Hide one vehicle but keep client active
UPDATE client_vehicles 
SET status = 'inactive' 
WHERE vehicle_number = 'MH01AB1234';  -- Change to vehicle number

-- Show it again
UPDATE client_vehicles 
SET status = 'active' 
WHERE vehicle_number = 'MH01AB1234';

-- ============================================================================
-- 3. FUEL BUSINESS RULES
-- ============================================================================

-- View fuel rules for a client
SELECT * FROM fuel_policy_rules 
WHERE client_id = 'CLIENT_001'
ORDER BY vehicle_category, trip_type;

-- Increase fuel advance limit for 32ft vehicles
UPDATE fuel_policy_rules 
SET max_advance_amount = 6000 
WHERE client_id = 'CLIENT_001' 
AND vehicle_category = '32ft';

-- Add new fuel rule
INSERT INTO fuel_policy_rules (
    client_id, 
    vehicle_category, 
    trip_type, 
    fuel_mode, 
    fuel_payment_responsibility, 
    max_advance_amount, 
    buffer_liters
)
VALUES (
    'CLIENT_001',
    'small',
    'partial',
    'driver_paid',
    'driver',
    2000,
    5
);

-- ============================================================================
-- 4. ADMIN & MUNSHI MANAGEMENT
-- ============================================================================

-- View all admins
SELECT id, username, name, admin_type, status, client_id FROM admins;

-- Create new system admin
INSERT INTO admins (username, pin, name, admin_type, status, client_id)
VALUES ('admin_new', '5555', 'New Admin Name', 'system_admin', 'active', NULL);

-- Reset admin PIN (forgotten password)
UPDATE admins 
SET pin = '1234' 
WHERE username = 'YOUR_ADMIN_USERNAME';

-- Deactivate an admin
UPDATE admins 
SET status = 'inactive' 
WHERE username = 'old_admin';

-- ============================================================================
-- 5. MUNSHI MANAGEMENT
-- ============================================================================

-- View all munshis
SELECT 
    m.id, 
    m.name, 
    m.email, 
    m.phone, 
    m.status,
    c.client_code
FROM munshis m
LEFT JOIN clients c ON m.client_id = c.id;

-- Create new munshi for a client
INSERT INTO munshis (
    client_id,
    name,
    email,
    phone,
    pin,
    permissions,
    status
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

-- Reset munshi PIN
UPDATE munshis 
SET pin = '2222' 
WHERE email = 'suresh@atullogistics.com';

-- Deactivate munshi (prevent login)
UPDATE munshis 
SET status = 'inactive' 
WHERE email = 'suresh@atullogistics.com';

-- ============================================================================
-- 6. DATA INTEGRITY CHECKS
-- ============================================================================

-- Check database integrity
PRAGMA integrity_check;
-- Returns "ok" if healthy, or lists errors

-- Find orphaned vehicles (client_id doesn't exist)
SELECT cv.id, cv.vehicle_number, cv.client_id 
FROM client_vehicles cv
WHERE cv.client_id NOT IN (SELECT id FROM clients);

-- Find orphaned munshis
SELECT m.id, m.name, m.client_id 
FROM munshis m
WHERE m.client_id NOT IN (SELECT id FROM clients);

-- ============================================================================
-- 7. BULK OPERATIONS (Use with caution!)
-- ============================================================================

-- Deactivate ALL vehicles for a client (emergency)
UPDATE client_vehicles 
SET status = 'inactive' 
WHERE client_id = (SELECT id FROM clients WHERE client_code = 'CLIENT_001');

-- Activate all vehicles for a client
UPDATE client_vehicles 
SET status = 'active' 
WHERE client_id = (SELECT id FROM clients WHERE client_code = 'CLIENT_001');

-- Approve all pending fuel requests (dangerous!)
UPDATE fuel_requests 
SET approval_status = 'approved',
    approved_by = 'ADMIN',
    approved_at = CURRENT_TIMESTAMP
WHERE approval_status = 'pending';

-- ============================================================================
-- 8. BACKUP & EXPORT
-- ============================================================================

-- Export all clients as CSV (run from terminal)
-- sqlite3 fleet_erp_backend_sqlite.db ".mode csv" ".output clients.csv" "SELECT * FROM clients;"

-- Show last 10 login attempts (if logged)
-- SELECT * FROM login_logs ORDER BY timestamp DESC LIMIT 10;

-- ============================================================================
-- USEFUL REFERENCES
-- ============================================================================

-- Client Status Values: 'active', 'inactive'
-- Vehicle Status Values: 'active', 'inactive'
-- Admin Types: 'system_admin', 'client_admin'

-- Munshi Permissions (comma-separated):
-- - create_driver
-- - edit_driver
-- - assign_vehicle
-- - reassign_vehicle
-- - approve_fuel
-- - reject_fuel
-- - view_drivers
-- - view_fuel_data
-- - view_reports

-- ============================================================================
-- ⚠️  CRITICAL: Always run this after making changes to verify
-- ============================================================================

-- Final verification query - run after any fix
SELECT 
    'Clients' as 'Entity',
    COUNT(*) as 'Count',
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as 'Active'
FROM clients
UNION ALL
SELECT 'Vehicles', COUNT(*), SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)
FROM client_vehicles
UNION ALL
SELECT 'Admins', COUNT(*), SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)
FROM admins
UNION ALL
SELECT 'Munshis', COUNT(*), SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)
FROM munshis;
