import sqlite3, pandas as pd
DB='fleet_erp_backend_sqlite.db'
conn=sqlite3.connect(DB)
try:
    df=pd.read_sql_query('SELECT vehicle_number, latitude, longitude, gps_time, client_id FROM gps_current ORDER BY gps_time DESC LIMIT 20', conn)
    print(df.to_string(index=False))
except Exception as e:
    print('ERROR',e)
finally:
    conn.close()
