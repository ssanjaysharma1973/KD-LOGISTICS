import sqlite3
from datetime import datetime
from streamlit_app import sync_geolocation

DB='fleet_erp_backend_sqlite.db'
now = datetime.now().replace(microsecond=0)
now_iso = now.isoformat()
print('Now (to use for clamping):', now_iso)
conn = sqlite3.connect(DB)
cur = conn.cursor()
# Find rows with gps_time > now (string compare works for ISO-like timestamps)
cur.execute("SELECT id, vehicle_number, gps_time FROM gps_live_data WHERE gps_time > ? LIMIT 1000", (now_iso,))
sample = cur.fetchall()
print('Sample future rows (up to 1000):', len(sample))
for r in sample[:10]:
    print(r)
# Count total future rows
cur.execute("SELECT COUNT(*) FROM gps_live_data WHERE gps_time > ?", (now_iso,))
count = cur.fetchone()[0]
print('Total future-row count:', count)
if count == 0:
    print('No future rows to update.')
else:
    # Update in batches
    batch = 10000
    updated = 0
    while True:
        cur.execute("SELECT id FROM gps_live_data WHERE gps_time > ? LIMIT ?", (now_iso, batch))
        ids = [r[0] for r in cur.fetchall()]
        if not ids:
            break
        q = "UPDATE gps_live_data SET gps_time = ? WHERE id IN ({})".format(','.join(['?']*len(ids)))
        params = [now_iso] + ids
        cur.execute(q, params)
        conn.commit()
        updated += len(ids)
        print('Updated batch:', updated)
    print('Total updated rows:', updated)

conn.close()
print('Recomputing gps_current...')
try:
    n = sync_geolocation()
    print('Processed rows into gps_current:', n)
except Exception as e:
    print('sync_geolocation error:', e)
