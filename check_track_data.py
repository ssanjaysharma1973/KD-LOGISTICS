import sqlite3
from datetime import datetime, timedelta

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
c = conn.cursor()

# Check if table exists
c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='gps_live_data'")
table_exists = c.fetchone()

if not table_exists:
    print("❌ gps_live_data table does NOT exist!")
    conn.close()
    exit()

# Check total rows
c.execute("SELECT COUNT(*) FROM gps_live_data")
total = c.fetchone()[0]
print(f"✅ gps_live_data exists with {total:,} rows")

# Check last 24 hours
now = datetime.utcnow()
yesterday = (now - timedelta(hours=24)).isoformat()
c.execute(f"SELECT COUNT(*) FROM gps_live_data WHERE gps_time >= '{yesterday}'")
count_24h = c.fetchone()[0]
print(f"   Last 24h: {count_24h} rows")

# Check specific vehicle
c.execute("SELECT COUNT(*) FROM gps_live_data WHERE vehicle_number = 'HR69E8323'")
vehicle_total = c.fetchone()[0]
print(f"   HR69E8323 total: {vehicle_total} rows")

# Show latest for this vehicle
c.execute("""
SELECT vehicle_number, gps_time, latitude, longitude, client_id 
FROM gps_live_data 
WHERE vehicle_number = 'HR69E8323'
ORDER BY gps_time DESC 
LIMIT 3
""")
rows = c.fetchall()
print(f"\n   Latest HR69E8323 records:")
for v, t, lat, lng, client in rows:
    print(f"   {v}: {t}")

conn.close()
