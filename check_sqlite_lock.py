import sqlite3
import sys
DB='fleet_erp_backend_sqlite.db'
try:
    conn=sqlite3.connect(DB, timeout=1)
    cur=conn.cursor()
    cur.execute('PRAGMA quick_check')
    rows=cur.fetchall()
    print('OK', rows)
    conn.close()
except Exception as e:
    print('ERR', e)
    sys.exit(1)
