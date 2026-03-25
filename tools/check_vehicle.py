import sqlite3

DB = 'fleet_erp_backend_sqlite.db'
VEHICLE = 'HR69E8323'

conn = sqlite3.connect(DB, timeout=10)
cur = conn.cursor()
rows = cur.execute(
    'SELECT vehicle_number, client_id, gps_time FROM gps_current WHERE vehicle_number = ?',
    (VEHICLE,)
).fetchall()
print(rows)
conn.close()
