import sqlite3
db = sqlite3.connect(r'C:\Users\koyna\Documents\KD-LOGISTICS\backend\fleet_erp_backend_sqlite.db')
db.row_factory = sqlite3.Row
cursor = db.cursor()

# Get the exact row
cursor.execute('SELECT id, username, pin, name, admin_type, status, client_id FROM admins WHERE username = ?', ('devadmin',))
row = cursor.fetchone()

if row:
    print('Found devadmin:')
    for key in row.keys():
        val = row[key]
        print(f'  {key}: "{val}" (type: {type(val).__name__}, len: {len(str(val)) if val else 0})')
else:
    print('Devadmin not found!')

# List all admins
print('\nAll admins:')
cursor.execute('SELECT username, pin, status FROM admins')
for row in cursor.fetchall():
    print(f'  {row["username"]}: pin={row["pin"]}, status={row["status"]}')

db.close()
