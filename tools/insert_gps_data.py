#!/usr/bin/env python3
"""
Insert GPS data into SQLite database (gps_live_data and gps_current tables).
Called by Node.js server to persist live GPS positions.

Usage:
    python tools/insert_gps_data.py <db_path> <json_data> <client_id>

Args:
    db_path: Path to SQLite database file
    json_data: JSON array of vehicle objects with lat, lng, number, lastUpdate
    client_id: Client/tenant ID for the data

Returns:
    JSON with {inserted: count, error: message}
"""
import sys
import json
import sqlite3
import re
from datetime import datetime


def normalize_vehicle_number(v):
    """Normalize vehicle number: uppercase, remove non-alphanumeric."""
    if not v:
        return ''
    return re.sub(r'[^A-Z0-9]', '', str(v).upper())


def insert_gps_data(db_path, vehicles, client_id):
    """
    Insert GPS data into gps_live_data and gps_current tables.
    
    Args:
        db_path: Path to SQLite database
        vehicles: List of vehicle dicts with {number, lat, lng, lastUpdate, ...}
        client_id: Client/tenant identifier
    
    Returns:
        Number of rows inserted
    """
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    
    # Ensure tables exist
    cur.execute('''CREATE TABLE IF NOT EXISTS gps_live_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_number TEXT,
        latitude REAL,
        longitude REAL,
        speed REAL,
        gps_time TEXT,
        client_id TEXT
    )''')
    
    cur.execute('''CREATE TABLE IF NOT EXISTS gps_current (
        vehicle_number TEXT,
        latitude REAL,
        longitude REAL,
        gps_time TEXT,
        client_id TEXT,
        PRIMARY KEY(vehicle_number, client_id)
    )''')
    
    # Create indexes if not exist
    cur.execute('CREATE INDEX IF NOT EXISTS idx_gps_live_time ON gps_live_data(gps_time)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_gps_live_vehicle ON gps_live_data(vehicle_number)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_gps_live_client ON gps_live_data(client_id)')
    
    to_live = []
    to_current = []
    
    for v in vehicles:
        # Extract and normalize vehicle number
        number = v.get('number') or v.get('vehicle_number') or v.get('id') or ''
        vnorm = normalize_vehicle_number(number)
        if not vnorm:
            continue
        
        # Extract coordinates
        lat = v.get('lat') or v.get('latitude')
        lng = v.get('lng') or v.get('longitude')
        
        # Skip if no valid coordinates
        if lat is None or lng is None or lat == 0 or lng == 0:
            continue
        
        lat = float(lat)
        lng = float(lng)
        
        # Extract timestamp
        gps_time = v.get('lastUpdate') or v.get('gps_time') or v.get('timestamp')
        if not gps_time:
            gps_time = datetime.utcnow().isoformat() + 'Z'
        
        # Parse timestamp if it's an epoch
        if isinstance(gps_time, (int, float)):
            epoch = float(gps_time)
            if epoch > 1e12:  # milliseconds
                epoch = epoch / 1000
            gps_time = datetime.utcfromtimestamp(epoch).isoformat() + 'Z'
        
        # Extract speed (optional)
        speed = v.get('speed')
        if speed is not None:
            try:
                speed = float(speed)
            except:
                speed = None
        
        to_live.append((vnorm, lat, lng, speed, gps_time, client_id))
        to_current.append((vnorm, lat, lng, gps_time, client_id))
    
    inserted = 0
    
    if to_live:
        cur.executemany(
            "INSERT INTO gps_live_data (vehicle_number, latitude, longitude, speed, gps_time, client_id) VALUES (?,?,?,?,?,?)",
            to_live
        )
        inserted = len(to_live)
    
    if to_current:
        cur.executemany(
            "INSERT OR REPLACE INTO gps_current (vehicle_number, latitude, longitude, gps_time, client_id) VALUES (?,?,?,?,?)",
            to_current
        )
    
    conn.commit()
    conn.close()
    
    return inserted


def main():
    if len(sys.argv) < 4:
        print(json.dumps({'error': 'Usage: insert_gps_data.py <db_path> <json_data> <client_id>'}))
        sys.exit(1)
    
    db_path = sys.argv[1]
    json_data = sys.argv[2]
    client_id = sys.argv[3]
    
    try:
        vehicles = json.loads(json_data)
        if not isinstance(vehicles, list):
            raise ValueError('json_data must be an array')
        
        inserted = insert_gps_data(db_path, vehicles, client_id)
        print(json.dumps({'inserted': inserted}))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
