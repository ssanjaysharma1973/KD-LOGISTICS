import sqlite3
import requests
import os
from datetime import datetime, timezone

# Configuration
API_URL = "https://api.wheelseye.com/currentLoc"
# Best practice: use os.getenv("WHEELSEYE_TOKEN") 
TOKEN = "1851c6a3-ef52-4ec3-b470-759908fa0408" 
DB_NAME = 'fleet_erp_backend_sqlite.db'

def fetch_records():
    try:
        response = requests.get(API_URL, params={"accessToken": TOKEN}, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        # Flattening logic
        if isinstance(data.get('data'), dict):
            return data['data'].get('list', [])
        if isinstance(data.get('data'), list):
            return data['data']
        return data.get('list') or data.get('vehicles') or []
    except Exception as e:
        print(f"❌ API Error: {e}")
        return []

def update_gps_data():
    records = fetch_records()
    if not records:
        print("❌ No records to process.")
        return

    to_insert = []
    for record in records:
        try:
            vehicle = record.get('vehicleNumber')
            lat = record.get('latitude')
            lng = record.get('longitude')
            epoch = record.get('createdDate')

            # Ensure data validity
            if vehicle and lat is not None and lng is not None:
                if epoch:
                    # Modern UTC conversion
                    gps_time = datetime.fromtimestamp(epoch, timezone.utc).isoformat().replace('+00:00', 'Z')
                else:
                    gps_time = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
                
                to_insert.append((vehicle, float(lat), float(lng), gps_time, 'CLIENT_001'))
        except (ValueError, TypeError) as e:
            continue

    if to_insert:
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            # Clear old data
            cursor.execute("DELETE FROM gps_current")
            # Batch insert
            cursor.executemany("""
                INSERT INTO gps_current (vehicle_number, latitude, longitude, gps_time, client_id)
                VALUES (?, ?, ?, ?, ?)
            """, to_insert)
            conn.commit()
            print(f"✅ Successfully updated {len(to_insert)} vehicles.")

if __name__ == "__main__":
    update_gps_data()