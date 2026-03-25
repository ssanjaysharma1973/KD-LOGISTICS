import sqlite3

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM gps_live_data WHERE vehicle_number = ?', ('DEMO_VEHICLE_001',))
count = cursor.fetchone()[0]
print(f'✅ Inserted {count} GPS points for DEMO_VEHICLE_001')

cursor.execute('SELECT latitude, longitude, gps_time FROM gps_live_data WHERE vehicle_number = ? ORDER BY gps_time LIMIT 5', ('DEMO_VEHICLE_001',))
rows = cursor.fetchall()
print('\nFirst 5 points:')
for r in rows:
    print(f'  ({r[0]:.4f}, {r[1]:.4f}) @ {r[2]}')

conn.close()
