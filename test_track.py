#!/usr/bin/env python3
"""Quick track test - verify gps_current has data for a vehicle"""
import sqlite3

DB = 'fleet_erp_backend_sqlite.db'

try:
    conn = sqlite3.connect(DB, timeout=10)
    cur = conn.cursor()
    
    # Check HR69G4183
    rows = cur.execute(
        'SELECT vehicle_number, latitude, longitude, gps_time FROM gps_current WHERE vehicle_number = ? LIMIT 1',
        ('HR69G4183',)
    ).fetchall()
    
    if rows:
        v, lat, lng, ts = rows[0]
        print(f'✅ Track data EXISTS for {v}')
        print(f'   Location: {lat}, {lng}')
        print(f'   Time: {ts}')
        print('\nTrack should load in UI now.')
    else:
        print('❌ No track data found for HR69G4183')
        print('   Need to sync fresh data')
    
    conn.close()
except Exception as e:
    print(f'❌ Error: {e}')
