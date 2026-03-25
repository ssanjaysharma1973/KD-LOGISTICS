import sqlite3

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
c = conn.cursor()

# Delete all but the latest record for each vehicle with NULL client_id
c.execute("""
DELETE FROM gps_current
WHERE client_id IS NULL
  AND rowid NOT IN (
    SELECT MAX(rowid)
    FROM gps_current
    WHERE client_id IS NULL
    GROUP BY vehicle_number
  )
""")
deleted = c.rowcount
conn.commit()

print(f"Deleted {deleted} old duplicate records")

# Now tag remaining NULL records with CLIENT_001
c.execute("UPDATE gps_current SET client_id='CLIENT_001' WHERE client_id IS NULL")
updated = c.rowcount
conn.commit()

# Verify
c.execute("SELECT COUNT(*) FROM gps_current WHERE client_id='CLIENT_001'")
total = c.fetchone()[0]

c.execute("SELECT COUNT(*) FROM gps_current")
total_records = c.fetchone()[0]

conn.close()

print(f"✅ Tagged {updated} records with CLIENT_001")
print(f"✅ Total CLIENT_001 records: {total}")
print(f"✅ Total gps_current records: {total_records}")
