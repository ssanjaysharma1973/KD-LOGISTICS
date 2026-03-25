import sqlite3
import pandas as pd
DB='fleet_erp_backend_sqlite.db'
conn=sqlite3.connect(DB)
cur=conn.cursor()
print('Counts by table and latest gps_time:')
for t in ('gps_live_data','gps_current'):
    try:
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        cnt=cur.fetchone()[0]
        cur.execute(f"SELECT MAX(gps_time) FROM {t}")
        mx=cur.fetchone()[0]
        print(f"{t}: count={cnt}  max_gps_time={mx}")
    except Exception as e:
        print(f"{t}: ERROR: {e}")

print('\nCounts by client_id in gps_live_data:')
try:
    df = pd.read_sql_query('SELECT client_id, COUNT(*) as cnt, MAX(gps_time) as max_time FROM gps_live_data GROUP BY client_id ORDER BY cnt DESC', conn)
    if df.empty:
        print('No rows')
    else:
        print(df.to_string(index=False))
except Exception as e:
    print('Error grouping gps_live_data:', e)

print('\nTop 10 rows from gps_current:')
try:
    df2 = pd.read_sql_query('SELECT vehicle_number, latitude, longitude, gps_time, client_id FROM gps_current ORDER BY gps_time DESC LIMIT 10', conn)
    if df2.empty:
        print('No rows')
    else:
        print(df2.to_string(index=False))
except Exception as e:
    print('Error reading gps_current:', e)

conn.close()
