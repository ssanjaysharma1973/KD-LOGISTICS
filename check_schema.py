import sqlite3

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
cursor = conn.cursor()

# Get table schema
cursor.execute("PRAGMA table_info(gps_live_data)")
cols = cursor.fetchall()

print("gps_live_data columns:")
for col in cols:
    print(f"  {col[1]}: {col[2]}")

# Also check gps_current
cursor.execute("PRAGMA table_info(gps_current)")
cols = cursor.fetchall()

print("\ngps_current columns:")
for col in cols:
    print(f"  {col[1]}: {col[2]}")

conn.close()
