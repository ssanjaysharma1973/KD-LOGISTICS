#!/usr/bin/env python3
"""
Query vehicle track from gps_current (fresh data only).
Usage: query_track.py <db_path> <vehicle_id> <from_iso_or_empty> <to_iso_or_empty> <client_id_or_empty>
Returns JSON array of {lat,lng,ts} with interpolated intermediate points.
"""
import sys, json, sqlite3, os, re, time
from datetime import datetime, timedelta

def normalize(v):
    if v is None:
        return ''
    return re.sub(r'[^A-Z0-9]', '', str(v).upper())

def log(msg):
    try:
        base = os.path.dirname(__file__) if '__file__' in globals() else os.getcwd()
        path = os.path.join(base, 'query_track-debug.log')
        ts = datetime.utcnow().isoformat()
        with open(path, 'a', encoding='utf-8') as f:
            f.write(f"{ts} {msg}\n")
    except Exception:
        pass

def run_query(cur, sql, params):
    for attempt in range(3):
        try:
            return cur.execute(sql, params).fetchall()
        except sqlite3.OperationalError as e:
            if 'locked' in str(e).lower() and attempt < 2:
                log(f"locked, retry {attempt + 1}")
                time.sleep(1.5)
                continue
            raise
    return []

def interpolate_points(points, max_gap_minutes=20):
    """
    Interpolate intermediate points when gap is too large.
    If time gap > max_gap_minutes, add linear interpolation points.
    """
    if len(points) < 2:
        return points
    
    interpolated = []
    
    for i in range(len(points)):
        interpolated.append(points[i])
        
        if i < len(points) - 1:
            curr = points[i]
            next_pt = points[i + 1]
            
            try:
                curr_time = datetime.fromisoformat(curr['ts'].replace('Z', '+00:00'))
                next_time = datetime.fromisoformat(next_pt['ts'].replace('Z', '+00:00'))
                time_gap_minutes = (next_time - curr_time).total_seconds() / 60
                
                # If gap is large, add interpolated points
                if time_gap_minutes > max_gap_minutes:
                    # Calculate number of intermediate points (one every ~10 min)
                    num_interp = max(1, int(time_gap_minutes / 10))
                    
                    curr_lat = float(curr['lat'])
                    curr_lng = float(curr['lng'])
                    next_lat = float(next_pt['lat'])
                    next_lng = float(next_pt['lng'])
                    
                    for step in range(1, num_interp + 1):
                        fraction = step / (num_interp + 1)
                        interp_lat = curr_lat + (next_lat - curr_lat) * fraction
                        interp_lng = curr_lng + (next_lng - curr_lng) * fraction
                        interp_time = curr_time + timedelta(minutes=time_gap_minutes * fraction)
                        
                        interpolated.append({
                            'lat': interp_lat,
                            'lng': interp_lng,
                            'ts': interp_time.isoformat().replace('+00:00', 'Z')
                        })
            except Exception:
                # If interpolation fails, just continue
                pass
    
    return interpolated

def main():
    if len(sys.argv) < 2:
        print('[]')
        return
    
    db_path = sys.argv[1]
    vehicle_id = sys.argv[2] if len(sys.argv) > 2 else ''
    from_ts = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] not in ('', 'null', 'None') else None
    to_ts = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] not in ('', 'null', 'None') else None
    client_id = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] not in ('', 'null', 'None') else None

    if not os.path.exists(db_path):
        print('[]')
        return
    
    try:
        db_uri = f"file:{db_path}?mode=ro&timeout=10"
        conn = sqlite3.connect(db_uri, timeout=10, uri=True)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA busy_timeout=5000')
        cur = conn.cursor()

        rows = []
        
        if vehicle_id:
            try:
                vehicle_norm = normalize(vehicle_id)
                norm_expr = "REPLACE(REPLACE(REPLACE(UPPER(vehicle_number), ' ', ''), '-', ''), '_', '')"
                
                params = []
                where = [f"(vehicle_number = ? OR {norm_expr} = ?)"]
                params.extend([vehicle_id, vehicle_norm])
                
                if client_id:
                    where.append('client_id = ?')
                    params.append(client_id)
                
                # Try gps_live_data first (has history) - INCREASED LIMIT to 1000
                q = 'SELECT vehicle_number, latitude AS lat, longitude AS lng, gps_time AS ts FROM gps_live_data'
                if where:
                    q += ' WHERE ' + ' AND '.join(where)
                q += ' ORDER BY ts DESC LIMIT 1000'
                
                rows = run_query(cur, q, params)
                
                # Fallback to gps_current if no results
                if not rows:
                    q2 = 'SELECT vehicle_number, latitude AS lat, longitude AS lng, gps_time AS ts FROM gps_current'
                    if where:
                        q2 += ' WHERE ' + ' AND '.join(where)
                    q2 += ' ORDER BY ts DESC LIMIT 1000'
                    rows = run_query(cur, q2, params)
                
            except Exception as e:
                log(f"Query error: {e}")
                rows = []

        # Format output
        out = []
        for r in rows:
            try:
                lat = r['lat'] if r['lat'] is not None else None
                lng = r['lng'] if r['lng'] is not None else None
                ts = r['ts']
                if lat is None or lng is None:
                    continue
                out.append({'lat': float(lat), 'lng': float(lng), 'ts': ts})
            except Exception:
                continue
        
        # Reverse to chronological order (we queried DESC)
        out = list(reversed(out))
        
        # Apply interpolation to fill gaps between distant points
        out = interpolate_points(out, max_gap_minutes=20)

        print(json.dumps(out))
        conn.close()
    except Exception as e:
        log(f"Fatal: {e}")
        print('[]')

if __name__ == '__main__':
    main()
