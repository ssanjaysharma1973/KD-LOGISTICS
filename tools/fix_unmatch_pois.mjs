// Fix: un-match 13 Greater Noida EWBs from wrong Gurugram POI.
// Also update POI 1730 so re-match works correctly.
import sqlite3pkg from 'sqlite3';
const { verbose } = sqlite3pkg;
const s = verbose();

const DB = process.argv[2] || './fleet_erp_backend_sqlite.db';
const db = new s.Database(DB);

const EWB_IDS = [52, 60, 57, 54, 53, 65, 67, 55, 64, 66, 51, 58, 69];

db.serialize(() => {
  // 1. Fix POI 1730 pincode and name so trade-name match score works
  db.run(
    `UPDATE pois SET poi_name='HAIER APPLIANCES INDIA PVT LIMITED, Greater Noida',
     pin_code='201308', address='Plot No H-6# DMIC Integrated Industrial Township, Greater Noida'
     WHERE id=1730`,
    function(e) {
      if (e) console.error('POI update failed:', e.message);
      else console.log('POI 1730 updated, changes:', this.changes);
    }
  );

  // 2. Clear from_poi_id for the 13 wrong-matched EWBs
  const placeholders = EWB_IDS.map(() => '?').join(',');
  db.run(
    `UPDATE eway_bills_master
     SET from_poi_id=NULL, from_poi_name=NULL
     WHERE id IN (${placeholders})`,
    EWB_IDS,
    function(e) {
      if (e) console.error('EWB clear failed:', e.message);
      else console.log('Cleared from_poi_id for', this.changes, 'EWBs');
    }
  );
});

db.close(() => console.log('Done. Run rematch-pois or re-open Unmatched POIs tab.'));
