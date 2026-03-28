#!/usr/bin/env python3
"""
Add vehicle_document column and populate vehicles with complete data
"""

import sqlite3
import os
from datetime import datetime

DB_PATH = 'fleet_erp_backend_sqlite.db'

def add_vehicle_document_column():
    """Add vehicle_document column if it doesn't exist"""
    
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at {DB_PATH}")
        return False
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check if column exists
        cursor.execute("PRAGMA table_info(vehicles)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'vehicle_document' not in columns:
            cursor.execute('''
                ALTER TABLE vehicles 
                ADD COLUMN vehicle_document TEXT
            ''')
            print("✅ Added vehicle_document column")
        else:
            print("✅ vehicle_document column already exists")
        
        conn.commit()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def populate_vehicles():
    """Populate vehicles with complete real-world data"""
    
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found")
        return False
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check how many vehicles already exist
        cursor.execute("SELECT COUNT(*) FROM vehicles")
        existing = cursor.fetchone()[0]
        
        if existing == 0:
            print("📦 Populating vehicles table...")
            
            vehicles = [
                ('MH02AB1234', 'Rajesh Kumar', 'Arjun Singh', 'Delhi', 'Agra', 550, 8.5, 28.50, 'DL-RT-001', 'RTO-2023-001.pdf'),
                ('MH02CD5678', 'Amit Singh', 'Vikram Reddy', 'Agra', 'Lucknow', 420, 7.2, 28.50, 'DL-RT-002', 'RTO-2023-002.pdf'),
                ('MH02EF9012', 'Suresh Patel', 'Priya Sharma', 'Lucknow', 'Kanpur', 280, 8.8, 28.50, 'DL-RT-003', 'RTO-2023-003.pdf'),
                ('MH02GH3456', 'Mohan Singh', 'Ramesh Gupta', 'Kanpur', 'Mathura', 320, 7.5, 28.50, 'DL-RT-004', 'RTO-2023-004.pdf'),
                ('MH02IJ7890', 'Pradeep Sharma', 'Suresh Kumar', 'Mathura', 'Delhi', 180, 9.0, 28.50, 'DL-RT-005', 'RTO-2023-005.pdf'),
                ('MH02KL2345', 'Vikas Patel', 'Mahesh Patel', 'Delhi', 'Pune', 1650, 6.8, 28.50, 'DL-RT-006', 'RTO-2023-006.pdf'),
                ('MH02MN6789', 'Karan Malhotra', 'Arjun Singh', 'Pune', 'Nagpur', 720, 7.8, 28.50, 'DL-RT-007', 'RTO-2023-007.pdf'),
                ('MH02OP0123', 'Rajiv Sinha', 'Vikram Reddy', 'Nagpur', 'Bangalore', 1250, 7.0, 28.50, 'DL-RT-008', 'RTO-2023-008.pdf'),
                ('KA01AB4567', 'Ashok Kumar', 'Arjun Singh', 'Bangalore', 'Chennai', 680, 8.2, 28.50, 'KA-RT-001', 'RTO-2023-009.pdf'),
                ('KA01CD8901', 'Ramakrishnan', 'Priya Sharma', 'Chennai', 'Hyderabad', 800, 7.5, 28.50, 'KA-RT-002', 'RTO-2023-010.pdf'),
                ('TN01EF2345', 'Gopal Singh', 'Ramesh Gupta', 'Hyderabad', 'Vijayawada', 680, 8.0, 28.50, 'TN-RT-001', 'RTO-2023-011.pdf'),
                ('TN01GH6789', 'Mahesh Reddy', 'Suresh Kumar', 'Vijayawada', 'Visakhapatnam', 560, 8.5, 28.50, 'TN-RT-002', 'RTO-2023-012.pdf'),
                ('AP01IJ0123', 'Venkat Rao', 'Mahesh Patel', 'Visakhapatnam', 'Kolkata', 1890, 6.5, 28.50, 'AP-RT-001', 'RTO-2023-013.pdf'),
                ('AP01KL4567', 'Sanjay Kumar', 'Arjun Singh', 'Kolkata', 'Guwahati', 1650, 6.8, 28.50, 'AP-RT-002', 'RTO-2023-014.pdf'),
                ('WB01MN8901', 'Deepak Sen', 'Vikram Reddy', 'Guwahati', 'Imphal', 850, 7.2, 28.50, 'WB-RT-001', 'RTO-2023-015.pdf'),
                ('AS01OP2345', 'Rakesh Singh', 'Priya Sharma', 'Imphal', 'Manipur', 120, 9.5, 28.50, 'AS-RT-001', 'RTO-2023-016.pdf'),
                ('MN01QR6789', 'Arun Kumar', 'Ramesh Gupta', 'Manipur', 'Delhi', 2400, 6.0, 28.50, 'MN-RT-001', 'RTO-2023-017.pdf'),
                ('UP01ST0123', 'Virender Singh', 'Suresh Kumar', 'Delhi', 'Jaipur', 280, 8.7, 28.50, 'UP-RT-001', 'RTO-2023-018.pdf'),
                ('RJ01UV4567', 'Prem Kumar', 'Mahesh Patel', 'Jaipur', 'Ahmedabad', 680, 8.0, 28.50, 'RJ-RT-001', 'RTO-2023-019.pdf'),
                ('GJ01WX8901', 'Nitin Patel', 'Arjun Singh', 'Ahmedabad', 'Surat', 240, 9.0, 28.50, 'GJ-RT-001', 'RTO-2023-020.pdf'),
            ]
            
            for vehicle in vehicles:
                try:
                    cursor.execute('''
                        INSERT INTO vehicles 
                        (vehicle_no, driver_name, munshi_name, route_from, route_to, 
                         route_km, kmpl, fuel_cost_per_liter, route_name, vehicle_document, client_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CLIENT_001')
                    ''', vehicle)
                except Exception as e:
                    print(f"⚠️  Could not insert {vehicle[0]}: {e}")
            
            conn.commit()
            print(f"✅ Inserted {len(vehicles)} vehicles")
        else:
            print(f"✅ {existing} vehicles already exist")
        
        # Verify
        cursor.execute("SELECT COUNT(*) FROM vehicles")
        count = cursor.fetchone()[0]
        print(f"✅ Total vehicles now: {count}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == '__main__':
    print("=" * 70)
    print("🚗 SETUP: ADD VEHICLE DOCUMENT COLUMN & POPULATE VEHICLES")
    print("=" * 70)
    
    if add_vehicle_document_column():
        populate_vehicles()
    
    print("=" * 70)
