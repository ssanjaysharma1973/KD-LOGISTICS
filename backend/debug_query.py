import sqlite3
db = sqlite3.connect(r'C:\Users\koyna\Documents\KD-LOGISTICS\backend\fleet_erp_backend_sqlite.db')
db.row_factory = sqlite3.Row
cursor = db.cursor()

# Test the exact query from the backend
username = 'devadmin'
pin = '001999'

print(f'Testing query with username="{username}", pin="{pin}"')

cursor.execute('''
    SELECT id, username, name, admin_type, status, client_id
    FROM admins
    WHERE username = ? AND pin = ? AND status = 'active'
''', (username, pin))

admin = cursor.fetchone()

if admin:
    print('✅ Match found!')
    print(f'ID: {admin["id"]}')
    print(f'Name: {admin["name"]}')
    print(f'Role: {admin["admin_type"]}')
else:
    print('❌ No match found')
    
    # Debug: check each condition separately
    print('\n--- DEBUG: Testing conditions separately ---')
    
    cursor.execute('SELECT id FROM admins WHERE username = ?', (username,))
    print(f'Username match: {cursor.fetchone()}')
    
    cursor.execute('SELECT id FROM admins WHERE username = ? AND pin = ?', (username, pin))
    print(f'Username + PIN match: {cursor.fetchone()}')
    
    cursor.execute('SELECT id FROM admins WHERE status = ?', ('active',))
    print(f'Status = active: {cursor.fetchone()}')
    
    # Get the actual values for this user
    cursor.execute('SELECT pin, status FROM admins WHERE username = ?', (username,))
    row = cursor.fetchone()
    if row:
        print(f'\nActual values for devadmin:')
        print(f'  pin: "{row["pin"]}" (repr: {repr(row["pin"])})')
        print(f'  status: "{row["status"]}" (repr: {repr(row["status"])})')

db.close()
