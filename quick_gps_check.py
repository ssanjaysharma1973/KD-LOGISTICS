#!/usr/bin/env python3
import sqlite3
conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
cur = conn.cursor()
try:
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cur.fetchall()
    print('Tables:', [t[0] for t in tables])
    
    cur.execute('SELECT COUNT(*) FROM gps_current')
    print('gps_current rows:', cur.fetchone()[0])
    
    cur.execute('SELECT COUNT(*) FROM gps_live_data')
    print('gps_live_data rows:', cur.fetchone()[0])
    
    cur.execute('SELECT DISTINCT vehicle_number FROM gps_current LIMIT 5')
    vehicles = cur.fetchall()
    print('Sample vehicles in gps_current:', [v[0] for v in vehicles])
except Exception as e:
    print('Error:', e)
conn.close()
