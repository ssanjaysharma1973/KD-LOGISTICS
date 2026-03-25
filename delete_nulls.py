import sqlite3

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
c = conn.cursor()

# Find vehicles that have BOTH NULL and CLIENT_001 records
c.execute("""
SELECT vehicle_number
FROM gps_current
GROUP BY vehicle_number
HAVING COUNT(DISTINCT client_id) > 1
""")
conflict_vehicles = [row[0] for row in c.fetchall()]

print(f"Vehicles with mixed client_id values: {len(conflict_vehicles)}")
for v in conflict_vehicles[:10]:
    c.execute("SELECT client_id, COUNT(*) FROM gps_current WHERE vehicle_number=? GROUP BY client_id", (v,))
    print(f"  {v}: {c.fetchall()}")

# Strategy: Delete all NULL records, keep only CLIENT_001
print("\nDeleting all NULL client_id records...")
c.execute("DELETE FROM gps_current WHERE client_id IS NULL")
deleted = c.rowcount
conn.commit()

# Verify no more NULL
c.execute("SELECT COUNT(*) FROM gps_current WHERE client_id IS NULL")
null_count = c.fetchone()[0]

# Verify total
c.execute("SELECT COUNT(*) FROM gps_current")
total = c.fetchone()[0]

conn.close()

print(f"✅ Deleted {deleted} NULL records")
print(f"✅ Remaining NULL records: {null_count}")
print(f"✅ Total gps_current records: {total}")
