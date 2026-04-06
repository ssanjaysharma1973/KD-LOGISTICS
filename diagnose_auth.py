#!/usr/bin/env python3
"""
KD-LOGISTICS Authentication Diagnostic Tool
Quick troubleshooting for client login and business rules issues
Usage: python3 diagnose_auth.py
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent / 'backend' / 'fleet_erp_backend_sqlite.db'

def connect_db():
    """Connect to database"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def print_header(title):
    """Print formatted header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def check_database_exists():
    """Verify database exists"""
    if not DB_PATH.exists():
        print(f"❌ Database not found at: {DB_PATH}")
        return False
    print(f"✅ Database found: {DB_PATH}")
    return True

def show_all_clients():
    """Display all registered clients"""
    print_header("REGISTERED CLIENTS")
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, client_code, pin, name, status FROM clients ORDER BY id')
    rows = cursor.fetchall()
    
    if not rows:
        print("⚠️  No clients found in database")
        return
    
    print(f"{'ID':<3} {'Client Code':<15} {'PIN':<8} {'Name':<25} {'Status':<10}")
    print("-" * 70)
    for row in rows:
        status_emoji = "✅" if row['status'] == 'active' else "❌"
        print(f"{row['id']:<3} {row['client_code']:<15} {row['pin']:<8} {row['name']:<25} {status_emoji} {row['status']:<8}")
    conn.close()

def show_client_vehicles(client_code):
    """Show vehicles for a specific client"""
    print_header(f"VEHICLES FOR CLIENT: {client_code}")
    conn = connect_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT id FROM clients WHERE client_code = ?', (client_code,))
    client = cursor.fetchone()
    
    if not client:
        print(f"❌ Client '{client_code}' not found")
        conn.close()
        return
    
    cursor.execute('''
        SELECT id, vehicle_number, model, status 
        FROM client_vehicles 
        WHERE client_id = ?
        ORDER BY vehicle_number
    ''', (client['id'],))
    
    vehicles = cursor.fetchall()
    if not vehicles:
        print(f"⚠️  No vehicles assigned to {client_code}")
        conn.close()
        return
    
    print(f"{'ID':<3} {'Vehicle Number':<15} {'Model':<20} {'Status':<10}")
    print("-" * 50)
    for v in vehicles:
        status_emoji = "✅" if v['status'] == 'active' else "❌"
        print(f"{v['id']:<3} {v['vehicle_number']:<15} {v['model']:<20} {status_emoji} {v['status']:<8}")
    conn.close()

def test_pin_login(pin):
    """Test if a PIN can login"""
    print_header(f"TESTING PIN LOGIN: {pin}")
    conn = connect_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, client_code, name, status FROM clients 
        WHERE pin = ? 
    ''', (pin,))
    
    client = cursor.fetchone()
    
    if not client:
        print(f"❌ PIN '{pin}' not found in database")
        print(f"   Expected: Valid PIN should match a client record")
        conn.close()
        return False
    
    if client['status'] != 'active':
        print(f"❌ Client '{client['client_code']}' is INACTIVE")
        print(f"   Issue: Client status = '{client['status']}' (must be 'active')")
        print(f"   Fix: UPDATE clients SET status='active' WHERE client_code='{client['client_code']}';")
        conn.close()
        return False
    
    print(f"✅ PIN '{pin}' is VALID")
    print(f"   Client: {client['client_code']} - {client['name']}")
    
    # Check vehicles
    cursor.execute('''
        SELECT COUNT(*) as cnt FROM client_vehicles 
        WHERE client_id = ? AND status = 'active'
    ''', (client['id'],))
    
    vehicle_count = cursor.fetchone()['cnt']
    if vehicle_count == 0:
        print(f"⚠️  WARNING: No active vehicles assigned to this client")
        print(f"   Fix: Add vehicles via client_vehicles table")
    else:
        print(f"✅ {vehicle_count} active vehicle(s) available")
    
    conn.close()
    return True

def show_fuel_rules(client_code):
    """Display fuel policy rules"""
    print_header(f"FUEL RULES FOR: {client_code}")
    conn = connect_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, vehicle_category, trip_type, fuel_mode, 
               fuel_payment_responsibility, max_advance_amount, buffer_liters
        FROM fuel_policy_rules 
        WHERE client_id = ?
    ''', (client_code,))
    
    rules = cursor.fetchall()
    
    if not rules:
        print(f"⚠️  No fuel rules configured for {client_code}")
        conn.close()
        return
    
    print(f"{'Category':<10} {'Trip Type':<10} {'Mode':<15} {'Resp.':<10} {'Max ₹':<10} {'Buffer':<8}")
    print("-" * 70)
    for rule in rules:
        print(f"{rule['vehicle_category']:<10} {rule['trip_type']:<10} {rule['fuel_mode']:<15} "
              f"{rule['fuel_payment_responsibility']:<10} {rule['max_advance_amount']:<10.0f} {rule['buffer_liters']:<8.1f}")
    conn.close()

def show_admins():
    """Display admin users"""
    print_header("ADMIN USERS")
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, username, name, admin_type, status, client_id 
        FROM admins 
        ORDER BY id
    ''')
    
    admins = cursor.fetchall()
    if not admins:
        print("⚠️  No admin users found")
        conn.close()
        return
    
    print(f"{'ID':<3} {'Username':<15} {'Name':<20} {'Type':<15} {'Status':<10} {'Client':<15}")
    print("-" * 80)
    for admin in admins:
        status_emoji = "✅" if admin['status'] == 'active' else "❌"
        print(f"{admin['id']:<3} {admin['username']:<15} {admin['name']:<20} "
              f"{admin['admin_type']:<15} {status_emoji} {admin['status']:<8} {admin['client_id'] or 'N/A':<15}")
    conn.close()

def show_munshis():
    """Display munshi users"""
    print_header("MUNSHI USERS")
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT m.id, m.name, m.email, m.phone, m.status, c.client_code
        FROM munshis m
        LEFT JOIN clients c ON m.client_id = c.id
        ORDER BY m.id
    ''')
    
    munshis = cursor.fetchall()
    if not munshis:
        print("⚠️  No munshi users found")
        conn.close()
        return
    
    print(f"{'ID':<3} {'Name':<20} {'Email':<25} {'Phone':<12} {'Client':<15} {'Status':<10}")
    print("-" * 90)
    for m in munshis:
        status_emoji = "✅" if m['status'] == 'active' else "❌"
        print(f"{m['id']:<3} {m['name']:<20} {m['email']:<25} {m['phone']:<12} "
              f"{m['client_code'] or 'N/A':<15} {status_emoji} {m['status']:<8}")
    conn.close()

def interactive_menu():
    """Interactive diagnostic menu"""
    while True:
        print_header("KD-LOGISTICS AUTH DIAGNOSTICS")
        print("1. Show all clients")
        print("2. Show vehicles for a client")
        print("3. Test PIN login")
        print("4. Show fuel rules for client")
        print("5. Show admin users")
        print("6. Show munshi users")
        print("7. Full diagnostics report")
        print("8. Exit")
        print()
        
        choice = input("Select option (1-8): ").strip()
        
        if choice == '1':
            show_all_clients()
        elif choice == '2':
            client_code = input("Enter client code (e.g., CLIENT_001): ").strip()
            show_client_vehicles(client_code)
        elif choice == '3':
            pin = input("Enter PIN to test (e.g., 001): ").strip()
            test_pin_login(pin)
        elif choice == '4':
            client_code = input("Enter client code: ").strip()
            show_fuel_rules(client_code)
        elif choice == '5':
            show_admins()
        elif choice == '6':
            show_munshis()
        elif choice == '7':
            full_report()
        elif choice == '8':
            print("\n👋 Goodbye!")
            break
        else:
            print("❌ Invalid option")
        
        input("\nPress Enter to continue...")

def full_report():
    """Generate comprehensive diagnostics report"""
    print_header("FULL DIAGNOSTICS REPORT")
    show_all_clients()
    show_admins()
    show_munshis()
    print_header("DATABASE STATUS")
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('PRAGMA integrity_check')
    integrity = cursor.fetchone()[0]
    print(f"Database Integrity: {integrity}")
    conn.close()

if __name__ == '__main__':
    if not check_database_exists():
        exit(1)
    
    print("\n🔧 KD-LOGISTICS Authentication Diagnostic Tool\n")
    try:
        interactive_menu()
    except KeyboardInterrupt:
        print("\n\n👋 Interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
