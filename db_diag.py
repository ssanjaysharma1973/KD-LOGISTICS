import sqlite3, os, time
DB='fleet_erp_backend_sqlite.db'
print('DB path:', os.path.abspath(DB))
print('DB size bytes:', os.path.getsize(DB) if os.path.exists(DB) else 'MISSING')
if not os.path.exists(DB):
    raise SystemExit()
conn=sqlite3.connect(DB)
cur=conn.cursor()
for t in ['gps_live_data','gps_current','vehicles','pois']:
    try:
        t0=time.time()
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        c=cur.fetchone()[0]
        dt=time.time()-t0
        print(f"{t}: rows={c} (count time={dt:.3f}s)")
    except Exception as e:
        print(f"{t}: ERROR {e}")
# check indexes
try:
    cur.execute("PRAGMA index_list('gps_live_data')")
    print('gps_live_data indexes:', cur.fetchall())
    cur.execute("PRAGMA index_list('gps_current')")
    print('gps_current indexes:', cur.fetchall())
except Exception as e:
    print('PRAGMA error', e)
# time a heavier query
try:
    t0=time.time()
    cur.execute("SELECT vehicle_number, latitude, longitude, gps_time FROM gps_current ORDER BY gps_time DESC LIMIT 1000")
    rows=cur.fetchall()
    dt=time.time()-t0
    print(f"sample gps_current LIMIT 1000 time={dt:.3f}s rows={len(rows)}")
except Exception as e:
    print('sample query error', e)
conn.close()
