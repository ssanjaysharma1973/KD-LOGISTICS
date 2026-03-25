import sqlite3
db = sqlite3.connect('fleet_erp_backend_sqlite.db')
db.row_factory = sqlite3.Row

# Check client_id for HR69G4183 in gps_live_data
rows = db.execute('SELECT DISTINCT client_id FROM gps_live_data WHERE vehicle_number = ?', ('HR69G4183',)).fetchall()
print(f'Client IDs for HR69G4183 in gps_live_data: {[r[0] for r in rows]}')

# Get a sample row
sample = db.execute('SELECT * FROM gps_live_data WHERE vehicle_number = ? LIMIT 1', ('HR69G4183',)).fetchone()
if sample:
    print(f'\nSample row from gps_live_data:')
    for key in sample.keys():
        print(f'  {key}: {sample[key]}')

# Check if CLIENT_001 filter is the issue
with_client = db.execute('SELECT COUNT(*) FROM gps_live_data WHERE vehicle_number = ? AND client_id = ?', ('HR69G4183', 'CLIENT_001')).fetchone()
print(f'\nRows with CLIENT_001: {with_client[0]}')

without_client = db.execute('SELECT COUNT(*) FROM gps_live_data WHERE vehicle_number = ?', ('HR69G4183',)).fetchone()
print(f'Rows without client filter: {without_client[0]}')

db.close()
