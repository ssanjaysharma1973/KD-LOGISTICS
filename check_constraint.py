import sqlite3

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
c = conn.cursor()

# Check schema
c.execute("PRAGMA table_info(gps_current)")
columns = c.fetchall()
print("gps_current columns:")
for col in columns:
    print(f"  {col}")

print("\n" + "="*60)

# Check for NULL client_id records
c.execute("SELECT vehicle_number, COUNT(*) as cnt FROM gps_current WHERE client_id IS NULL GROUP BY vehicle_number HAVING cnt > 1")
dups = c.fetchall()
print(f"\nVehicles with NULL client_id appearing multiple times: {len(dups)}")
if dups:
    for v, cnt in dups[:5]:
        print(f"  {v}: {cnt} records")

# Check total NULL records
c.execute("SELECT COUNT(*) FROM gps_current WHERE client_id IS NULL")
null_count = c.fetchone()[0]
print(f"\nTotal NULL client_id records: {null_count}")

# Check for duplicates with same vehicle and different client_id
c.execute("""
SELECT vehicle_number, client_id, COUNT(*) as cnt 
FROM gps_current 
GROUP BY vehicle_number, client_id 
HAVING cnt > 1 
LIMIT 10
""")
print("\nDuplicate (vehicle, client_id) combinations:")
for row in c.fetchall():
    print(f"  {row}")

conn.close()
