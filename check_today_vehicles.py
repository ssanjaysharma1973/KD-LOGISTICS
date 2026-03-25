import sqlite3
from datetime import datetime, timedelta

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
c = conn.cursor()

# Today's date
today = datetime.now().date()
tomorrow = today + timedelta(days=1)

# Format for SQL
today_start = f'{today}T00:00:00'
today_end = f'{today}T23:59:59'

# Query for today's records
c.execute(f"""
SELECT vehicle_number, gps_time, latitude, longitude, client_id
FROM gps_current
WHERE gps_time >= ? AND gps_time <= ?
ORDER BY gps_time DESC
""", (today_start, today_end))

records = c.fetchall()

print(f"🔍 Looking for vehicles with today's timestamp ({today})")
print(f"Found: {len(records)} records\n")

if records:
    for i, record in enumerate(records[:10], 1):
        vehicle, gps_time, lat, lng, client_id = record
        print(f"{i}. {vehicle}")
        print(f"   Time: {gps_time}")
        print(f"   Location: {lat:.4f}, {lng:.4f}")
        print(f"   Client: {client_id}\n")
    
    if len(records) > 10:
        print(f"... and {len(records) - 10} more")
else:
    print("❌ No records found for today")
    print("\n📅 Latest records in database:")
    c.execute("""
    SELECT vehicle_number, gps_time, client_id
    FROM gps_current
    ORDER BY gps_time DESC
    LIMIT 5
    """)
    latest = c.fetchall()
    for v, t, c_id in latest:
        print(f"  {v}: {t}")

conn.close()
