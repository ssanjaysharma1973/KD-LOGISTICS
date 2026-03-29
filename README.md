
# KD Logistics — Fleet & E-Way Bill Management Platform

> Full-stack logistics ERP: GPS tracking, E-Way Bill lifecycle, Munshi (field manager) portal, POI (Point of Interest) management, trip expense tracking, and delivery confirmation.

---

## 🗺️ System Mind Map

```
KD LOGISTICS PLATFORM
│
├── 🌐 FRONTEND  (React + Vite)
│   │
│   ├── 👨‍💼 ADMIN PORTAL  (App.jsx → DevAdmin)
│   │   ├── 🚛 Vehicle Tracker       ← GPS live map, vehicle list, status chips
│   │   ├── 🏢 Vehicle Management    ← CRUD, driver assign, munshi assign, POI assign
│   │   ├── 📍 POI Management        ← Add/edit Points of Interest (depot, dealer, hub)
│   │   ├── 🧑‍✈️ Driver Page          ← Driver list, PIN setup
│   │   ├── 📒 Munshi Page           ← Munshi list, PIN setup, balance
│   │   ├── 🗺️ Route Operations      ← Standard routes, trip dispatch wizard
│   │   └── 📊 EWB Hub  (EwayBillHub.jsx)
│   │       ├── 🚛 Vehicle Movement  ← Swimlane: At-POI / In-Transit / Empty
│   │       ├── 📊 Summary           ← Stats by movement type / status
│   │       ├── 📋 Bills List        ← Paginated EWBs, filter, deliver, delete
│   │       ├── 📍 By POI            ← EWBs grouped by origin/destination POI
│   │       ├── 📥 Import            ← Excel upload → auto-create POIs at score≥5
│   │       ├── ⚠️ Warnings          ← Expires today, no vehicle, no POI match
│   │       ├── 🔗 Unmatched POIs    ← Manually link trade names → POIs
│   │       └── 🔴 Live EWB          ← NIC-synced active EWBs
│   │           ├── [Extend]         ← Extend validity via NIC API
│   │           └── [✅ Done]        ← Mark delivered + assign munshi + log expenses
│   │
│   └── 👷 MUNSHI PORTAL  (MunshiPortal.jsx)
│       │   PIN login → munshi-scoped view
│       ├── 🗺️ Routing Tab
│       │   ├── My POIs (expanded, blue) ← vehicles At-POI / On-Road / inbound
│       │   ├── Other POIs (collapsed)
│       │   └── Action Panel (click POI or vehicle chip)
│       │       ├── At-POI vehicles list
│       │       ├── On-Road vehicles list
│       │       ├── Other vehicle dropdown
│       │       ├── Live EWB dropdown (filtered by POI)
│       │       └── [➕ Create Trip] → pre-fills Trips tab
│       │
│       ├── 🚛 Trips Tab
│       │   ├── Left: My Vehicles (own + common + POI-overlap)
│       │   ├── Right: Active EWBs for selected vehicle
│       │   │   └── [✅ Deliver] → MunshiDeliverModal (mark delivered + expenses)
│       │   ├── POI EWBs panel (all EWBs from munshi's registered POIs)
│       │   └── New/Edit Trip Form
│       │       ├── Vehicle dropdown
│       │       ├── EWB Number → REAL EWB dropdown (filtered by vehicle)
│       │       │   └── "⌨️ Enter manually" fallback
│       │       ├── From/To POI selectors
│       │       ├── KM + Toll
│       │       └── Expenses (Munshi / Cash Fuel / Unloading / Other)
│       │           └── Admin-only fields: Admin Exp, Driver Debit (locked 🔒)
│       │
│       ├── 💰 Expenses Tab       ← All trips for munshi's vehicles, totals
│       ├── 🚗 Vehicles Tab       ← My vehicles with GPS status + active EWBs
│       └── 📒 Ledger Tab         ← Munshi balance ledger entries
│
├── 🖥️ BACKEND  (server.js — Node.js, single file)
│   │
│   ├── 🗄️ DATABASE  SQLite @ /data/fleet_erp_backend_sqlite.db (Railway Volume)
│   │   ├── vehicles              vehicle_no, driver, munshi, poi assignments
│   │   ├── pois                  lat/lon, radius, type (primary/secondary/tertiary)
│   │   ├── munshis               name, phone, PIN hash, primary_poi_ids, balance
│   │   ├── drivers               name, phone, PIN hash
│   │   ├── eway_bills_master     ewb_no, from/to POI, status, munshi, delivered_at
│   │   ├── munshi_trips          trip expenses per EWB + munshi
│   │   ├── gps_current           latest GPS ping per vehicle
│   │   ├── munshi_ledger         credit/debit entries per munshi
│   │   ├── fuel_type_rates       diesel/petrol/CNG per size
│   │   └── poi_unloading_rates_v2 per-POI unloading rate
│   │
│   └── 🌐 API ENDPOINTS
│       │
│       ├── /api/pois              GET/POST/PUT/DELETE
│       ├── /api/vehicles-master   GET/POST/PUT/DELETE  + /dropdown + /fuel-rate
│       ├── /api/drivers           GET/POST/DELETE
│       ├── /api/munshis           GET/POST/PUT/DELETE  + /login (PIN auth)
│       ├── /api/vehicles/driver-login   PIN → driver session
│       │
│       ├── /api/eway-bills-hub    EWB Hub endpoints
│       │   ├── GET    ?page&status&movement_type&vehicle_no  ← paginated list
│       │   ├── GET    /summary                               ← stats
│       │   ├── GET    /vehicle-movement                      ← swimlane data
│       │   ├── GET    /warnings                              ← expiry alerts
│       │   ├── GET    /active-list                           ← all EWBs (NIC live)
│       │   ├── GET    /unmatched-pois                        ← unlinked trade names
│       │   ├── PATCH  /:id                                   ← update status/munshi/POI
│       │   ├── DELETE /:id
│       │   ├── POST   /import-excel                          ← Excel → auto-create POIs
│       │   ├── POST   /rematch-pois                          ← re-score all POI links
│       │   ├── POST   /reclassify                            ← fix movement_type
│       │   ├── POST   /deduplicate
│       │   └── POST   /purge-all
│       │
│       ├── /api/ewb               NIC EWB API proxy
│       │   ├── GET    /active-list
│       │   ├── GET    /details/:no
│       │   ├── POST   /extend-validity                       ← NIC extend call
│       │   ├── POST   /fetch-from-nic                        ← pull by date/status
│       │   ├── POST   /sync-last-days
│       │   └── POST   /sync-this-month
│       │
│       ├── /api/munshi-trips      Trip expense CRUD
│       │   ├── GET    ?vehicle_no
│       │   ├── POST                                          ← create trip + expenses
│       │   ├── PUT    /:id
│       │   └── GET    /ewb-search?vehicle_no|poi_ids         ← EWB dropdown source
│       │
│       ├── /api/ewaybills         Legacy EWB endpoints
│       │   ├── PUT    /:id/extend
│       │   ├── PUT    /:id/close
│       │   └── PUT    /:id/update-part-b
│       │
│       ├── /api/standard-routes   Route templates
│       ├── /api/trip-dispatches   Job card dispatch + stops
│       ├── /api/munshi-ledger     Balance entries
│       └── /api/gps/*             GPS current position, history
│
└── 🔄 DATA FLOW — EWB LIFECYCLE
    │
    ├── 1. IMPORT  Excel upload → matchPoiByName (score≥5 → auto-create POI)
    │              → eway_bills_master INSERT + movement_type classified
    │
    ├── 2. MONITOR  Live EWB tab (NIC sync) → shows hours_left, expiry badge
    │              → Admin: [Extend] validity via NIC  OR  [✅ Done] + munshi assign
    │
    ├── 3. ASSIGN   Vehicle assigned → munshi_name + munshi_id written to EWB
    │
    ├── 4. DISPATCH  Munshi Portal → Routing tab → vehicle reaches destination POI
    │               → [✅ Deliver] button on EWB card
    │
    └── 5. COMPLETE  MunshiDeliverModal / CompleteModal
                    → PATCH eway_bills_master SET status='delivered', delivered_at=NOW
                    → POST munshi_trips (KM + expenses linked to EWB + munshi)
                    → EWB removed from active lists
```

---

## 👤 User Roles & Access

| Role | Portal | What they can do |
|------|--------|-----------------|
| **Admin** | DevAdmin (main app) | Full CRUD on all entities, set admin/driver-debit expenses, complete old inventory EWBs |
| **Munshi** | MunshiPortal (PIN login) | View own vehicles/POIs, create trips, log expenses, mark deliveries for fresh route EWBs |
| **Driver** | (PIN login, future) | Mark stop arrivals, view assigned job card |

---

## 🏗️ Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, plain CSS-in-JS |
| Backend | Node.js (single `server.js`, no framework) |
| Database | SQLite via `better-sqlite3` (sync) or `sqlite3` (async) |
| Deploy | Railway — server = `server.js`, static files served from `dist/` |
| Persistence | Railway Volume mounted at `/data/` for SQLite DB |
| GPS | External API (Munshi GPS / vehicle tracker) |
| NIC EWB | NIC sandbox API (GSTIN: 06AAGCB1286Q006) |

---

## 🚀 Run Locally

```bash
# Install dependencies
npm install

# Build frontend
npm run build

# Start server (serves API + built frontend)
node server.js
```

Open `http://localhost:3001`

---

## 📁 Key Files

```
atul-logistics/
├── server.js                    ← All API endpoints + SQLite logic (~3000 lines)
├── src/
│   ├── App.jsx                  ← Main entry, tab routing (Admin portal)
│   └── components/
│       ├── DevAdmin.jsx         ← Admin shell with sidebar tabs
│       ├── EwayBillHub.jsx      ← Full EWB management hub (8 tabs)
│       ├── MunshiPortal.jsx     ← Munshi-facing portal (5 tabs)
│       ├── VehicleTrackerTab.jsx← GPS live map
│       ├── VehicleManagement.jsx← Vehicle CRUD
│       ├── POIManagement.jsx    ← POI CRUD
│       ├── MunshiPage.jsx       ← Munshi admin list
│       ├── DriverPage.jsx       ← Driver admin list
│       └── Sidebar.jsx          ← Navigation sidebar
├── dist/                        ← Built frontend (served by server.js)
└── fleet_erp_backend_sqlite.db  ← Local DB (Railway uses /data/ path)
```

---

## 🔑 EWB Status Values

| Status | Meaning |
|--------|---------|
| `active` | In transit, validity running |
| `delivered` | Completed — goods received at destination |
| `cancelled` | Voided |
| `DEL` | NIC-side delivered status (from NIC sync) |
| `ACT` | NIC-side active status |
| `at_destination` | Vehicle GPS detected at destination POI |

## 📦 Movement Types (auto-classified on import)

| Type | Meaning |
|------|---------|
| `primary_to_secondary` | Factory/Hub → Distribution centre |
| `primary_to_tertiary` | Factory/Hub → Dealer |
| `secondary_to_dealer` | Distribution → Dealer |
| `dealer_return` | Dealer → back to hub (return) |
| `inward_return` | Inbound return to factory |
| `dealer_transfer` | Dealer to dealer transfer |
| `unclassified` | No POI match found yet |

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
