import sqlite3
from datetime import datetime, timedelta
from streamlit_app import _read_env_var, sync_geolocation

DB='fleet_erp_backend_sqlite.db'
# parameters
n_days = 90
cutoff_dt = datetime.now() - timedelta(days=n_days)
cutoff_iso = cutoff_dt.strftime('%Y-%m-%dT%H:%M:%S')
# target client id - prefer env CLIENT1_ID else default
target = _read_env_var('CLIENT1_ID') or 'CLIENT_001'
print(f'Tagging rows since {cutoff_iso} to {target} (last {n_days} days)')
conn = sqlite3.connect(DB)
cur = conn.cursor()
# count matching rows
cur.execute("SELECT COUNT(*) FROM gps_live_data WHERE (client_id IS NULL OR client_id = '') AND gps_time >= ?", (cutoff_iso,))
match_before = cur.fetchone()[0]
print('Rows to tag:', match_before)
if match_before == 0:
    print('No rows matched the cutoff; no changes made.')
else:
    cur.execute("UPDATE gps_live_data SET client_id = ? WHERE (client_id IS NULL OR client_id = '') AND gps_time >= ?", (target, cutoff_iso))
    conn.commit()
    cur.execute("SELECT COUNT(*) FROM gps_live_data WHERE client_id = ?", (target,))
    now_total = cur.fetchone()[0]
    print('Total rows now for target client:', now_total)

conn.close()
print('Recomputing gps_current...')
try:
    n = sync_geolocation()
    print('Processed rows into gps_current:', n)
except Exception as e:
    print('sync_geolocation error:', e)
