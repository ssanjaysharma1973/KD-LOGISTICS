import sqlite3
import pandas as pd
from datetime import datetime

DB='fleet_erp_backend_sqlite.db'
conn=sqlite3.connect(DB)
now = datetime.now()

print('Now:', now.isoformat())

for t in ('gps_live_data','gps_current'):
    try:
        df = pd.read_sql_query(f"SELECT id, vehicle_number, gps_time, client_id FROM {t} LIMIT 100000", conn)
        if df.empty:
            print(f'{t}: no rows')
            continue
        # try parse gps_time robustly
        df['parsed'] = pd.to_datetime(df['gps_time'], errors='coerce')
        future = df[df['parsed'] > pd.Timestamp(now)]
        print(f"{t}: total={len(df)}, future_count={len(future)}")
        if not future.empty:
            print('Sample future rows:')
            print(future[['id','vehicle_number','gps_time','client_id']].head(10).to_string(index=False))
    except Exception as e:
        print(f'{t}: error {e}')

conn.close()
