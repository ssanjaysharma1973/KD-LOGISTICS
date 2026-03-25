import sqlite3

DB='fleet_erp_backend_sqlite.db'
conn=sqlite3.connect(DB)
cur=conn.cursor()
for t in ('gps_live_data','gps_current'):
    try:
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        cnt=cur.fetchone()[0]
        cur.execute(f"SELECT MAX(gps_time) FROM {t}")
        mx=cur.fetchone()[0]
        print(f"{t}: count={cnt}  max_gps_time={mx}")
    except Exception as e:
        print(f"{t}: ERROR: {e}")
conn.close()
