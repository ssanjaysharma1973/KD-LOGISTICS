#!/usr/bin/env python
import sqlite3

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
cur = conn.cursor()

# Get all tables
cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cur.fetchall()

print('Tables in database:')
for t in tables:
    table_name = t[0]
    cur.execute(f"SELECT COUNT(*), MAX(gps_time) FROM {table_name}")
    try:
        count, max_time = cur.fetchone()
        print(f"  {table_name}: {count} rows, Latest gps_time: {max_time}")
    except:
        print(f"  {table_name}: (no gps_time column)")

conn.close()
