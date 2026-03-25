import sqlite3
from streamlit_app import _read_env_var, sync_geolocation

DB='fleet_erp_backend_sqlite.db'
# target client id - prefer env CLIENT1_ID else default to CLIENT_001
target = _read_env_var('CLIENT1_ID') or 'CLIENT_001'
print('Target client id:', target)
conn = sqlite3.connect(DB)
cur = conn.cursor()
# count current NULL/empty client_id rows
cur.execute("SELECT COUNT(*) FROM gps_live_data WHERE client_id IS NULL OR client_id = ''")
before = cur.fetchone()[0]
print('Rows with NULL/empty client_id before:', before)
if before == 0:
    print('No rows to update.')
else:
    # perform update
    cur.execute("UPDATE gps_live_data SET client_id = ? WHERE client_id IS NULL OR client_id = ''", (target,))
    conn.commit()
    cur.execute("SELECT COUNT(*) FROM gps_live_data WHERE client_id = ?", (target,))
    now = cur.fetchone()[0]
    print('Rows for target client after update:', now)

conn.close()
print('Recomputing gps_current...')
try:
    n = sync_geolocation()
    print('Processed rows into gps_current:', n)
except Exception as e:
    print('sync_geolocation error:', e)
