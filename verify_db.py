import sqlite3

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
c = conn.cursor()

c.execute('SELECT COUNT(*) FROM gps_current')
total = c.fetchone()[0]

c.execute("SELECT COUNT(*) FROM gps_current WHERE client_id='CLIENT_001'")
client_count = c.fetchone()[0]

c.execute('SELECT COUNT(*) FROM gps_current WHERE client_id IS NULL')
null_count = c.fetchone()[0]

c.execute('SELECT COUNT(*) FROM gps_live_data')
history = c.fetchone()[0]

conn.close()

print('📊 Database Status:')
print(f'  gps_current total: {total}')
print(f'  gps_current CLIENT_001: {client_count}')
print(f'  gps_current NULL: {null_count}')
print(f'  gps_live_data history: {history:,}')
