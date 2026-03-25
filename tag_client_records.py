import sqlite3

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
c = conn.cursor()

# Tag all untagged records with CLIENT_001
c.execute("UPDATE gps_current SET client_id='CLIENT_001' WHERE client_id IS NULL")
updated = c.rowcount
conn.commit()

# Verify total
c.execute("SELECT COUNT(*) FROM gps_current WHERE client_id='CLIENT_001'")
total = c.fetchone()[0]
conn.close()

print(f'✅ Updated {updated} untagged records')
print(f'✅ Total CLIENT_001 records now: {total}')
