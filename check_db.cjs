const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Check which DB files exist
const dbFiles = ['fleet_erp_backend_sqlite.db', 'kd_logistics.db', 'database.db'].filter(f => fs.existsSync(f));
console.log('DB files found:', dbFiles);

const dbPath = dbFiles[0] || 'kd_logistics.db';
console.log('Using:', dbPath);

const db = new sqlite3.Database(dbPath);
db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (e, rows) => {
  if (e) { console.error('Error:', e.message); db.close(); return; }
  console.log('Tables:', rows.map(r => r.name).join(', '));
  
  if (rows.some(r => r.name === 'eway_bills_master')) {
    db.get("SELECT COUNT(*) as total, SUM(CASE WHEN vehicle_no IS NOT NULL AND vehicle_no!='' THEN 1 ELSE 0 END) as with_vehicle, SUM(CASE WHEN vehicle_no IS NULL OR vehicle_no='' THEN 1 ELSE 0 END) as no_vehicle, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active FROM eway_bills_master WHERE client_id='CLIENT_001'", (e2, r2) => {
      console.log('EWB stats:', JSON.stringify(r2));
      db.all("SELECT ewb_no, vehicle_no, status, doc_date FROM eway_bills_master WHERE vehicle_no IS NOT NULL AND vehicle_no!='' LIMIT 5", (e3, rows3) => {
        console.log('With vehicle sample:', JSON.stringify(rows3));
        db.close();
      });
    });
  } else {
    console.log('eway_bills_master table NOT found!');
    db.close();
  }
});
