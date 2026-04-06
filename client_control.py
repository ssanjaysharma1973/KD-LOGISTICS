#!/usr/bin/env python3
"""
KD-LOGISTICS: Client Master Control Panel
Manage all clients from one place - Create, Edit, Deactivate, View
Usage: python3 client_control.py
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime
from tabulate import tabulate

DB_PATH = Path(__file__).parent / 'backend' / 'fleet_erp_backend_sqlite.db'

def connect_db():
    """Connect to database"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def print_header(title):
    """Print formatted header"""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}\n")

def list_all_clients():
    """Display all clients with their details"""
    print_header("ALL CLIENTS IN SYSTEM")
    conn = connect_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            id, 
            client_code, 
            pin, 
            name, 
            status,
            datetime(created_at) as created
        FROM clients 
        ORDER BY id
    ''')
    
    rows = cursor.fetchall()
    conn.close()
    
    if not rows:
        print("❌ No clients found")
        return
    
    data = []
    for row in rows:
        status_icon = "✅" if row['status'] == 'active' else "❌"
        data.append([
            row['id'],
            row['client_code'],
            row['pin'],
            row['name'],
            f"{status_icon} {row['status']}",
            row['created']
        ])
    
    print(tabulate(data, headers=['ID', 'Code', 'PIN', 'Name', 'Status', 'Created'], tablefmt='grid'))
    print(f"\n📊 Total Clients: {len(rows)}")

def view_client_details(client_id):
    """View detailed info for a specific client"""
    conn = connect_db()
    cursor = conn.cursor()
    
    # Get client info
    cursor.execute('SELECT * FROM clients WHERE id = ?', (client_id,))
    client = cursor.fetchone()
    
    if not client:
        print(f"❌ Client ID {client_id} not found")
        conn.close()
        return
    
    print_header(f"CLIENT DETAILS: {client['client_code']}")
    
    print(f"📌 ID: {client['id']}")
    print(f"📝 Code: {client['client_code']}")
    print(f"🔑 PIN: {client['pin']}")
    print(f"🏢 Name: {client['name']}")
    print(f"✅ Status: {client['status']}")
    print(f"📅 Created: {client['created_at']}")
    
    # Get vehicles
    cursor.execute('''
        SELECT id, vehicle_number, model, status 
        FROM client_vehicles 
        WHERE client_id = ?
        ORDER BY vehicle_number
    ''', (client_id,))
    
    vehicles = cursor.fetchall()
    print(f"\n🚗 Vehicles ({len(vehicles)}):")
    
    if vehicles:
        v_data = []
        for v in vehicles:
            v_icon = "✅" if v['status'] == 'active' else "❌"
            v_data.append([v['id'], v['vehicle_number'], v['model'], f"{v_icon} {v['status']}"])
        print(tabulate(v_data, headers=['ID', 'Vehicle', 'Model', 'Status'], tablefmt='simple'))
    else:
        print("   No vehicles assigned")
    
    # Get admins
    cursor.execute('''
        SELECT id, username, name, admin_type, status 
        FROM admins 
        WHERE client_id = ?
    ''', (client_id,))
    
    admins = cursor.fetchall()
    print(f"\n👨‍💼 Admins ({len(admins)}):")
    
    if admins:
        a_data = []
        for a in admins:
            a_icon = "✅" if a['status'] == 'active' else "❌"
            a_data.append([a['id'], a['username'], a['name'], a['admin_type'], f"{a_icon} {a['status']}"])
        print(tabulate(a_data, headers=['ID', 'Username', 'Name', 'Type', 'Status'], tablefmt='simple'))
    else:
        print("   No admins assigned")
    
    # Get munshis
    cursor.execute('''
        SELECT id, name, email, phone, status 
        FROM munshis 
        WHERE client_id = ?
    ''', (client_id,))
    
    munshis = cursor.fetchall()
    print(f"\n👨‍💼 Munshis ({len(munshis)}):")
    
    if munshis:
        m_data = []
        for m in munshis:
            m_icon = "✅" if m['status'] == 'active' else "❌"
            m_data.append([m['id'], m['name'], m['email'] or 'N/A', f"{m_icon} {m['status']}"])
        print(tabulate(m_data, headers=['ID', 'Name', 'Email', 'Status'], tablefmt='simple'))
    else:
        print("   No munshis assigned")
    
    conn.close()

def create_client():
    """Create a new client"""
    print_header("CREATE NEW CLIENT")
    
    client_code = input("Enter Client Code (e.g., CLIENT_002): ").strip().upper()
    if not client_code:
        print("❌ Client code required")
        return
    
    pin = input("Enter PIN (4-6 digits): ").strip()
    if not pin or not pin.isdigit() or len(pin) < 4:
        print("❌ PIN must be 4-6 digits")
        return
    
    name = input("Enter Company Name: ").strip()
    if not name:
        print("❌ Company name required")
        return
    
    try:
        conn = connect_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO clients (client_code, pin, name, status)
            VALUES (?, ?, ?, 'active')
        ''', (client_code, pin, name))
        
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        
        print(f"\n✅ Client created successfully!")
        print(f"   ID: {new_id}")
        print(f"   Code: {client_code}")
        print(f"   PIN: {pin}")
        print(f"   Name: {name}")
        
    except sqlite3.IntegrityError as e:
        print(f"❌ Error: {e}")
        if "client_code" in str(e):
            print("   Client code already exists")
        if "pin" in str(e):
            print("   PIN already in use")

def edit_client():
    """Edit an existing client"""
    print_header("EDIT CLIENT")
    
    list_all_clients()
    
    try:
        client_id = int(input("\nEnter Client ID to edit: "))
    except ValueError:
        print("❌ Invalid ID")
        return
    
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM clients WHERE id = ?', (client_id,))
    client = cursor.fetchone()
    
    if not client:
        print(f"❌ Client ID {client_id} not found")
        conn.close()
        return
    
    print(f"\n━━ Current: {client['client_code']} - {client['name']} ({client['status']})")
    
    print("\n1. Change PIN")
    print("2. Change Name")
    print("3. Activate/Deactivate")
    print("4. Cancel")
    
    choice = input("\nSelect option: ")
    
    if choice == '1':
        new_pin = input("Enter new PIN: ").strip()
        if not new_pin or not new_pin.isdigit():
            print("❌ Invalid PIN")
            conn.close()
            return
        try:
            cursor.execute('UPDATE clients SET pin = ? WHERE id = ?', (new_pin, client_id))
            conn.commit()
            print(f"✅ PIN updated: {new_pin}")
        except sqlite3.IntegrityError:
            print("❌ PIN already in use")
    
    elif choice == '2':
        new_name = input("Enter new name: ").strip()
        if not new_name:
            print("❌ Name required")
            conn.close()
            return
        cursor.execute('UPDATE clients SET name = ? WHERE id = ?', (new_name, client_id))
        conn.commit()
        print(f"✅ Name updated: {new_name}")
    
    elif choice == '3':
        new_status = 'inactive' if client['status'] == 'active' else 'active'
        cursor.execute('UPDATE clients SET status = ? WHERE id = ?', (new_status, client_id))
        conn.commit()
        print(f"✅ Status changed: {new_status.upper()}")
    
    else:
        print("❌ Cancelled")
    
    conn.close()

def manage_vehicles():
    """Add/remove vehicles for a client"""
    print_header("MANAGE CLIENT VEHICLES")
    
    list_all_clients()
    
    try:
        client_id = int(input("\nEnter Client ID: "))
    except ValueError:
        print("❌ Invalid ID")
        return
    
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM clients WHERE id = ?', (client_id,))
    client = cursor.fetchone()
    
    if not client:
        print(f"❌ Client not found")
        conn.close()
        return
    
    view_client_details(client_id)
    
    print("\n1. Add Vehicle")
    print("2. Remove Vehicle")
    print("3. Activate/Deactivate Vehicle")
    print("4. Back")
    
    choice = input("\nSelect option: ")
    
    if choice == '1':
        vehicle_no = input("Enter Vehicle Number (e.g., MH01AB1234): ").strip().upper()
        model = input("Enter Model (e.g., Tata 1109): ").strip()
        
        if not vehicle_no or not model:
            print("❌ Vehicle number and model required")
            conn.close()
            return
        
        try:
            cursor.execute('''
                INSERT INTO client_vehicles (client_id, vehicle_number, model, status)
                VALUES (?, ?, ?, 'active')
            ''', (client_id, vehicle_no, model))
            conn.commit()
            print(f"✅ Vehicle added: {vehicle_no}")
        except sqlite3.IntegrityError:
            print("❌ Vehicle already exists")
    
    elif choice == '2':
        try:
            vehicle_id = int(input("Enter Vehicle ID to remove: "))
            cursor.execute('DELETE FROM client_vehicles WHERE id = ? AND client_id = ?', (vehicle_id, client_id))
            conn.commit()
            print(f"✅ Vehicle removed")
        except ValueError:
            print("❌ Invalid ID")
    
    elif choice == '3':
        try:
            vehicle_id = int(input("Enter Vehicle ID: "))
            cursor.execute('SELECT status FROM client_vehicles WHERE id = ? AND client_id = ?', (vehicle_id, client_id))
            vehicle = cursor.fetchone()
            if vehicle:
                new_status = 'inactive' if vehicle['status'] == 'active' else 'active'
                cursor.execute('UPDATE client_vehicles SET status = ? WHERE id = ?', (new_status, vehicle_id))
                conn.commit()
                print(f"✅ Status changed: {new_status.upper()}")
            else:
                print("❌ Vehicle not found")
        except ValueError:
            print("❌ Invalid ID")
    
    conn.close()

def bulk_operations():
    """Bulk operations on all clients"""
    print_header("BULK OPERATIONS")
    
    print("⚠️  WARNING: Bulk operations affect all clients!")
    print("\n1. Activate ALL clients")
    print("2. Deactivate ALL clients")
    print("3. View Statistics")
    print("4. Export to CSV")
    print("5. Cancel")
    
    choice = input("\nSelect option: ")
    
    conn = connect_db()
    cursor = conn.cursor()
    
    if choice == '1':
        confirm = input("Activate ALL clients? (yes/no): ")
        if confirm.lower() == 'yes':
            cursor.execute("UPDATE clients SET status = 'active'")
            conn.commit()
            print(f"✅ All clients activated")
    
    elif choice == '2':
        confirm = input("Deactivate ALL clients? (yes/no): ")
        if confirm.lower() == 'yes':
            cursor.execute("UPDATE clients SET status = 'inactive'")
            conn.commit()
            print(f"✅ All clients deactivated")
    
    elif choice == '3':
        cursor.execute('SELECT COUNT(*) as cnt FROM clients')
        total_clients = cursor.fetchone()['cnt']
        
        cursor.execute("SELECT COUNT(*) as cnt FROM clients WHERE status = 'active'")
        active_clients = cursor.fetchone()['cnt']
        
        cursor.execute('SELECT COUNT(*) as cnt FROM client_vehicles')
        total_vehicles = cursor.fetchone()['cnt']
        
        cursor.execute("SELECT COUNT(*) as cnt FROM client_vehicles WHERE status = 'active'")
        active_vehicles = cursor.fetchone()['cnt']
        
        cursor.execute('SELECT COUNT(*) as cnt FROM admins')
        total_admins = cursor.fetchone()['cnt']
        
        cursor.execute('SELECT COUNT(*) as cnt FROM munshis')
        total_munshis = cursor.fetchone()['cnt']
        
        print(f"\n📊 SYSTEM STATISTICS")
        print(f"   Clients: {active_clients}/{total_clients} active")
        print(f"   Vehicles: {active_vehicles}/{total_vehicles} active")
        print(f"   Admins: {total_admins} total")
        print(f"   Munshis: {total_munshis} total")
    
    elif choice == '4':
        cursor.execute('SELECT * FROM clients ORDER BY id')
        clients = cursor.fetchall()
        
        with open('clients_export.json', 'w') as f:
            json.dump([dict(c) for c in clients], f, indent=2, default=str)
        print(f"✅ Exported to clients_export.json ({len(clients)} clients)")
    
    conn.close()

def interactive_menu():
    """Main menu"""
    while True:
        print_header("CLIENT CONTROL PANEL")
        print("1. View All Clients")
        print("2. View Client Details")
        print("3. Create New Client")
        print("4. Edit Client")
        print("5. Manage Vehicles")
        print("6. Bulk Operations")
        print("7. Exit")
        print()
        
        choice = input("Select option (1-7): ").strip()
        
        if choice == '1':
            list_all_clients()
        elif choice == '2':
            try:
                client_id = int(input("Enter Client ID: "))
                view_client_details(client_id)
            except ValueError:
                print("❌ Invalid ID")
        elif choice == '3':
            create_client()
        elif choice == '4':
            edit_client()
        elif choice == '5':
            manage_vehicles()
        elif choice == '6':
            bulk_operations()
        elif choice == '7':
            print("\n👋 Goodbye!\n")
            break
        else:
            print("❌ Invalid option")
        
        input("\nPress Enter to continue...")

if __name__ == '__main__':
    if not DB_PATH.exists():
        print(f"❌ Database not found at: {DB_PATH}")
        exit(1)
    
    try:
        interactive_menu()
    except KeyboardInterrupt:
        print("\n\n👋 Interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
