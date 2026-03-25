#!/usr/bin/env python
"""Direct test of WHEELSEYE API and sync process for debugging"""
import requests
import json
from datetime import datetime
import sqlite3

API_URL = "https://api.wheelseye.com/currentLoc?accessToken=1851c6a3-ef52-4ec3-b470-759908fa0408"

print(f"\n{'='*60}")
print(f"Testing WHEELSEYE API - {datetime.now()}")
print(f"{'='*60}")
print(f"API URL: {API_URL}\n")

try:
    print("[1] Fetching data from WHEELSEYE API...")
    resp = requests.get(API_URL, timeout=10)
    print(f"    Status: {resp.status_code}")
    print(f"    Content-Type: {resp.headers.get('content-type', 'N/A')}")
    
    if resp.status_code == 200:
        data = resp.json()
        print(f"    Response type: {type(data).__name__}")
        
        # Inspect structure
        if isinstance(data, dict):
            print(f"    Top-level keys: {list(data.keys())}")
            # Look for data array
            rows = None
            if 'list' in data:
                rows = data['list']
            elif 'data' in data and isinstance(data['data'], dict) and 'list' in data['data']:
                rows = data['data']['list']
            elif 'rows' in data:
                rows = data['rows']
            else:
                for k, v in list(data.items())[:3]:
                    print(f"      {k}: {type(v).__name__} {len(v) if isinstance(v, (list, dict)) else ''}")
            
            if rows:
                print(f"    Data records: {len(rows)}")
                if rows:
                    first = rows[0]
                    print(f"    First record keys: {list(first.keys()) if isinstance(first, dict) else 'N/A'}")
                    print(f"    Sample record: {json.dumps(first, indent=6, default=str)[:500]}")
        elif isinstance(data, list):
            print(f"    Records: {len(data)}")
            if data:
                print(f"    First record: {json.dumps(data[0], indent=6, default=str)[:500]}")
    else:
        print(f"    ERROR: {resp.text[:200]}")
        
except Exception as e:
    print(f"    FAILED: {type(e).__name__}: {e}")

print(f"\n[2] Checking Database State...")
try:
    conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM gps_live_data")
    live_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM gps_current")
    current_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT MAX(gps_time) FROM gps_live_data")
    max_live_time = cursor.fetchone()[0]
    
    cursor.execute("SELECT MAX(gps_time) FROM gps_current")
    max_current_time = cursor.fetchone()[0]
    
    print(f"    gps_live_data: {live_count:,} rows, latest: {max_live_time}")
    print(f"    gps_current: {current_count:,} rows, latest: {max_current_time}")
    
    cursor.execute("SELECT COUNT(*) FROM gps_current WHERE client_id IS NOT NULL")
    tagged = cursor.fetchone()[0]
    print(f"    Tagged rows: {tagged}/{current_count}")
    
    conn.close()
except Exception as e:
    print(f"    FAILED: {type(e).__name__}: {e}")

print(f"\n[3] Testing Environment Config...")
import os
print(f"    CLIENT1_ID: {os.environ.get('CLIENT1_ID', 'NOT SET')}")
print(f"    CLIENT1_PROVIDER: {os.environ.get('CLIENT1_PROVIDER', 'NOT SET')[:50]}...")
print(f"    CLIENTS_CONFIG: {os.environ.get('CLIENTS_CONFIG', 'NOT SET')[:50]}...")

print(f"\n{'='*60}\n")
