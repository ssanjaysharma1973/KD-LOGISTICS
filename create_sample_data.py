"""
Populate sample data for trips, routes, and live vehicles
"""
import sqlite3
from datetime import datetime, timedelta
import json

DB_PATH = 'fleet_erp_backend_sqlite.db'

def populate_sample_data():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create trips table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS trips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id INTEGER NOT NULL,
            driver_id INTEGER NOT NULL,
            origin TEXT NOT NULL,
            destination TEXT NOT NULL,
            load_type TEXT,
            weight INTEGER,
            distance INTEGER,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            eta TIMESTAMP,
            notes TEXT
        )
    ''')
    
    # Check if we already have sample data
    cursor.execute("SELECT COUNT(*) FROM trips")
    if cursor.fetchone()[0] > 0:
        print("✓ Sample trips already exist, skipping...")
        conn.close()
        return
    
    # Get a real vehicle and driver
    cursor.execute("SELECT id FROM client_vehicles LIMIT 1")
    vehicle = cursor.fetchone()
    if not vehicle:
        print("✗ No vehicles found, creating sample vehicle...")
        cursor.execute('''
            INSERT INTO client_vehicles (client_id, vehicle_number, model, capacity, status)
            VALUES (?, ?, ?, ?, ?)
        ''', ('CLIENT_001', 'VH-001', 'Tata 407', 5000, 'active'))
        vehicle_id = cursor.lastrowid
    else:
        vehicle_id = vehicle[0]
    
    cursor.execute("SELECT id FROM drivers LIMIT 1")
    driver = cursor.fetchone()
    if not driver:
        print("✗ No drivers found, creating sample driver...")
        cursor.execute('''
            INSERT INTO drivers (client_id, name, phone, license_number, status)
            VALUES (?, ?, ?, ?, ?)
        ''', ('CLIENT_001', 'John Doe', '9876543210', 'DL12345', 'active'))
        driver_id = cursor.lastrowid
    else:
        driver_id = driver[0]
    
    # Insert sample trips
    print("📍 Adding sample trips...")
    now = datetime.now()
    
    trips_data = [
        {
            'vehicle_id': vehicle_id,
            'driver_id': driver_id,
            'origin': 'Mumbai Port',
            'destination': 'Pune Warehouse',
            'load_type': 'General Cargo',
            'weight': 4500,
            'distance': 180,
            'status': 'in_transit',
            'created_at': (now - timedelta(hours=2)).isoformat(),
            'started_at': (now - timedelta(hours=1)).isoformat(),
            'completed_at': None,
            'notes': json.dumps({
                'from_location': 'Mumbai Port',
                'to_location': 'Pune Warehouse',
                'munshi_name': 'Mr. Sharma'
            })
        },
        {
            'vehicle_id': vehicle_id,
            'driver_id': driver_id,
            'origin': 'Bangalore Hub',
            'destination': 'Hyderabad Distribution',
            'load_type': 'Electronics',
            'weight': 3000,
            'distance': 560,
            'status': 'completed',
            'created_at': (now - timedelta(days=1)).isoformat(),
            'started_at': (now - timedelta(days=1, hours=1)).isoformat(),
            'completed_at': (now - timedelta(hours=5)).isoformat(),
            'notes': json.dumps({
                'from_location': 'Bangalore Hub',
                'to_location': 'Hyderabad Distribution',
                'munshi_name': 'Mr. Kumar'
            })
        },
        {
            'vehicle_id': vehicle_id,
            'driver_id': driver_id,
            'origin': 'Delhi Warehouse',
            'destination': 'Jaipur Transit',
            'load_type': 'Textiles',
            'weight': 2500,
            'distance': 250,
            'status': 'pending',
            'created_at': now.isoformat(),
            'started_at': None,
            'completed_at': None,
            'notes': json.dumps({
                'from_location': 'Delhi Warehouse',
                'to_location': 'Jaipur Transit',
                'munshi_name': 'Mr. Singh'
            })
        }
    ]
    
    for trip in trips_data:
        cursor.execute('''
            INSERT INTO trips (
                vehicle_id, driver_id, origin, destination, 
                load_type, weight, distance, status, 
                created_at, started_at, completed_at, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            trip['vehicle_id'], trip['driver_id'], trip['origin'], trip['destination'],
            trip['load_type'], trip['weight'], trip['distance'], trip['status'],
            trip['created_at'], trip['started_at'], trip['completed_at'], trip['notes']
        ))
        print(f"  ✓ Trip: {trip['origin']} → {trip['destination']} ({trip['status']})")
    
    # Insert sample standard routes
    print("\n📍 Adding sample routes...")
    routes_data = [
        {
            'client_id': 'CLIENT_001',
            'route_no': 'RT-001',
            'route_name': 'Mumbai-Pune Express',
            'from_location': 'Mumbai Port',
            'to_location': 'Pune Warehouse',
            'route_km': 180,
            'expense_per_km': 25,
            'num_points': 3,
            'total_estimated_expense': 4500,
            'toll_charges': 950,
            'route_geometry': json.dumps([
                [72.8479, 19.0760],  # Mumbai
                [73.5, 19.5],         # Intermediate
                [73.8568, 18.5204]    # Pune
            ])
        },
        {
            'client_id': 'CLIENT_001',
            'route_no': 'RT-002',
            'route_name': 'Bangalore-Hyderabad',
            'from_location': 'Bangalore Hub',
            'to_location': 'Hyderabad Distribution',
            'route_km': 560,
            'expense_per_km': 20,
            'num_points': 4,
            'total_estimated_expense': 11200,
            'toll_charges': 2400,
            'route_geometry': json.dumps([
                [77.5941, 12.9716],  # Bangalore
                [78.0, 13.5],
                [78.5, 14.0],
                [78.4711, 17.3850]   # Hyderabad
            ])
        },
        {
            'client_id': 'CLIENT_001',
            'route_no': 'RT-003',
            'route_name': 'Delhi-Jaipur Route',
            'from_location': 'Delhi Warehouse',
            'to_location': 'Jaipur Transit',
            'route_km': 250,
            'expense_per_km': 22,
            'num_points': 3,
            'total_estimated_expense': 5500,
            'toll_charges': 850,
            'route_geometry': json.dumps([
                [77.1025, 28.7041],  # Delhi
                [77.5, 28.0],
                [75.7873, 26.9124]   # Jaipur
            ])
        }
    ]
    
    # Create standard_routes table if not exists
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS standard_routes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT,
            route_no TEXT UNIQUE,
            route_name TEXT,
            from_location TEXT,
            to_location TEXT,
            route_km REAL,
            expense_per_km REAL,
            num_points INTEGER,
            total_estimated_expense REAL,
            toll_charges REAL,
            route_geometry TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    for route in routes_data:
        cursor.execute('''
            INSERT OR IGNORE INTO standard_routes (
                client_id, route_no, route_name, from_location, to_location,
                route_km, expense_per_km, num_points, total_estimated_expense,
                toll_charges, route_geometry
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            route['client_id'], route['route_no'], route['route_name'],
            route['from_location'], route['to_location'],
            route['route_km'], route['expense_per_km'], route['num_points'],
            route['total_estimated_expense'], route['toll_charges'],
            route['route_geometry']
        ))
        print(f"  ✓ Route: {route['route_name']} ({route['route_km']} km)")
    
    conn.commit()
    conn.close()
    print("\n✅ Sample data created successfully!")

if __name__ == '__main__':
    populate_sample_data()
