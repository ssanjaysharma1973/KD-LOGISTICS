import sqlite3

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
cursor = conn.cursor()

# Get all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()

print("=== Database Tables ===")
for table in tables:
    print(f"\n{table[0]}:")
    cursor.execute(f"PRAGMA table_info({table[0]})")
    columns = cursor.fetchall()
    for col in columns:
        print(f"  {col[1]:20} {col[2]:15}")

# Check vehicles table
print("\n=== Sample Vehicles ===")
cursor.execute("SELECT id, vehicle_number, registration, model, client_id FROM vehicles LIMIT 5")
for row in cursor.fetchall():
    print(row)

conn.close()
