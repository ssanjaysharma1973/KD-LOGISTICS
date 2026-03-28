
# Atul Logistics Platform

This project is a full-stack fleet and logistics management platform with:
- A modern React frontend (with Vite)
- Node.js and Python backend APIs
- SQLite database (with master schema)
- Command-line utilities for data sync, migration, and maintenance

---

## Frontend (React, Vite, JS)
- **Entry:** `src/index.js`, `src/App.jsx`
- **UI Components:**
	- `src/components/VehicleTrackerTab.jsx` (Fleet tracking UI)
	- `src/components/VehicleManagement.jsx` (Vehicle CRUD)
	- `src/components/RouteManagement.jsx` (Route planning)
	- `src/components/MapComponent.jsx` (Map integration)
	- `src/components/EwayBillManagement.jsx` (E-way bill UI)
- **API Client:** `src/services/api.js`
- **State:** `src/context/VehicleDataContext.jsx`
- **HTML Template:** `index.html`

## Backend (Node.js, Python, SQLite)
- **Node.js API:** `server.js` (main API, DB logic, .env loader)
- **Python APIs:**
	- `api_vehicles_server.py` (vehicle data, Flask)
	- `app_proxy.py` (proxy server)
	- `route_expense_api.py` (route expense logic)
- **Database:**
	- `fleet_erp_backend_sqlite.db` (main DB)
	- `master_schema.sql` (all CREATE TABLE/ALTER TABLE statements)

## Command-Line & Maintenance Scripts
- **Sync:** `auto_sync_vehicles.py`, `run_sync_worker.bat`
- **Import/Migrate:** `bulk_import_pois.py`, `migrate_gps_tables.py`
- **Diagnostics:** `verify_api.py`

## Database Schema (Excerpt)
See `master_schema.sql` for full details. Example tables:

```sql
-- Table: pois
CREATE TABLE IF NOT EXISTS pois (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	client_id TEXT,
	poi_name TEXT NOT NULL,
	latitude REAL,
	longitude REAL,
	state TEXT,
	city TEXT,
	address TEXT,
	pin_code TEXT,
	radius_meters INTEGER DEFAULT 500,
	type TEXT DEFAULT 'primary' -- 'primary', 'secondary', 'tertiary', or 'other'
);

-- Table: vehicles
CREATE TABLE IF NOT EXISTS vehicles (
	vehicle_reg_no TEXT PRIMARY KEY,
	driver_name TEXT,
	type TEXT,
	client_id TEXT
);

-- Table: poi_unloading_rates_v2 (Vehicle category-based unloading charges)
CREATE TABLE IF NOT EXISTS poi_unloading_rates_v2 (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	client_id TEXT,
	poi_id INTEGER NOT NULL,
	category_1_32ft_34ft REAL DEFAULT 0,
	category_2_22ft_24ft REAL DEFAULT 0,
	category_3_small REAL DEFAULT 0,
	notes TEXT,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(client_id, poi_id)
);
```

### POI Type Classifications
- **Primary**: Main warehouse/distribution center (origin of shipments)
- **Secondary**: First-level distribution hubs (regional centers)
- **Tertiary**: Local delivery points (city-level destinations)
- **Other**: Special purpose locations (pilot centers, special shipments)
- Use the `type` column to categorize and filter POIs for different logistics operations

### Unloading Charges System
- The `poi_unloading_rates_v2` table stores vehicle category-based unloading charges
- **Category 1**: 32FT & 34FT trucks (large, long-haul vehicles)
- **Category 2**: 22FT & 24FT trucks (medium, mid-range vehicles)
- **Category 3**: Small vehicles/vans (local, short-distance delivery)
- Charges are configurable per POI and vehicle category for cost optimization

## Setup & Configuration

### Environment Variables (.env)
Create a `.env` file in the project root with:

```env
# API Configuration
WHEELSEYE_API_URL=https://your-api.com/gps/data
API_PORT=3000

# Database
DB_PATH=fleet_erp_backend_sqlite.db

# Client Configuration
CLIENT1_ID=CLIENT_001
CLIENT1_NAME=Atul Logistics
CLIENT1_API_URL=https://your-api.com/endpoint
CLIENT1_SYNC_ENABLED=true
CLIENT1_SYNC_INTERVAL=300

# Sync Settings
SYNC_INTERVAL=60
SYNC_TIMEOUT=10
SYNC_RETRIES=3
```

### Running the Application

**1. Install Dependencies**
```bash
npm install              # Frontend dependencies
pip install -r requirements.txt  # Backend dependencies (if exists)
```

**2. Start Sync Worker (ONE-TIME or BACKGROUND)**

**Option A - Auto-Start on Boot (Recommended)**
```bash
# Run ONCE as Administrator to setup:
setup_sync_scheduler.ps1    # PowerShell (Recommended)
# OR
setup_sync_scheduler.bat    # Batch file
# Then just reboot - sync starts automatically!
```
📖 See [SYNC_AUTO_START_GUIDE.md](SYNC_AUTO_START_GUIDE.md) for detailed setup

**Option B - Manual Start (Windows Batch File)**
```bash
# Double-click this in File Explorer or run:
START_SYNC_WORKER.bat
```

**Option C - Command Line (Keep window open)**
```bash
python sync_worker.py
# Syncs GPS data every 60 seconds. Close window to stop.
```

**Option D - Manual One-Time Sync**
```bash
python manual_sync_test.py     # One-time sync
# OR
python auto_sync_vehicles.py   # Initial sync on startup
```

**3. Start Node.js API** (in a new terminal)
```bash
node server.js          # Or: npm start
# Runs on http://localhost:3000
```

**4. Start Frontend (Dev)** (in another new terminal)
```bash
npm run dev             # Vite dev server (usually http://localhost:5173)
```

### Important: Sync Worker Must Run Continuously
- The sync worker updates GPS data from the API every 60 seconds
- **If sync worker is NOT running, all vehicles will show STOP status** (after 30 minutes)
- 🎯 **Recommended:** Use auto-start setup to run on every boot (see Option A above)
- Alternatively, keep `sync_worker.py` running in a background terminal
- See [SYNC_AUTO_START_GUIDE.md](SYNC_AUTO_START_GUIDE.md) for detailed setup instructions

## Troubleshooting

### All Vehicles Showing STOP Status
**Cause:** GPS data is stale (last update >30 minutes old) - **Sync worker is not running**

**Quick Fix:**
```bash
# Run manual sync
python manual_sync_test.py

# Then start background sync (keep running)
python sync_worker.py
# Or use: START_SYNC_WORKER.bat (Windows)
```

**Detailed Check:**
1. Run diagnostic: `python diagnose_stop_issue.py`
2. Check if `.env` has `CLIENT1_API_URL` set correctly
3. Verify API is reachable: `curl "https://api.wheelseye.com/currentLoc?..."`
4. Manually sync: `python manual_sync_test.py`
5. Keep sync worker running: `python sync_worker.py` (in background terminal)

**Vehicle Status Rules:**
- 🟢 ACTIVE: GPS <30 min old + moving >50m
- 🟡 STOPPED: GPS <30 min old + stationary ≤50m for ≥10 min
- 🟠 STALE: GPS 30 min - 1 day old
- 🔴 OFFLINE: GPS 1-2 days old
- ⚫ INACTIVE: GPS >2 days old

### Sync Not Working
1. Ensure `sync_worker.py` is running continuously
2. Check `.env` has valid `CLIENT1_API_URL`
3. Test API: `python manual_sync_test.py`
4. Review logs: `gps_sync.log` (created after first sync run)
5. Verify API token hasn't expired (check WHEELSEYE dashboard)

### Database Issues
1. Ensure `fleet_erp_backend_sqlite.db` exists
2. Run diagnostic: `python diagnose_stop_issue.py`
3. Check schema: `python verify_api.py`
4. See `master_schema.sql` for required tables

## Documentation
- **README.md** (this file)
- **ROUTE_EXPENSE_INTEGRATION_GUIDE.md** (route expense module)
- **MOBILE_SETUP.md** (mobile config)
- **API_ERROR_FIX.md** (API troubleshooting)
- **VEHICLE_STATUS_DEFINITION.md** (status calculation logic)

---
For setup, development, and schema updates, see the scripts and SQL in this repo. All major components and their locations are listed above for quick reference.
