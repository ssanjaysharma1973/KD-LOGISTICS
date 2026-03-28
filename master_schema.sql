-- MASTER SCHEMA FOR ATUL LOGISTICS
-- This file contains all main table definitions and schema changes for the project.

-- Table: csv_uploads
CREATE TABLE IF NOT EXISTS csv_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    filename TEXT,
    total_rows INTEGER DEFAULT 0,
    unique_points INTEGER DEFAULT 0,
    status TEXT DEFAULT 'processing',
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: discovered_points
CREATE TABLE IF NOT EXISTS discovered_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id INTEGER,
    client_id TEXT NOT NULL,
    point_name TEXT NOT NULL,
    city TEXT,
    state TEXT,
    pin_code TEXT,
    address TEXT,
    latitude REAL,
    longitude REAL,
    geocoded INTEGER DEFAULT 0,
    from_count INTEGER DEFAULT 0,
    to_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    from_pct REAL DEFAULT 0,
    to_pct REAL DEFAULT 0,
    category TEXT DEFAULT 'OTHER',
    is_active INTEGER DEFAULT 1,
    promoted_to_poi INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(upload_id) REFERENCES csv_uploads(id)
);
CREATE INDEX IF NOT EXISTS idx_dp_client ON discovered_points(client_id);
CREATE INDEX IF NOT EXISTS idx_dp_category ON discovered_points(category);
CREATE INDEX IF NOT EXISTS idx_dp_name ON discovered_points(point_name);

-- Table: drivers
CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    license_number TEXT,
    license_expiry DATE,
    status TEXT DEFAULT 'active',
    address TEXT,
    assigned_vehicle TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    client_id TEXT DEFAULT 'CLIENT_001'
);

-- Table: munshis
CREATE TABLE IF NOT EXISTS munshis (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    area TEXT,
    region TEXT,
    status TEXT DEFAULT 'active',
    approval_limit REAL DEFAULT 10000.0,
    assigned_vehicles TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    client_id TEXT DEFAULT 'CLIENT_001'
);

-- Table: fuel_rates
CREATE TABLE IF NOT EXISTS fuel_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id TEXT NOT NULL,
    kmpl REAL,
    cost_per_liter REAL,
    effective_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    client_id TEXT DEFAULT 'CLIENT_001'
);

-- Table: pois (partial, add more columns as needed)

CREATE TABLE IF NOT EXISTS pois (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT,
    poi_name TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    state TEXT,
    city TEXT,
    address TEXT,
    pin_code TEXT,
    radius_meters INTEGER DEFAULT 500,
    type TEXT DEFAULT 'primary' -- 'primary', 'secondary', 'tertiary', or 'other'
);

-- Table: vehicles (partial, add more columns as needed)
CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_reg_no TEXT PRIMARY KEY,
    driver_name TEXT,
    type TEXT,
    client_id TEXT
    -- Add more columns as per your current schema
);

-- Table: poi_unloading_rates_v2 (Vehicle category-based unloading charges)
CREATE TABLE IF NOT EXISTS poi_unloading_rates_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT,
    poi_id INTEGER NOT NULL,
    category_1_32ft_34ft REAL DEFAULT 0,
    category_2_22ft_24ft REAL DEFAULT 0,
    category_3_small REAL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(client_id, poi_id)
);

-- Example ALTER TABLE (for pois)
-- ALTER TABLE pois ADD COLUMN state TEXT;

-- Add more CREATE TABLE/ALTER TABLE statements as your schema evolves.
