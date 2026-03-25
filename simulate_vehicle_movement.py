#!/usr/bin/env python3
"""
Simulate realistic vehicle movement with accelerated time.
Inserts GPS points into the database at a faster-than-real time speed.

Usage:
    python simulate_vehicle_movement.py <vehicle_id> <speed_multiplier>
    
Example:
    python simulate_vehicle_movement.py HR69E4399 60  # 60x real-time speed
"""

import sqlite3
import sys
from datetime import datetime, timedelta
import math
import time

# Route coordinates (Delhi to Mumbai approximate path)
ROUTE_WAYPOINTS = [
    (28.7041, 77.1025),   # Delhi start
    (28.5355, 77.3910),   # South of Delhi
    (28.1694, 79.9864),   # Agra region
    (26.2389, 75.8659),   # Jaipur region
    (25.2048, 75.8670),   # Nearby Jaipur
    (24.8407, 75.0885),   # Towards Indore
    (23.1815, 79.9864),   # Jabalpur region
    (22.7196, 75.8577),   # Indore
    (21.1458, 79.0882),   # Nagpur region
    (20.5937, 78.9629),   # Central India
    (19.0760, 72.8777),   # Mumbai approach
    (19.0760, 72.8777),   # Mumbai end
]

def haversine_distance(lat1, lng1, lat2, lng2):
    """Calculate distance between two coordinates in km."""
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def interpolate_route(waypoints, points_per_segment=10):
    """Create smooth path with interpolated points."""
    points = []
    for i in range(len(waypoints) - 1):
        lat1, lng1 = waypoints[i]
        lat2, lng2 = waypoints[i + 1]
        
        # Generate intermediate points
        for j in range(points_per_segment):
            t = j / points_per_segment
            lat = lat1 + (lat2 - lat1) * t
            lng = lng1 + (lng2 - lng1) * t
            points.append((lat, lng))
    
    # Add final point
    points.append(waypoints[-1])
    return points

def simulate_movement(vehicle_id, speed_multiplier=60):
    """
    Simulate vehicle movement and insert into database.
    
    Args:
        vehicle_id: Vehicle ID to simulate
        speed_multiplier: How many times faster to run (60 = 1 hour per minute)
    """
    conn = None
    try:
        conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
        cursor = conn.cursor()
        
        print(f"[*] Starting vehicle simulation for {vehicle_id}")
        print(f"[*] Speed multiplier: {speed_multiplier}x (1 hour per {60/speed_multiplier:.1f} seconds)")
        
        # Generate interpolated route
        route = interpolate_route(ROUTE_WAYPOINTS, points_per_segment=20)
        print(f"[*] Route: {len(route)} GPS points from Delhi to Mumbai")
        
        # Start time: Now
        current_time = datetime.utcnow()
        print(f"[*] Start time: {current_time.isoformat()}")
        
        # Simulate movement every second
        avg_speed_kmh = 80  # Average vehicle speed
        total_distance = 0
        
        for idx, (lat, lng) in enumerate(route):
            # Insert GPS point
            ts = current_time.isoformat()
            try:
                cursor.execute('''
                    INSERT INTO gps_live_data (vehicle_number, latitude, longitude, gps_time, speed, client_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (vehicle_id, lat, lng, ts, 0, 'demo'))
            except sqlite3.Error as e:
                print(f"[WARN] Database error at point {idx}: {e}")
                continue
            
            # Calculate distance to next point
            seconds_to_next = 0
            if idx < len(route) - 1:
                lat_next, lng_next = route[idx + 1]
                distance = haversine_distance(lat, lng, lat_next, lng_next)
                total_distance += distance
                
                # Time to next point (at 80 km/h)
                hours_to_next = distance / avg_speed_kmh
                seconds_to_next = hours_to_next * 3600
                
                # Apply speed multiplier (compressed time)
                sleep_time = seconds_to_next / speed_multiplier
            else:
                sleep_time = 0
            
            # Print progress
            if idx % 10 == 0:
                distance_so_far = total_distance
                pct = (idx / len(route)) * 100
                print(f"[{pct:3.0f}%] Point {idx+1}/{len(route)}: ({lat:.4f}, {lng:.4f}) - {distance_so_far:.1f}km")
            
            # Update timestamp for next point
            if sleep_time > 0:
                current_time += timedelta(seconds=seconds_to_next)
                time.sleep(min(sleep_time, 0.5))  # Don't sleep too long in one chunk
        
        # Commit all changes
        conn.commit()
        print(f"\n[OK] Simulation complete!")
        print(f"[*] Total points inserted: {len(route)}")
        print(f"[*] Total distance simulated: {total_distance:.1f} km")
        print(f"[*] Simulated duration: ~{(len(route) * 80 / avg_speed_kmh):.0f} hours")
        print(f"    (at {speed_multiplier}x speed = {(len(route) * 80 / avg_speed_kmh / speed_multiplier):.1f} minutes real-time)")
        
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python simulate_vehicle_movement.py <vehicle_id> [speed_multiplier]")
        print("Example: python simulate_vehicle_movement.py DEMO_VEH_001 60")
        sys.exit(1)
    
    vehicle_id = sys.argv[1]
    speed_mult = int(sys.argv[2]) if len(sys.argv) > 2 else 60
    
    simulate_movement(vehicle_id, speed_mult)
