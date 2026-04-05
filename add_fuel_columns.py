#!/usr/bin/env python3
"""
Add fuel columns to munshi_trips table
SQLite doesn't support IF NOT EXISTS in ALTER TABLE, so check first
"""
import sqlite3
import sys

db_path = './fleet_erp_backend_sqlite.db'

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get existing columns
    cursor.execute("PRAGMA table_info(munshi_trips)")
    existing_cols = {row[1] for row in cursor.fetchall()}
    
    fuel_cols = [
        'fuel_mode',
        'fuel_payment_responsibility',
        'expected_km',
        'expected_kmpl',
        'expected_fuel_ltr',
        'fuel_limit_amount',
        'fuel_limit_ltr',
        'total_fuel_issued',
        'total_fuel_used',
        'fuel_variance',
        'fuel_approval_status',
        'loaded_km',
        'empty_km'
    ]
    
    col_definitions = {
        'fuel_mode': "TEXT DEFAULT 'driver_advance'",
        'fuel_payment_responsibility': "TEXT DEFAULT 'company'",
        'expected_km': "REAL",
        'expected_kmpl': "REAL",
        'expected_fuel_ltr': "REAL",
        'fuel_limit_amount': "REAL",
        'fuel_limit_ltr': "REAL",
        'total_fuel_issued': "REAL DEFAULT 0",
        'total_fuel_used': "REAL DEFAULT 0",
        'fuel_variance': "REAL",
        'fuel_approval_status': "TEXT DEFAULT 'pending'",
        'loaded_km': "REAL",
        'empty_km': "REAL"
    }
    
    added = []
    skipped = []
    
    for col in fuel_cols:
        if col not in existing_cols:
            sql = f"ALTER TABLE munshi_trips ADD COLUMN {col} {col_definitions[col]}"
            cursor.execute(sql)
            added.append(col)
            print(f"✓ Added column: {col}")
        else:
            skipped.append(col)
            print(f"⊘ Column exists: {col}")
    
    conn.commit()
    conn.close()
    
    print(f"\nSummary: Added {len(added)}, Skipped {len(skipped)}")
    if added:
        print(f"Added: {', '.join(added)}")
    
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
