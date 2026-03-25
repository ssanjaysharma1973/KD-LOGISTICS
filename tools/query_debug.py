import sqlite3
p='fleet_erp_backend_sqlite.db'
vehicle_id='DL1LX0851'
from_ts=None
to_ts=None
client_id='CLIENT_001'
conn=sqlite3.connect(p)
conn.row_factory=sqlite3.Row
cur=conn.cursor()
cols=[c[1] for c in cur.execute("PRAGMA table_info('gps_live_data')").fetchall()]
print('cols:',cols)
params=[]
where=[]
if vehicle_id:
    if 'device_number' in cols:
        where.append('(vehicle_number = ? OR device_number = ?)')
        params.extend([vehicle_id, vehicle_id])
    else:
        where.append('(vehicle_number = ?)')
        params.append(vehicle_id)
if client_id:
    where.append('client_id = ?')
    params.append(client_id)
if from_ts and to_ts:
    where.append('gps_time BETWEEN ? AND ?')
    params.extend([from_ts, to_ts])
elif from_ts:
    where.append('gps_time >= ?')
    params.append(from_ts)
elif to_ts:
    where.append('gps_time <= ?')
    params.append(to_ts)
base_q = 'SELECT vehicle_number, latitude AS lat, longitude AS lng, gps_time AS ts FROM gps_live_data'
q = base_q
if where:
    q += ' WHERE ' + ' AND '.join(where)
q += ' ORDER BY ts ASC LIMIT 10000'
print('SQL:',q)
print('params:',params)
try:
    rows = cur.execute(q, params).fetchall()
    print('rows_count:', len(rows))
    if rows:
        print('first:', rows[0]['lat'], rows[0]['lng'], rows[0]['ts'])
except Exception as e:
    print('EXCEPTION:', e)
finally:
    conn.close()
