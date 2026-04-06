#!/usr/bin/env python3
"""
Seed test driver data for PIN-based login testing
"""
import sqlite3
import sys

DB_PATH = './fleet_erp_backend_sqlite.db'

def create_test_drivers():
    """Create test drivers for PIN login"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Create drivers table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS drivers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT,
                license_number TEXT UNIQUE,
                vehicle_number TEXT,
                pin TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Create indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_drivers_license 
            ON drivers(license_number)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_drivers_vehicle 
            ON drivers(vehicle_number)
        """)
        
        # Seed test drivers
        test_drivers = [
            (999, 'Test Driver 999', '9876543210', 'DL999TEST', None, '99', 'Test driver for PIN login'),
            (None, 'Atul Singh', '9123456789', 'DLAT001', 'MH01AB1234', '42', 'Senior driver'),
            (None, 'Rajesh Kumar', '8765432109', 'DLRJ002', 'MH02XY5678', '88', 'Junior driver'),
            (None, 'Priya Sharma', '7654321098', 'DLPR003', 'MH03CD9999', '77', 'Female driver'),
        ]
        
        for driver_id, name, phone, license, vehicle, pin, notes in test_drivers:
            try:
                if driver_id:
                    # Insert with specific ID for test driver 999
                    cursor.execute("""
                        INSERT OR IGNORE INTO drivers 
                        (id, name, phone, license_number, vehicle_number, pin, notes, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
                    """, (driver_id, name, phone, license, vehicle.upper() if vehicle else None, pin, notes))
                else:
                    cursor.execute("""
                        INSERT OR IGNORE INTO drivers 
                        (name, phone, license_number, vehicle_number, pin, notes, status)
                        VALUES (?, ?, ?, ?, ?, ?, 'active')
                    """, (name, phone, license, vehicle.upper() if vehicle else None, pin, notes))
            except sqlite3.IntegrityError as e:
                print(f"⚠️  Skipped {name}: {e}")
                continue
        
        conn.commit()
        
        # Verify insertion
        cursor.execute("SELECT id, name, vehicle_number, pin FROM drivers ORDER BY id")
        drivers = cursor.fetchall()
        
        conn.close()
        
        print("✅ Test drivers created successfully!\n")
        print("📋 Available test drivers:")
        print("-" * 60)
        for row in drivers:
            driver_id, name, vehicle, pin = row
            if vehicle:
                print(f"  ID: {driver_id} | Name: {name:20} | Vehicle: {vehicle:15} | PIN: {pin}")
            else:
                print(f"  ID: {driver_id} | Name: {name:20} | PIN: {pin}")
        
        print("\n🔐 Recommended test login:")
        print("  Driver ID: 999")
        print("  PIN: 99")
        print("-" * 60)
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        return False

if __name__ == '__main__':
    success = create_test_drivers()
    sys.exit(0 if success else 1)
