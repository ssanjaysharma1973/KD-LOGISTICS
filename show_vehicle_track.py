import sqlite3

c = sqlite3.connect('fleet_erp_backend_sqlite.db')
cur = c.cursor()

# Get first 3 points
cur.execute('SELECT latitude, longitude, gps_time FROM gps_live_data WHERE vehicle_number=? ORDER BY gps_time LIMIT 3', ('DEMO_VEHICLE_001',))
rows = cur.fetchall()
print("First 3 points:")
for r in rows:
    print(f"  ({r[0]:.4f}, {r[1]:.4f}) @ {r[2]}")

# Get last 3 points  
cur.execute('SELECT latitude, longitude, gps_time FROM gps_live_data WHERE vehicle_number=? ORDER BY gps_time DESC LIMIT 3', ('DEMO_VEHICLE_001',))
rows = cur.fetchall()
print("\nLast 3 points:")
for r in reversed(rows):
    print(f"  ({r[0]:.4f}, {r[1]:.4f}) @ {r[2]}")

c.close()
