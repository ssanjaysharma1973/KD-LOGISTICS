import sqlite3
conn = sqlite3.connect('backend/fleet_erp_backend_sqlite.db')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:")
for t in cursor.fetchall():
    print(f"  - {t[0]}")
conn.close()
