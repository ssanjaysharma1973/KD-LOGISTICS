#!/usr/bin/env python
import sqlite3

conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
cursor = conn.cursor()

# Check drivers table schema
cursor.execute("PRAGMA table_info(drivers)")
columns = cursor.fetchall()
print("Drivers table columns:")
for col in columns:
    print(f"  {col[1]} ({col[2]})")

print("\n")

# Check vehicles table schema
cursor.execute("PRAGMA table_info(vehicles)")
columns = cursor.fetchall()
print("Vehicles table columns:")
for col in columns:
    print(f"  {col[1]} ({col[2]})")

print("\n")

# Check munshi_trips table schema  
cursor.execute("PRAGMA table_info(munshi_trips)")
columns = cursor.fetchall()
print("Munshi_trips table columns:")
for col in columns:
    print(f"  {col[1]} ({col[2]})")

conn.close()
