import sqlite3

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
cursor = conn.cursor()

# List all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("Tables:", [t[0] for t in cursor.fetchall()])

# Get schema for each table
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [t[0] for t in cursor.fetchall()]

for table in tables:
    cursor.execute(f"PRAGMA table_info({table})")
    columns = cursor.fetchall()
    print(f"\n{table} columns:")
    for col in columns:
        print(f"  {col}")

conn.close()
