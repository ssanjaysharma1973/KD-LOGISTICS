import sqlite3
p='fleet_erp_backend_sqlite.db'
conn=sqlite3.connect(p)
cur=conn.cursor()
try:
    cnt=cur.execute('SELECT COUNT(*) FROM gps_live_data WHERE vehicle_number=? AND client_id=?',('DL1LX0851','CLIENT_001')).fetchone()[0]
    print('COUNT:',cnt)
    sample=cur.execute('SELECT latitude,longitude,gps_time,client_id FROM gps_live_data WHERE vehicle_number=? AND client_id=? ORDER BY gps_time DESC LIMIT 5',('DL1LX0851','CLIENT_001')).fetchall()
    for r in sample:
        print(r)
finally:
    conn.close()
