import sqlite3
db = sqlite3.connect(r'C:\Users\koyna\Documents\KD-LOGISTICS\backend\fleet_erp_backend_sqlite.db')
cursor = db.cursor()

print('=== MUNSHIS TABLE SCHEMA ===')
cursor.execute('PRAGMA table_info(munshis)')
cols = [row[1] for row in cursor.fetchall()]
for col in cols:
    print(f'  {col}')

print('\nChecking for role column...')
if 'role' not in cols:
    print('❌ role column missing - adding it...')
    try:
        cursor.execute('ALTER TABLE munshis ADD COLUMN role TEXT DEFAULT "munshi"')
        db.commit()
        print('✅ Added role column')
    except Exception as e:
        print(f'Error: {e}')

db.close()
