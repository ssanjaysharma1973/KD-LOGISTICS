#!/usr/bin/env python
import sqlite3

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
cur = conn.cursor()

# Check gps_current schema
cur.execute("PRAGMA table_info(gps_current)")
cols = cur.fetchall()
print("gps_current columns:")
for col in cols:
    print(f"  {col[1]} ({col[2]})")

# Check if vehicle_number is primary key
cur.execute("PRAGMA table_info(gps_current)")
cols = cur.fetchall()
has_pk = any(c[5] > 0 for c in cols)  # col[5] is pk
print(f"\nHas primary key: {has_pk}")
for col in cols:
    if col[5] > 0:
        print(f"  Primary key: {col[1]}")

# Clear gps_current so sync can repopulate with fresh data
print("\nClearing gps_current...")
cur.execute("DELETE FROM gps_current")
conn.commit()
print(f"Deleted all rows from gps_current")

conn.close()
