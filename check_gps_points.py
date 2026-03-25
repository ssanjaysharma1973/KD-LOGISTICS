#!/usr/bin/env python3
"""
Check GPS points in database to understand data density and gaps.
"""
import sqlite3
import os
from datetime import datetime

DB_PATH = 'fleet_erp_backend_sqlite.db'

if not os.path.exists(DB_PATH):
    print(f"❌ Database not found: {DB_PATH}")
    exit(1)

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

print("=" * 80)
print("GPS DATA DENSITY ANALYSIS")
print("=" * 80)

# Check gps_live_data
try:
    cur.execute("SELECT COUNT(*) as cnt FROM gps_live_data")
    live_count = cur.fetchone()['cnt']
    print(f"\n📊 gps_live_data total points: {live_count}")
    
    if live_count > 0:
        cur.execute("SELECT MIN(gps_time) as min_ts, MAX(gps_time) as max_ts FROM gps_live_data")
        row = cur.fetchone()
        print(f"   Date range: {row['min_ts']} to {row['max_ts']}")
        
        cur.execute("SELECT DISTINCT vehicle_number FROM gps_live_data ORDER BY vehicle_number")
        vehicles = cur.fetchall()
        print(f"   Total vehicles: {len(vehicles)}")
        if len(vehicles) <= 10:
            for v in vehicles:
                cur.execute("SELECT COUNT(*) as cnt FROM gps_live_data WHERE vehicle_number = ?", (v['vehicle_number'],))
                v_count = cur.fetchone()['cnt']
                print(f"     - {v['vehicle_number']}: {v_count} points")
except Exception as e:
    print(f"❌ Error reading gps_live_data: {e}")

# Check gps_current
try:
    cur.execute("SELECT COUNT(*) as cnt FROM gps_current")
    current_count = cur.fetchone()['cnt']
    print(f"\n📊 gps_current total points: {current_count}")
    
    if current_count > 0:
        cur.execute("SELECT MIN(gps_time) as min_ts, MAX(gps_time) as max_ts FROM gps_current")
        row = cur.fetchone()
        print(f"   Date range: {row['min_ts']} to {row['max_ts']}")
        
        cur.execute("SELECT DISTINCT vehicle_number FROM gps_current ORDER BY vehicle_number")
        vehicles = cur.fetchall()
        print(f"   Total vehicles: {len(vehicles)}")
except Exception as e:
    print(f"❌ Error reading gps_current: {e}")

# Check time gaps for a specific vehicle
print("\n" + "=" * 80)
print("TIME GAPS ANALYSIS (Sample Vehicle)")
print("=" * 80)

try:
    # Get a vehicle with data
    cur.execute("SELECT DISTINCT vehicle_number FROM gps_live_data LIMIT 1")
    result = cur.fetchone()
    if result:
        vehicle = result['vehicle_number']
        print(f"\nAnalyzing: {vehicle}")
        
        cur.execute("""
            SELECT latitude, longitude, gps_time 
            FROM gps_live_data 
            WHERE vehicle_number = ? 
            ORDER BY gps_time DESC 
            LIMIT 50
        """, (vehicle,))
        
        points = cur.fetchall()
        print(f"Last 50 points for {vehicle}:")
        
        prev_time = None
        gaps = []
        for i, p in enumerate(points):
            try:
                curr_time = datetime.fromisoformat(p['gps_time'].replace('Z', '+00:00'))
                if prev_time:
                    gap_seconds = (prev_time - curr_time).total_seconds()
                    gaps.append(gap_seconds)
                    if gap_seconds > 600:  # More than 10 minutes
                        print(f"  ⚠️  Gap: {gap_seconds / 60:.1f} min between points {i} and {i-1}")
                prev_time = curr_time
            except Exception:
                pass
        
        if gaps:
            avg_gap = sum(gaps) / len(gaps)
            min_gap = min(gaps)
            max_gap = max(gaps)
            print(f"\n  📈 Average gap: {avg_gap:.0f}s ({avg_gap / 60:.1f} min)")
            print(f"  📉 Min gap: {min_gap:.0f}s")
            print(f"  📈 Max gap: {max_gap:.0f}s ({max_gap / 60:.1f} min)")
except Exception as e:
    print(f"❌ Error analyzing gaps: {e}")

# Check for specific vehicle HR69E4399 mentioned in screenshot
print("\n" + "=" * 80)
print("HR69E4399 (From Screenshot)")
print("=" * 80)

try:
    vehicle = 'HR69E4399'
    
    cur.execute("SELECT COUNT(*) as cnt FROM gps_live_data WHERE vehicle_number = ?", (vehicle,))
    count = cur.fetchone()['cnt']
    print(f"\n📊 {vehicle} in gps_live_data: {count} points")
    
    if count > 0:
        cur.execute("""
            SELECT latitude, longitude, gps_time 
            FROM gps_live_data 
            WHERE vehicle_number = ? 
            ORDER BY gps_time ASC 
            LIMIT 10
        """, (vehicle,))
        points = cur.fetchall()
        print(f"   First 10 points:")
        for i, p in enumerate(points, 1):
            print(f"   {i}. ({p['latitude']:.4f}, {p['longitude']:.4f}) - {p['gps_time']}")
except Exception as e:
    print(f"❌ Error: {e}")

conn.close()

print("\n" + "=" * 80)
print("💡 RECOMMENDATIONS:")
print("=" * 80)
print("""
1. If gaps > 10 minutes: GPS data is sparse, need more frequent updates
2. If points < 100: Limited historical data being stored
3. If date range is small: Only recent data is available
4. Solution: Increase GPS sync frequency or adjust database retention

Check run_sync_worker.bat or streamlit_app.py for sync interval settings.
""")
