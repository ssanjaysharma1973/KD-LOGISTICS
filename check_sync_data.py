import sqlite3
from datetime import datetime

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
c = conn.cursor()

# Check latest records in gps_live_data
c.execute("""
SELECT vehicle_number, gps_time, client_id
FROM gps_live_data
ORDER BY gps_time DESC, rowid DESC
LIMIT 10
""")

print("📊 Latest records in gps_live_data (being synced now):")
for i, (vehicle, gps_time, client_id) in enumerate(c.fetchall(), 1):
    print(f"{i}. {vehicle}: {gps_time} (client: {client_id})")

# Count distinct vehicles from today
c.execute("""
SELECT COUNT(DISTINCT vehicle_number) 
FROM gps_live_data
WHERE DATE(gps_time) = '2026-02-07'
""")
today_count = c.fetchone()[0]

# Count distinct vehicles from latest date in database
c.execute("""
SELECT DATE(gps_time) as date, COUNT(DISTINCT vehicle_number) as vehicle_count
FROM gps_live_data
GROUP BY DATE(gps_time)
ORDER BY DATE(gps_time) DESC
LIMIT 5
""")

print(f"\n📅 Vehicles by date:")
for date, count in c.fetchall():
    print(f"   {date}: {count} vehicles")

conn.close()
