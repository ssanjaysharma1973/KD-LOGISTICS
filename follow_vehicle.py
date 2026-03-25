"""follow_vehicle.py
Polls the local SQLite DB every N seconds and prints new gps_live_data rows
for a given vehicle (by normalized reg no). Run with:

  .venv/Scripts/python.exe follow_vehicle.py --vehicle HR69E7086 --interval 5

Ctrl-C to stop.
"""
import sqlite3
import argparse
import time
from datetime import datetime

DB = 'fleet_erp_backend_sqlite.db'

def normalize_v_no(v_no):
    import re
    if not v_no:
        return ''
    return re.sub(r'[^A-Z0-9]', '', str(v_no).upper())

def poll(vehicle, interval):
    last_id = 0
    last_time = None
    vnorm = normalize_v_no(vehicle)
    print(f"Following vehicle: {vnorm} (poll interval {interval}s). Ctrl-C to stop.")
    try:
        while True:
            try:
                conn = sqlite3.connect(DB)
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                # prefer numeric id tailing, fallback to gps_time
                cur.execute("SELECT id, vehicle_number, latitude, longitude, speed, gps_time, client_id FROM gps_live_data WHERE UPPER(vehicle_number) LIKE ? AND id > ? ORDER BY id ASC LIMIT 100", (f'%{vnorm}%', last_id))
                rows = cur.fetchall()
                if not rows:
                    # also check gps_current for updates newer than last_time
                    if last_time is not None:
                        cur.execute("SELECT vehicle_number, latitude, longitude, gps_time, client_id FROM gps_current WHERE UPPER(vehicle_number) LIKE ? AND gps_time > ? ORDER BY gps_time ASC", (f'%{vnorm}%', last_time))
                        rows = cur.fetchall()
                for r in rows:
                    rid = r['id'] if 'id' in r.keys() else None
                    vn = r['vehicle_number']
                    lat = r['latitude']
                    lon = r['longitude']
                    sp = r['speed'] if 'speed' in r.keys() else None
                    gtime = r['gps_time']
                    client = r['client_id'] if 'client_id' in r.keys() else None
                    print(f"[{datetime.now().isoformat()}] id={rid} vehicle={vn} lat={lat} lon={lon} speed={sp} gps_time={gtime} client={client}")
                    if rid and rid > last_id:
                        last_id = rid
                    if gtime:
                        last_time = gtime
                conn.close()
            except Exception as e:
                print(f"DB read error: {e}")
            time.sleep(interval)
    except KeyboardInterrupt:
        print('\nStopped following.')

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--vehicle', '-v', default='HR69E7086', help='Vehicle registration (normalized will be used)')
    p.add_argument('--interval', '-i', type=float, default=5.0, help='Poll interval seconds')
    args = p.parse_args()
    poll(args.vehicle, args.interval)
