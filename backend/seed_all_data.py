"""
Seed default test data for multi-role system
"""
import sqlite3
from datetime import datetime

DB_PATH = './fleet_erp_backend_sqlite.db'

def ensure_tables():
    """Ensure all required tables exist"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Drivers table with role
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS drivers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT,
            name TEXT NOT NULL,
            phone TEXT,
            license_number TEXT UNIQUE,
            vehicle_number TEXT,
            vehicle_id INTEGER,
            role TEXT DEFAULT 'driver',
            pin TEXT,
            status TEXT DEFAULT 'active',
            assigned_at TIMESTAMP,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Munshis table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS munshis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            phone TEXT,
            pin TEXT NOT NULL,
            role TEXT DEFAULT 'munshi',
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Admins table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT,
            admin_type TEXT DEFAULT 'client_admin',
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

def seed_all_data():
    """Seed all default data"""
    ensure_tables()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("🌱 Seeding default test data...\n")
    
    # ===== 1. SEED CLIENTS (existing table schema) =====
    print("1️⃣  Setting up clients...")
    clients = [
    ('CLIENT_000', '000000', 'DevAdmin', 'active'),
    ('CLIENT_001', '001999', 'Atul Logistics', 'active'),
    ('CLIENT_002', '002', 'Test Client 002', 'active'),
    ('CLIENT_003', '003', 'Test Client 003', 'active'),
    ]
    
    try:
        for client_code, pin_code, name, status in clients:
            cursor.execute("SELECT id FROM clients WHERE client_code = ?", (client_code,))
            if not cursor.fetchone():
                cursor.execute('''
                    INSERT INTO clients (client_code, pin, name, status)
                    VALUES (?, ?, ?, ?)
                ''', (client_code, pin_code, name, status))
                print(f"   ✅ {client_code}: PIN {pin_code}")
    except Exception as e:
        print(f"   ℹ️  Clients issue: {e}")
    
    conn.commit()
    
    # ===== 2. SEED VEHICLES =====
    print("\n2️⃣  Setting up vehicles...")
    vehicles = [
        ('CLIENT_001', '999', 'Test Vehicle 999'),
        ('CLIENT_001', 'MH01AB1234', 'Tata 1109'),
        ('CLIENT_001', 'MH02XY5678', 'Ashok Leyland'),
        ('CLIENT_001', 'MH03CD9999', 'Mahindra Truck'),
        ('CLIENT_002', 'MH01AB2000', 'Hyundai HD65'),
        ('CLIENT_002', 'MH02XY2001', 'BharatBenz'),
        ('CLIENT_003', 'MH01AB3000', 'TATA 407'),
    ]
    
    try:
        for client_id, vehicle_no, model in vehicles:
            cursor.execute("SELECT id FROM client_vehicles WHERE vehicle_number = ?", (vehicle_no,))
            if not cursor.fetchone():
                cursor.execute('''
                    INSERT INTO client_vehicles (client_id, vehicle_number, model, status)
                    VALUES (?, ?, ?, 'active')
                ''', (client_id, vehicle_no, model))
                print(f"   ✅ {vehicle_no} ({model})")
    except Exception as e:
        print(f"   ℹ️  Vehicles issue: {e}")
    
    conn.commit()
    
    # ===== 3. SEED DRIVERS =====
    print("\n3️⃣  Setting up drivers...")
    drivers = [
        ('CLIENT_001', 'Raj Kumar', '9876543210', 'DL123456'),
        ('CLIENT_001', 'Priya Singh', '9876543211', 'DL123457'),
        ('CLIENT_001', 'Amit Patel', '9876543212', 'DL123458'),
        ('CLIENT_002', 'Vikram Sharma', '9876543213', 'DL123459'),
        ('CLIENT_002', 'Deepak Verma', '9876543214', 'DL123460'),
        ('CLIENT_003', 'Anita Khan', '9876543215', 'DL123461'),
    ]
    
    try:
        for client_id, name, phone, license in drivers:
            cursor.execute("SELECT id FROM drivers WHERE license_number = ?", (license,))
            if not cursor.fetchone():
                cursor.execute('''
                    INSERT INTO drivers (client_id, name, phone, license_number, role, status)
                    VALUES (?, ?, ?, ?, 'driver', 'active')
                ''', (client_id, name, phone, license))
                print(f"   ✅ {name} ({client_id})")
    except Exception as e:
        print(f"   ℹ️  Drivers issue: {e}")
    
    conn.commit()
    
    # ===== 4. SEED MUNSHIS (PIN: 999) =====
    print("\n4️⃣  Setting up munshis (PIN: 999)...")
    munshis = [
        ('CLIENT_001', 'Atul Singh', 'atul@example.com', '8765432100'),
        ('CLIENT_001', 'Raj Munshi', 'raj@example.com', '8765432101'),
        ('CLIENT_002', 'Priya Admin', 'priya@example.com', '8765432102'),
        ('CLIENT_003', 'Vikram Admin', 'vikram@example.com', '8765432103'),
    ]
    
    try:
        for client_id, name, email, phone in munshis:
            cursor.execute("SELECT id FROM munshis WHERE email = ?", (email,))
            if not cursor.fetchone():
                cursor.execute('''
                    INSERT INTO munshis (client_id, name, email, phone, pin, role, status)
                    VALUES (?, ?, ?, ?, '999', 'munshi', 'active')
                ''', (client_id, name, email, phone))
                print(f"   ✅ {name} ({email}) - PIN: 999")
    except Exception as e:
        print(f"   ℹ️  Munshis issue: {e}")
    
    conn.commit()
    
    # ===== 5. SEED ADMINS =====
    print("\n5️⃣  Setting up admins...")
    admins = [
        (None, 'sysadmin', 'admin123', 'System Admin', 'admin@example.com', 'system_admin'),
        ('CLIENT_001', 'admin001', 'admin001', 'Atul Admin', 'admin001@example.com', 'client_admin'),
        ('CLIENT_002', 'admin002', 'admin002', 'Client 002 Admin', 'admin002@example.com', 'client_admin'),
        ('CLIENT_003', 'admin003', 'admin003', 'Client 003 Admin', 'admin003@example.com', 'client_admin'),
    ]
    
    try:
        for client_id, username, password, name, email, admin_type in admins:
            cursor.execute("SELECT id FROM admins WHERE username = ?", (username,))
            if not cursor.fetchone():
                cursor.execute('''
                    INSERT INTO admins (client_id, username, password, name, email, admin_type, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'active')
                ''', (client_id, username, password, name, email, admin_type))
                client_label = client_id if client_id else 'SYSTEM'
                print(f"   ✅ {username} ({name}) - {admin_type}")
    except Exception as e:
        print(f"   ℹ️  Admins issue: {e}")
    
    conn.commit()
    
    # ===== 6. ASSIGN SOME VEHICLES TO DRIVERS =====
    print("\n6️⃣  Assigning sample vehicles to drivers...")
    try:
        assignments = [
            ('CLIENT_001', 1, 'MH01AB1234'),
            ('CLIENT_001', 2, 'MH02XY5678'),
            ('CLIENT_002', 4, 'MH01AB2000'),
        ]
        
        for client_id, driver_id, vehicle_no in assignments:
            cursor.execute('''
                SELECT vehicle_number FROM drivers WHERE id = ? AND client_id = ?
            ''', (driver_id, client_id))
            
            result = cursor.fetchone()
            if not result or not result[0]:
                cursor.execute('''
                    UPDATE drivers
                    SET vehicle_number = ?, assigned_at = ?
                    WHERE id = ? AND client_id = ?
                ''', (vehicle_no, datetime.now(), driver_id, client_id))
                print(f"   ✅ Driver {driver_id} → Vehicle {vehicle_no}")
    except Exception as e:
        print(f"   ℹ️  Assignment issue: {e}")
    
    conn.commit()
    
    # ===== PRINT CREDENTIALS =====
    print("\n" + "="*60)
    print("📋 TEST CREDENTIALS (PIN: 999 for all)")
    print("="*60)
    
    print("\n🚗 DRIVER PORTAL:")
    print("   Client Code: 001")
    print("   Vehicles: 999, MH01AB1234, MH02XY5678, MH03CD9999")
    
    print("\n👨‍💼 MUNSHI PORTAL:")
    print("   Email: atul@example.com | PIN: 999")
    print("   Email: raj@example.com | PIN: 999")
    print("   Email: priya@example.com | PIN: 999")
    
    print("\n🏢 CLIENT ADMIN PORTAL:")
    print("   Username: admin001 | Password: admin001 (CLIENT_001)")
    print("   Username: admin002 | Password: admin002 (CLIENT_002)")
    print("   Username: admin003 | Password: admin003 (CLIENT_003)")
    
    print("\n👨‍💻 SYSTEM ADMIN PORTAL:")
    print("   Username: sysadmin |   ''', (client_id, username, password, name, email, admin_type))
                client_label = client_id if client_id else 'SYSTEM'
                print(f"   ✅ {username} ({name}) - {admin_type}")
    except Exception as e:
        print(f"   ℹ️  Admins issue: {e}")
    
    conn.commit()
    
    # ===== 6. ASSIGN SOME VEHICLES TO DRIVERS =====
    print("\n6️⃣  Assigning sample vehicles to drivers...")
    try:
        assignments = [
            ('CLIENT_001', 1, 'MH01AB1234'),
            ('CLIENT_001', 2, 'MH02XY5678'),
            ('CLIENT_002', 4, 'MH01AB2000'),
        ]
        
        for client_id, driver_id, vehicle_no in assignments:
            cursor.execute('''
                SELECT vehicle_number FROM drivers WHERE id = ? AND client_id = ?
            ''', (driver_id, client_id))
            
            result = cursor.fetchone()
            if not result or not result[0]:
                cursor.execute('''
                    UPDATE drivers
                    SET vehicle_number = ?, assigned_at = ?
                    WHERE id = ? AND client_id = ?
                ''', (vehicle_no, datetime.now(), driver_id, client_id))
                print(f"   ✅ Driver {driver_id} → Vehicle {vehicle_no}")
    except Exception as e:
        print(f"   ℹ️  Assignment issue: {e}")
    
    conn.commit()
    
    # ===== PRINT CREDENTIALS =====
    print("\n" + "="*60)
    print("📋 TEST CREDENTIALS (PIN: 999 for all)")
    print("="*60)
    
    print("\n🚗 DRIVER PORTAL:")
    print("   Client Code: 001")
    print("   Vehicles: 999, MH01AB1234, MH02XY5678, MH03CD9999")
    
    print("\n👨‍💼 MUNSHI PORTAL:")
    print("   Email: atul@example.com | PIN: 999")
    print("   Email: raj@example.com | PIN: 999")
    print("   Email: priya@example.com | PIN: 999")
    
    print("\n🏢 CLIENT ADMIN PORTAL:")
    print("   Username: admin001 | Password: admin001 (CLIENT_001)")
    print("   Username: admin002 | Password: admin002 (CLIENT_002)")
    print("   Username: admin003 | Password: admin003 (CLIENT_003)")
    
    print("\n👨‍💻 SYSTEM ADMIN PORTAL:")
    print("   Username: sysadmin | Password: admin123")
    
    print("\n" + "="*60)
    
    conn.close()
    print("\n✅ Default test data seeded successfully!\n")

if __name__ == '__main__':
    seed_all_data()
