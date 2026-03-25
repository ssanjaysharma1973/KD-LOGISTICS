import sqlite3, os, time, shutil, sys
DB = 'fleet_erp_backend_sqlite.db'
if not os.path.exists(DB):
    print('DB not found:', DB)
    sys.exit(1)
# backup
ts = int(time.time())
backup = f"{DB}.bak.{ts}"
shutil.copyfile(DB, backup)
print('Backup created:', backup)
# connect
conn = sqlite3.connect(DB)
cur = conn.cursor()
# inspect columns
cur.execute("PRAGMA table_info(gps_live_data)")
cols = [r[1] for r in cur.fetchall()]
print('gps_live_data columns:', cols)
# choose time column
time_col = None
for candidate in ('gps_time','createdDate','created_date','created_at','timestamp'):
    if candidate in cols:
        time_col = candidate
        break
if not time_col:
    print('No time-like column found in gps_live_data; aborting')
    conn.close()
    sys.exit(1)
print('Using time column:', time_col)
# compute cutoff: 30 days
RETENTION_DAYS = int(os.environ.get('PRUNE_RETENTION_DAYS','30'))
cutoff = int(time.time()) - RETENTION_DAYS * 86400
print(f'Retention: {RETENTION_DAYS} days; cutoff epoch: {cutoff}')
# show min/max
try:
    cur.execute(f"SELECT MIN({time_col}), MAX({time_col}) FROM gps_live_data")
    r = cur.fetchone()
    print('min,max sample:', r)
except Exception as e:
    print('min/max failed:', e)
# Count rows before
cur.execute("SELECT COUNT(*) FROM gps_live_data")
before = cur.fetchone()[0]
print('rows before:', before)
# delete in batches using rowid selection
BATCH = 100000
total_deleted = 0
while True:
    cur.execute(f"DELETE FROM gps_live_data WHERE rowid IN (SELECT rowid FROM gps_live_data WHERE CAST({time_col} AS INTEGER) < ? LIMIT ?)", (cutoff, BATCH))
    conn.commit()
    deleted = cur.rowcount
    if deleted is None:
        # sqlite3 in Python may return -1; fallback to row count diff
        cur.execute("SELECT COUNT(*) FROM gps_live_data")
        now = cur.fetchone()[0]
        # approximate deleted
        deleted = before - now - total_deleted
    total_deleted += deleted if deleted>0 else 0
    print('deleted batch:', deleted, 'total_deleted:', total_deleted)
    if deleted == 0 or deleted is None:
        break
# final counts
cur.execute("SELECT COUNT(*) FROM gps_live_data")
after = cur.fetchone()[0]
print('rows after:', after)
conn.close()
# vacuum to reclaim space
print('Running VACUUM (may take time)')
conn = sqlite3.connect(DB)
conn.isolation_level = None
c = conn.cursor()
c.execute('VACUUM')
conn.close()
print('VACUUM complete')
print('DB size (bytes):', os.path.getsize(DB))
print('Backup kept at:', backup)
