import sqlite3Pkg from 'sqlite3';
const sqlite3 = sqlite3Pkg.verbose();
const db = new sqlite3.Database('./fleet_erp_backend_sqlite.db');

db.all(`
  SELECT ewb_no, doc_date, to_place, to_pincode, status, valid_upto 
  FROM eway_bills_master 
  WHERE client_id='CLIENT_001' AND doc_date >= '2026-04-01'
  ORDER BY doc_date DESC
  LIMIT 20
`, (err, rows) => {
  if (err) {
    console.error('Error:', err.message);
  } else {
    console.log('\n📋 E-Way Bills from April 1, 2026 onwards');
    console.log('=' .repeat(80));
    console.log('Total records found:', rows.length);
    console.log('=' .repeat(80));
    if (rows.length > 0) {
      console.table(rows);
    } else {
      console.log('No records found');
    }
  }
  db.close();
});
