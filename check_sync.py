import sqlite3
from pathlib import Path
import pandas as pd
DB = 'fleet_erp_backend_sqlite.db'
if not Path(DB).exists():
    print('DB not found:', DB)
    raise SystemExit(1)
conn = sqlite3.connect(DB)
cur = conn.cursor()

def safe_scalar(q, params=()):
    try:
        cur.execute(q, params)
        r = cur.fetchone()
        return r[0] if r else None
    except Exception as e:
        return f'ERR: {e}'

print('Database:', DB)
print('gps_live_data count:', safe_scalar('SELECT COUNT(*) FROM gps_live_data'))
print('gps_current count:', safe_scalar('SELECT COUNT(*) FROM gps_current'))
print('gps_live_data recent (5):')
try:
    df = pd.read_sql_query('SELECT id, vehicle_number, latitude, longitude, gps_time, client_id FROM gps_live_data ORDER BY gps_time DESC LIMIT 5', conn)
    print(df.to_string(index=False))
except Exception as e:
    print('  error reading gps_live_data:', e)

print('\n gps_current recent (10):')
try:
    df2 = pd.read_sql_query('SELECT vehicle_number, latitude, longitude, gps_time, client_id FROM gps_current ORDER BY gps_time DESC LIMIT 10', conn)
    print(df2.to_string(index=False))
except Exception as e:
    print('  error reading gps_current:', e)

print('\nPOIs with linked_vehicle:')
try:
    p = pd.read_sql_query("SELECT id, client_id, poi_name, linked_vehicle, linked_distance_m FROM pois ORDER BY id DESC LIMIT 20", conn)
    print(p.to_string(index=False))
except Exception as e:
    print('  error reading pois:', e)

# counts by client
print('\nCounts by client (gps_current):')
try:
    cc = pd.read_sql_query('SELECT client_id, COUNT(*) as cnt FROM gps_current GROUP BY client_id', conn)
    print(cc.to_string(index=False))
except Exception as e:
    print('  error grouping by client:', e)

conn.close()
