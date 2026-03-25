import sqlite3
from streamlit_app import _read_env_var, sync_geolocation

DB='fleet_erp_backend_sqlite.db'
# target client id - prefer env CLIENT1_ID else default to CLIENT_001
target = _read_env_var('CLIENT1_ID') or 'CLIENT_001'
print('Reverting client id for target:', target)
conn = sqlite3.connect(DB)
cur = conn.cursor()
# count rows currently matching target
cur.execute("SELECT COUNT(*) FROM gps_live_data WHERE client_id = ?", (target,))
match_before = cur.fetchone()[0]
print('Rows currently with target client_id before revert:', match_before)
if match_before == 0:
    print('No rows to revert.')
else:
    # set client_id to NULL for those rows
    cur.execute("UPDATE gps_live_data SET client_id = NULL WHERE client_id = ?", (target,))
    conn.commit()
    cur.execute("SELECT COUNT(*) FROM gps_live_data WHERE client_id IS NULL")
    null_after = cur.fetchone()[0]
    print('Rows with NULL client_id after revert:', null_after)

conn.close()
print('Recomputing gps_current...')
try:
    n = sync_geolocation()
    print('Processed rows into gps_current:', n)
except Exception as e:
    print('sync_geolocation error:', e)
