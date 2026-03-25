import sys
import sqlite3
from pathlib import Path

def q(conn, sql, params=()):
    cur = conn.cursor()
    cur.execute(sql, params)
    return cur.fetchall()


def main():
    if len(sys.argv) < 3:
        print('Usage: inspect_db.py <db_path> <vehicleId>')
        return
    db_path = sys.argv[1]
    vehicle = sys.argv[2]
    p = Path(db_path)
    if not p.exists():
        print('DB_NOT_FOUND', db_path)
        return
    conn = sqlite3.connect(str(p))
    try:
        print('PRAGMA user_version =', q(conn, 'PRAGMA user_version')[0][0])
        # list tables
        tables = q(conn, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [t[0] for t in tables]
        print('TABLES:', ','.join(tables))
        # check for gps_live_data
        if 'gps_live_data' in tables:
            cols = q(conn, "PRAGMA table_info('gps_live_data')")
            print('gps_live_data columns:', ','.join([c[1] for c in cols]))
            # count total rows
            total = q(conn, 'SELECT COUNT(*) FROM gps_live_data')[0][0]
            print('gps_live_data total rows:', total)
            # try various candidate columns to match vehicle
            candidates = ['vehicle_number','device_number','vehicle_no','vehicleNumber','deviceNumber','number']
            found = False
            for col in candidates:
                # check if column exists
                if col in [c[1] for c in cols]:
                    cnt = q(conn, f"SELECT COUNT(*) FROM gps_live_data WHERE {col} = ?", (vehicle,))[0][0]
                    if cnt > 0:
                        print(f"MATCH by exact {col}: {cnt} rows")
                        rows = q(conn, f"SELECT * FROM gps_live_data WHERE {col} = ? ORDER BY gps_time LIMIT 10", (vehicle,))
                        for r in rows:
                            print(r)
                        found = True
            if not found:
                # try LIKE on any text columns
                textcols = [c[1] for c in cols if c[2].upper() in ('TEXT','VARCHAR','CHAR')]
                print('No exact-match rows; trying LIKE on text columns:', textcols)
                anycnt = 0
                for col in textcols:
                    try:
                        cnt = q(conn, f"SELECT COUNT(*) FROM gps_live_data WHERE {col} LIKE ?", (f"%{vehicle} %",))[0][0]
                    except Exception:
                        try:
                            cnt = q(conn, f"SELECT COUNT(*) FROM gps_live_data WHERE {col} LIKE ?", (f"%{vehicle}%",))[0][0]
                        except Exception:
                            cnt = 0
                    if cnt > 0:
                        print(f"MATCH by LIKE {col}: {cnt} rows (sample:)")
                        rows = q(conn, f"SELECT * FROM gps_live_data WHERE {col} LIKE ? ORDER BY gps_time LIMIT 10", (f"%{vehicle}%",))
                        for r in rows:
                            print(r)
                        anycnt += cnt
                if anycnt == 0:
                    print('No rows matched vehicle in gps_live_data')
        else:
            print('gps_live_data table not present in DB')
        # also show first rows from any table that looks like tracking data
        candidates = [t for t in tables if 'gps' in t.lower() or 'track' in t.lower() or 'location' in t.lower()]
        for t in candidates:
            try:
                sample = q(conn, f"SELECT * FROM {t} LIMIT 5")
                print(f'Sample rows from {t}:')
                for r in sample:
                    print(r)
            except Exception:
                pass
    finally:
        conn.close()

if __name__ == '__main__':
    main()
