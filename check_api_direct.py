import requests
from datetime import datetime

url = "https://api.wheelseye.com/currentLoc?accessToken=1851c6a3-ef52-4ec3-b470-759908fa0408"

try:
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    data = response.json()
    
    if isinstance(data, list):
        print(f"✅ API returned {len(data)} records\n")
        
        # Check timestamps
        timestamps = set()
        for record in data[:5]:
            if 'gps_time' in record:
                timestamps.add(record['gps_time'])
                print(f"   {record.get('vehicle_number', '?')}: {record['gps_time']}")
        
        # Check all unique timestamps
        all_timestamps = set([r.get('gps_time') for r in data if 'gps_time' in r])
        print(f"\n📅 Unique timestamps in API response: {len(all_timestamps)}")
        for ts in sorted(all_timestamps)[-5:]:
            print(f"   {ts}")
    else:
        print("Response:", data)
        
except requests.exceptions.RequestException as e:
    print(f"❌ API Error: {e}")
