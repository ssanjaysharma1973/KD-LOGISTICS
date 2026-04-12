const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./fleet_erp_backend_sqlite.db');
db.get(
  `SELECT COUNT(*) as total,
   COUNT(CASE WHEN from_poi_id IS NULL OR from_poi_id='' THEN 1 END) as no_from,
   COUNT(CASE WHEN to_poi_id IS NULL OR to_poi_id='' THEN 1 END) as no_to
   FROM eway_bills_master WHERE client_id='CLIENT_001'`,
  (e, r) => {
    console.log('totals:', JSON.stringify(r));
    // Sample a few rows
    db.all(
      `SELECT id, ewb_no, from_poi_id, from_poi_name, to_poi_id, to_poi_name, from_trade_name, to_trade_name
       FROM eway_bills_master WHERE client_id='CLIENT_001' LIMIT 5`,
      (e2, rows) => {
        rows.forEach(r2 => console.log(JSON.stringify(r2)));
        db.close();
      }
    );
  }
);
