#!/usr/bin/env python
"""
Create test data for fuel module testing
- Creates test driver, vehicle, and trip
- Ready for fuel advance request testing
"""
import sqlite3
from datetime import datetime, timedelta

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
cursor = conn.cursor()

print("=== CREATING TEST DATA FOR FUEL MODULE ===\n")

try:
    # 1. Create test driver
    print("1. Creating test driver...")
    cursor.execute("""
        INSERT OR IGNORE INTO drivers (client_id, name, phone, license, notes)
        VALUES (?, ?, ?, ?, ?)
    """, (
        'CLIENT_001',
        'Fuel Test Driver',
        '9876543210',
        'DL123456789',
        'Test driver for fuel module'
    ))
    conn.commit()
    
    # Get driver ID
    cursor.execute("SELECT id FROM drivers WHERE name = 'Fuel Test Driver'")
    driver_id = cursor.fetchone()
    driver_id = driver_id[0] if driver_id else 1
    print(f"   ✓ Driver created: ID {driver_id}")
    
    # 2. Create test vehicle
    print("\n2. Creating test vehicle...")
    cursor.execute("""
        INSERT OR IGNORE INTO vehicles (
            client_id, vehicle_no, vehicle_type, owner_name, 
            driver_id, kmpl, fuel_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        'CLIENT_001',
        'MH01AB1234',
        '32ft',
        'Test Owner',
        driver_id,
        8.5,  # 8.5 KMPL
        'diesel'
    ))
    conn.commit()
    print("   ✓ Vehicle created: MH01AB1234 (32ft)")
    
    # 3. Create test trip
    print("\n3. Creating test trip...")
    trip_date = datetime.now().strftime('%Y-%m-%d')
    cursor.execute("""
        INSERT INTO munshi_trips (
            trip_no, client_id, vehicle_no, driver_id, driver_name,
            from_poi_name, to_poi_name, km, 
            status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        f'TRIP_FUEL_{int(datetime.now().timestamp())}',
        'CLIENT_001',
        'MH01AB1234',
        driver_id,
        'Fuel Test Driver',
        'Mumbai',
        'Pune',
        300,
        'active',
        trip_date
    ))
    conn.commit()
    
    # Get trip ID
    cursor.execute("SELECT id FROM munshi_trips ORDER BY id DESC LIMIT 1")
    trip_id = cursor.fetchone()[0]
    print(f"   ✓ Trip created: ID {trip_id}")
    print(f"      Route: Mumbai → Pune (300 km)")
    print(f"      Vehicle: MH01AB1234")
    print(f"      Driver: Fuel Test Driver")
    
    # 4. Check fuel tables
    print("\n4. Checking fuel module tables...")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'fuel%'")
    fuel_tables = [row[0] for row in cursor.fetchall()]
    print(f"   ✓ Found {len(fuel_tables)} fuel tables")
    
    # 5. Check fuel policy
    print("\n5. Checking fuel policies...")
    cursor.execute("SELECT COUNT(*) FROM fuel_policy_rules")
    policy_count = cursor.fetchone()[0]
    print(f"   ✓ Available policies: {policy_count}")
    
    # 6. Check KMPL rules
    print("\n6. Checking KMPL rules...")
    cursor.execute("SELECT COUNT(*) FROM vehicle_mileage_rules")
    kmpl_count = cursor.fetchone()[0]
    print(f"   ✓ Available KMPL rules: {kmpl_count}")
    
    print("\n" + "="*60)
    print("✅ TEST DATA CREATED SUCCESSFULLY!")
    print("="*60)
    print(f"\nReady to test fuel module:")
    print(f"  • Trip ID: {trip_id}")
    print(f"  • Driver ID: {driver_id} (Fuel Test Driver)")
    print(f"  • Vehicle: MH01AB1234")
    print(f"\nExpected fuel for this trip:")
    print(f"  • Distance: 300 km")
    print(f"  • KMPL: 8.5 (from vehicle)")
    print(f"  • Expected fuel: ~35 liters (300 / 8.5)")
    print(f"\nNext steps:")
    print(f"  1. Open http://localhost:5173 in browser")
    print(f"  2. Navigate to Fuel Management")
    print(f"  3. Request advance for Trip {trip_id}")
    print(f"  4. Test approval workflow")
    print(f"  5. Upload fuel bill")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

finally:
    conn.close()
