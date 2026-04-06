#!/usr/bin/env python3
"""
KD-LOGISTICS: Quick Setup - Add Clients with Full Control
5-10 clients को एक बार में add करो
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / 'backend' / 'fleet_erp_backend_sqlite.db'

def connect_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def add_clients():
    """Add 5-10 clients with sample data"""
    
    clients_data = [
        {
            'code': 'CLIENT_004',
            'pin': '004',
            'name': 'Metro Express Ltd',
            'vehicles': [
                ('MH04AB4000', 'Tata 1109'),
                ('MH04CD4001', 'Ashok Leyland'),
                ('MH04EF4002', 'Mahindra'),
            ]
        },
        {
            'code': 'CLIENT_005',
            'pin': '005',
            'name': 'Speed Traders Pvt Ltd',
            'vehicles': [
                ('MH05AB5000', 'Tata 1109'),
                ('MH05CD5001', 'Ashok Leyland'),
            ]
        },
        {
            'code': 'CLIENT_006',
            'pin': '006',
            'name': 'Global Logistics Co',
            'vehicles': [
                ('MH06AB6000', 'Volvo'),
                ('MH06CD6001', 'Tata 1109'),
                ('MH06EF6002', 'Ashok Leyland'),
                ('MH06GH6003', 'Mahindra'),
            ]
        },
        {
            'code': 'CLIENT_007',
            'pin': '007',
            'name': 'Prime Transport Solutions',
            'vehicles': [
                ('MH07AB7000', 'Tata 1109'),
                ('MH07CD7001', 'Ashok Leyland'),
                ('MH07EF7002', 'Mahindra'),
            ]
        },
        {
            'code': 'CLIENT_008',
            'pin': '008',
            'name': 'Reliable Cargo Services',
            'vehicles': [
                ('MH08AB8000', 'Volvo'),
                ('MH08CD8001', 'Tata 1109'),
                ('MH08EF8002', 'Ashok Leyland'),
            ]
        },
        {
            'code': 'CLIENT_009',
            'pin': '009',
            'name': 'Swift Delivery Network',
            'vehicles': [
                ('MH09AB9000', 'Tata 1109'),
                ('MH09CD9001', 'Mahindra'),
            ]
        },
        {
            'code': 'CLIENT_010',
            'pin': '010',
            'name': 'National Freight Ltd',
            'vehicles': [
                ('MH10AB0000', 'Volvo'),
                ('MH10CD0001', 'Tata 1109'),
                ('MH10EF0002', 'Ashok Leyland'),
                ('MH10GH0003', 'Mahindra'),
            ]
        },
    ]
    
    conn = connect_db()
    cursor = conn.cursor()
    
    added_count = 0
    vehicle_count = 0
    
    print("\n" + "="*70)
    print("  ADDING 7 NEW CLIENTS WITH VEHICLES")
    print("="*70 + "\n")
    
    for client_data in clients_data:
        try:
            # Add client
            cursor.execute('''
                INSERT INTO clients (client_code, pin, name, status)
                VALUES (?, ?, ?, 'active')
            ''', (client_data['code'], client_data['pin'], client_data['name']))
            
            client_id = cursor.lastrowid
            
            # Add vehicles for this client
            for vehicle_no, model in client_data['vehicles']:
                cursor.execute('''
                    INSERT INTO client_vehicles (client_id, vehicle_number, model, status)
                    VALUES (?, ?, ?, 'active')
                ''', (client_id, vehicle_no, model))
                vehicle_count += 1
            
            conn.commit()
            
            print(f"✅ {client_data['code']}: {client_data['name']}")
            print(f"   PIN: {client_data['pin']}")
            print(f"   Vehicles: {len(client_data['vehicles'])}")
            print()
            
            added_count += 1
            
        except sqlite3.IntegrityError as e:
            print(f"⚠️  {client_data['code']}: Already exists (skipped)")
            print()
        except Exception as e:
            print(f"❌ {client_data['code']}: Error - {e}")
            print()
    
    conn.close()
    
    print("="*70)
    print(f"✅ SUMMARY")
    print("="*70)
    print(f"Clients Added: {added_count}")
    print(f"Vehicles Added: {vehicle_count}")
    print(f"Total Clients Now: {7 + 1} (including CLIENT_001)")
    print("="*70)
    
    # Show all clients
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, client_code, pin, name, status FROM clients ORDER BY id')
    clients = cursor.fetchall()
    
    print("\n📋 ALL CLIENTS IN SYSTEM:\n")
    print(f"{'ID':<3} {'Code':<15} {'PIN':<6} {'Name':<30} {'Status':<8}")
    print("-" * 70)
    
    for row in clients:
        status_icon = "✅" if row['status'] == 'active' else "❌"
        print(f"{row['id']:<3} {row['client_code']:<15} {row['pin']:<6} {row['name']:<30} {status_icon}")
    
    conn.close()

if __name__ == '__main__':
    if not DB_PATH.exists():
        print(f"❌ Database not found at: {DB_PATH}")
        exit(1)
    
    try:
        add_clients()
        print("\n🎉 Setup Complete! All clients ready!\n")
    except KeyboardInterrupt:
        print("\n\n❌ Interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
