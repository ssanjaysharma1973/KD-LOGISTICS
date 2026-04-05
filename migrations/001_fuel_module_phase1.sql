-- FUEL MODULE - PHASE 1 SCHEMA
-- Migration: 001_fuel_module_phase1
-- Date: 2026-04-05
-- Description: Adds fuel control, advances, transactions, and policy rules

-- ============================================================================
-- 1. FUEL POLICY RULES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS fuel_policy_rules (
    policy_id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    vehicle_type TEXT,  -- 'truck_32ft', 'truck_20ft', 'truck_10ft', 'spl_transport', 'any'
    vehicle_owner_type TEXT,  -- 'company', 'market', 'owner', 'any'
    trip_type TEXT,  -- 'frl', 'ltl', 'demu', 'local', 'any'
    fuel_mode TEXT NOT NULL,  -- 'driver_advance', 'designated_pump_credit', 'owner_self_paid', 'hybrid'
    fuel_payment_responsibility TEXT,  -- 'company', 'owner', 'client', 'mixed'
    max_advance_amount REAL,  -- in INR
    max_advance_percent REAL,  -- % of trip value or fuel budget
    expected_kmpl REAL NOT NULL,  -- default KM per liter
    buffer_percent REAL DEFAULT 10,  -- extra 10% buffer for calculation
    approval_required INTEGER DEFAULT 0,  -- 0=auto, 1=manual
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, vehicle_type, vehicle_owner_type, trip_type),
    FOREIGN KEY(client_id) REFERENCES clients(client_id)
);
CREATE INDEX idx_fuel_policy_client ON fuel_policy_rules(client_id);
CREATE INDEX idx_fuel_policy_active ON fuel_policy_rules(active);

-- ============================================================================
-- 2. VEHICLE MILEAGE RULES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS vehicle_mileage_rules (
    mileage_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_type TEXT NOT NULL,  -- '32ft', '20ft', '10ft', 'spl'
    load_condition TEXT NOT NULL,  -- 'loaded', 'empty', 'partial'
    route_type TEXT,  -- 'highway', 'city', 'mixed', 'any'
    terrain_type TEXT,  -- 'hilly', 'plain', 'mixed', 'any'
    expected_kmpl REAL NOT NULL,
    min_kmpl REAL,  -- alert if below this
    max_kmpl REAL,  -- alert if above this (suspicious)
    remarks TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vehicle_type, load_condition, route_type, terrain_type)
);
CREATE INDEX idx_mileage_vehicle_type ON vehicle_mileage_rules(vehicle_type);

-- ============================================================================
-- 3. TRIP FUEL ADVANCES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS trip_fuel_advances (
    advance_id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL UNIQUE,
    driver_id TEXT NOT NULL,
    amount_requested REAL NOT NULL,
    amount_approved REAL,
    issued_amount REAL,
    issue_mode TEXT,  -- 'cash', 'upi', 'company_card'
    issued_by TEXT,  -- user_id who approved
    issued_at DATETIME,
    approval_status TEXT DEFAULT 'requested',  -- 'requested', 'approved', 'rejected', 'issued', 'settled'
    remarks TEXT,
    bill_uploaded INTEGER DEFAULT 0,
    bill_amount REAL,  -- actual fuel cost from receipt
    bill_image_url TEXT,
    fuel_variance REAL,  -- amount_approved - bill_amount
    settlement_status TEXT DEFAULT 'pending',  -- 'pending', 'settled', 'overpaid', 'underpaid'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(trip_id) REFERENCES munshi_trips(id),
    FOREIGN KEY(driver_id) REFERENCES drivers(id)
);
CREATE INDEX idx_fuel_advance_trip ON trip_fuel_advances(trip_id);
CREATE INDEX idx_fuel_advance_driver ON trip_fuel_advances(driver_id);
CREATE INDEX idx_fuel_advance_status ON trip_fuel_advances(approval_status);

-- ============================================================================
-- 4. FUEL TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS fuel_transactions (
    fuel_txn_id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER,
    vehicle_id TEXT,
    driver_id TEXT,
    fuel_mode TEXT,  -- 'driver_advance', 'designated_pump', 'owner_paid', 'system'
    litres REAL NOT NULL,
    rate_per_liter REAL,  -- price at time of fuel
    amount REAL NOT NULL,
    odometer_reading INTEGER,
    location TEXT,  -- where fuel was taken
    transaction_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    bill_number TEXT UNIQUE,
    bill_image_url TEXT,
    payment_status TEXT DEFAULT 'pending',  -- 'pending', 'settled', 'credited'
    source TEXT,  -- 'driver', 'vendor', 'system'
    approved_by TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(trip_id) REFERENCES munshi_trips(id),
    FOREIGN KEY(vehicle_id) REFERENCES vehicles(id),
    FOREIGN KEY(driver_id) REFERENCES drivers(id)
);
CREATE INDEX idx_fuel_txn_trip ON fuel_transactions(trip_id);
CREATE INDEX idx_fuel_txn_vehicle ON fuel_transactions(vehicle_id);
CREATE INDEX idx_fuel_txn_bill ON fuel_transactions(bill_number);
CREATE INDEX idx_fuel_txn_time ON fuel_transactions(transaction_time);

-- ============================================================================
-- 5. FUEL AUTHORIZATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS fuel_authorizations (
    auth_id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    authorized_litres REAL,
    authorized_amount REAL,
    authorization_code TEXT UNIQUE,  -- OTP or token
    validity_start DATETIME DEFAULT CURRENT_TIMESTAMP,
    validity_end DATETIME,  -- valid for 7 days or trip duration
    used_status TEXT DEFAULT 'active',  -- 'active', 'used', 'expired', 'revoked'
    used_at DATETIME,
    actual_litres REAL,  -- recorded when fuel taken
    created_by TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(trip_id) REFERENCES munshi_trips(id)
);
CREATE INDEX idx_fuel_auth_trip ON fuel_authorizations(trip_id);
CREATE INDEX idx_fuel_auth_code ON fuel_authorizations(authorization_code);

-- ============================================================================
-- 6. TRIP FINANCIALS TABLE (for fuel tracking in trip costs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS trip_financials (
    financial_id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL UNIQUE,
    expected_fuel_budget REAL,  -- calculated at trip start
    actual_fuel_used REAL,
    fuel_variance REAL,  -- expected - actual
    expected_km REAL,
    actual_km REAL,
    loaded_km REAL,
    empty_km REAL,
    expected_kmpl REAL,
    actual_kmpl REAL,
    company_fuel_payable REAL,  -- for company-owned vehicles
    owner_fuel_payable REAL,  -- for owner vehicles
    client_fuel_reimbursable REAL,
    driver_advance_issued REAL,
    driver_balance_recoverable REAL,
    approval_status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'posted'
    posted_at DATETIME,
    posted_by TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(trip_id) REFERENCES munshi_trips(id)
);
CREATE INDEX idx_trip_financial_trip ON trip_financials(trip_id);

-- ============================================================================
-- 7. EXTEND MUNSHI_TRIPS TABLE WITH FUEL FIELDS
-- ============================================================================
-- Run these ALTER commands (SQLite doesn't support DROP COLUMN easily)
ALTER TABLE munshi_trips ADD COLUMN IF NOT EXISTS fuel_mode TEXT DEFAULT 'driver_advance';
ALTER TABLE munshi_trips ADD COLUMN IF NOT EXISTS fuel_payment_responsibility TEXT DEFAULT 'company';
ALTER TABLE munshi_trips ADD COLUMN IF NOT EXISTS expected_km REAL;
ALTER TABLE munshi_trips ADD COLUMN IF NOT EXISTS expected_kmpl REAL;
ALTER TABLE munshi_trips ADD COLUMN IF NOT EXISTS expected_fuel_ltr REAL;
ALTER TABLE munshi_trips ADD COLUMN IF NOT EXISTS fuel_limit_amount REAL;
ALTER TABLE munshi_trips ADD COLUMN IF NOT EXISTS fuel_limit_ltr REAL;
ALTER TABLE munshi_trips ADD COLUMN IF NOT EXISTS total_fuel_issued REAL DEFAULT 0;
ALTER TABLE munshi_trips ADD COLUMN IF NOT EXISTS total_fuel_used REAL DEFAULT 0;
ALTER TABLE munshi_trips ADD COLUMN IF NOT EXISTS fuel_variance REAL;
ALTER TABLE munshi_trips ADD COLUMN IF NOT EXISTS fuel_approval_status TEXT DEFAULT 'pending';
ALTER TABLE munshi_trips ADD COLUMN IF NOT EXISTS loaded_km REAL;
ALTER TABLE munshi_trips ADD COLUMN IF NOT EXISTS empty_km REAL;

-- ============================================================================
-- 8. DEFAULT FUEL POLICIES (Seed Data)
-- ============================================================================
-- Company vehicles - FRL (Full Truck Load) trips - highway
INSERT OR IGNORE INTO fuel_policy_rules 
(client_id, vehicle_type, vehicle_owner_type, trip_type, fuel_mode, fuel_payment_responsibility, max_advance_amount, max_advance_percent, expected_kmpl, buffer_percent, approval_required)
VALUES 
('default', '32ft', 'company', 'frl', 'driver_advance', 'company', 5000, 5, 4.5, 10, 0),
('default', '20ft', 'company', 'frl', 'driver_advance', 'company', 3500, 5, 5.0, 10, 0),
('default', '10ft', 'company', 'ltl', 'driver_advance', 'company', 2000, 5, 6.0, 10, 0);

-- ============================================================================
-- 9. DEFAULT VEHICLE MILEAGE RULES (Seed Data)
-- ============================================================================
INSERT OR IGNORE INTO vehicle_mileage_rules 
(vehicle_type, load_condition, route_type, terrain_type, expected_kmpl, min_kmpl, max_kmpl)
VALUES 
('32ft', 'loaded', 'highway', 'plain', 4.5, 3.8, 5.5),
('32ft', 'loaded', 'city', 'mixed', 3.5, 2.5, 4.5),
('32ft', 'empty', 'highway', 'plain', 5.8, 5.0, 7.0),
('20ft', 'loaded', 'highway', 'plain', 5.0, 4.2, 6.0),
('20ft', 'empty', 'highway', 'plain', 6.5, 5.5, 7.5),
('10ft', 'loaded', 'city', 'mixed', 6.0, 5.0, 7.0),
('10ft', 'empty', 'city', 'mixed', 7.5, 6.5, 8.5);
