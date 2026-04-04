# KD-LOGISTICS: Scheduling & Syncing Timing Summary

## Overview
This document details all scheduled syncs, exports, and refresh operations in the KD-LOGISTICS system.

---

## 1. E-Way Bill Exports (Automated)

### Configuration
**File**: `.env`
```env
AUTO_SYNC_ENABLED=true
EXPORT_INTERVAL=daily              # hourly, daily, weekly
EXPORT_HOUR=2                      # 0-23 (hour of day - runs at 2:00 AM)
EXPORT_CLIENTS=CLIENT_001,CLIENT_002
MASTER_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### Export Scheduling Logic
**File**: `src/services/exportScheduler.js`

#### Frequency Options
| Interval | Timing | Details |
|----------|--------|---------|
| **hourly** | Every hour | Next run: next hour at :00 |
| **daily** | Once per day | Runs at configured EXPORT_HOUR (default: 2 AM) |
| **weekly** | Once per week | Specific day + configured hour |

#### Current Configuration
- **Type**: Daily
- **Time**: 2:00 AM (EXPORT_HOUR=2)
- **Clients**: CLIENT_001, CLIENT_002
- **Interval (ms)**: `24 * 60 * 60 * 1000` = 86,400,000 ms

#### Export Output
- **Directory**: `/data/exports/` (or `./exports/` fallback)
- **Format**: Excel (.xlsx) with multiple sheets
  - Sheet 1: E-Way Bills (color-coded by status)
  - Sheet 2: Summary (statistics)
  - Sheet 3: Warnings (expired, expiring soon)
- **Filename Pattern**: `ewaybills_CLIENT_001_2024-04-03_0200.xlsx`
- **File Rotation**: Keeps last 5 versions per client (auto-deletes older)

#### Configuration in Code
**Location**: `src/services/exportScheduler.js` (lines 32-58)
```javascript
export function scheduleExport(queryFn, exportFn, options = {}) {
  const interval = options.interval || 'daily';
  const hour = options.hour !== undefined ? options.hour : 2;
  const clients = options.clients || 'auto';
  
  const interval_ms = getIntervalMs(interval);
  // ...
  setInterval(() => {
    runExportJob(queryFn, exportFn, clients);
  }, interval_ms);
}
```

---

## 2. E-Way Bill Syncing & Refresh

### A. Auto-Refresh from Masters India

**Location**: `server.js` (lines 4430-4480)

#### Timing
| Operation | Interval | Details |
|-----------|----------|---------|
| **Status Refresh** | Every 4 hours | Updates active e-way bill status from Masters India API |
| **EWB Discovery** | Every 30 minutes | Fetches new EWBs from last 2 days (discovers bills assigned by customers) |
| **Initial Startup** | +30 seconds delay | Waits 30s after server startup before first sync |

#### Configuration
```javascript
const EWB_REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours = 14,400,000 ms
const DISCOVERY_INTERVAL = 30 * 60 * 1000; // 30 minutes = 1,800,000 ms
```

#### Process Flow
```
Server Startup
     ↓
     [+30s delay]
     ↓
├─→ runFetchTodayEwbs() [Discovery - last 2 days]
├─→ runEwbAutoRefresh() [Status update - last 30 days]
     ↓
Schedule recurring:
├─→ Every 4 hours: runEwbAutoRefresh() 
└─→ Every 30 min: runFetchTodayEwbs()
```

#### Details
- **Requirements**: `MASTERS_USERNAME` + `MASTERS_GSTIN` environment variables
- **Query**: Searches bills from last 30 days with status NOT in ('cancelled')
- **Limit**: Processes max 100 bills per refresh cycle
- **Update Fields**: `valid_upto`, `status`, `updated_at`

---

## 3. Vehicle GPS Auto-Sync

### Configuration
**File**: `.env`
```env
AUTO_SYNC_ENABLED=true
CLIENT1_SYNC_INTERVAL=10          # seconds (legacy, not actively used)
DEFAULT_SYNC_INTERVAL=10          # seconds (legacy)
PROVIDER_API_URL=https://api.wheelseye.com/currentLoc?...
AUTO_SYNC_INTERVAL_MS=120000      # 2 minutes (default)
```

### Timing
**Location**: `server.js` (lines 4365-4422)

| Operation | Interval | Details |
|-----------|----------|---------|
| **GPS Sync** | Every 2 minutes (120,000 ms) | Fetches vehicle location from provider API |
| **Initial Startup** | +8 seconds delay | Waits 8s after seed initialization |

```javascript
const AUTO_SYNC_INTERVAL_MS = parseInt(process.env.AUTO_SYNC_INTERVAL_MS || '120000');
// 2 min default = 120,000 ms

setTimeout(() => {
  runAutoSync(); // First run after 8s
  setInterval(() => runAutoSync(), AUTO_SYNC_INTERVAL_MS); // Then every 2 min
}, 8000);
```

### Process Flow
1. Reads all tenant IDs from database + environment variables
2. Fetches current vehicle positions from PROVIDER_API_URL
3. Updates two tables:
   - `gps_current`: Latest position (overwrites previous)
   - `gps_live_data`: Historical log (appends)
4. Makes data available on dashboard in real-time

### Requirements
- `PROVIDER_API_URL` must be configured
- `PROVIDER_API_KEY` (optional, for Bearer token auth)

---

## 4. Frontend Refresh Intervals

### UI Auto-Refresh Rates
**File**: Various React components

| Component | Refresh Interval | Location |
|-----------|------------------|----------|
| EWB Hub (main data) | 30 seconds | `EwayBillHub.jsx` line 863 |
| EWB Movement/Alerts | 60 seconds | `App.jsx` line 184 |
| Alerts Log | 60 seconds | `EwayBillHub.jsx` line 1079 |
| Driver Portal | 30 seconds | `DriverPage.jsx` line 531 |
| Munshi Portal (routes) | 30 seconds | `MunshiPortal.jsx` line 177 |
| Trip Monitor | 30 seconds | `TripMonitor.jsx` line 1015 |
| Live Vehicles by Route | 30 seconds | `RoutesPage.jsx` line 101 |
| Vehicle Data Context | Configurable via `REFRESH_INTERVAL` | `VehicleDataContext.jsx` line 95 |

---

## 5. Stale Data Detection

### GPS Data Staleness
**Rules**:
- **Status Change**: After 30 minutes without update, vehicles show "STOP" status
- **Detection**: `updated_at > 30 minutes` in `gps_current` table
- **Trigger**: Indicates sync worker is not running

---

## 6. Startup Sequence Timeline

```
t=0s         Server starts
             │
             ├─ Load .env configuration
             ├─ Initialize SQLite database
             ├─ Start seed/data initialization
             │
t=8s         │
             ├─ GPS Auto-Sync enabled (if PROVIDER_API_URL set)
             │   └─ First refresh at t=8s, then every 120 seconds
             │
t=30s        │
             ├─ E-Way Bill operations enabled (if MASTERS_USERNAME set)
             │   ├─ runFetchTodayEwbs() - Discover new bills
             │   ├─ runEwbAutoRefresh() - Update bill status
             │   └─ Schedule recurring:
             │       ├─ Every 30 min: runFetchTodayEwbs()
             │       └─ Every 4 hours: runEwbAutoRefresh()
             │
t=ongoing    │
             └─ Export scheduler listens for API calls
                 └─ Runs daily at 2:00 AM (if EXPORT_INTERVAL=daily)
```

---

## 7. Environment Variables Summary

### Required for Syncing
```env
AUTO_SYNC_ENABLED=true                          # Master toggle for auto-sync
PROVIDER_API_URL=https://api.wheelseye.com/...  # GPS provider endpoint
```

### Optional for Syncing
```env
AUTO_SYNC_INTERVAL_MS=120000                    # GPS sync interval (2 min default)
PROVIDER_API_KEY=<bearer-token>                 # Authentication for PROVIDER_API_URL
```

### Required for E-Way Bill Auto-Refresh
```env
MASTERS_USERNAME=Atul_logistics
MASTERS_GSTIN=06EXQPK4096H1ZW
MASTERS_PASSWORD=Nitish@1997
```

### Export Configuration
```env
EXPORT_INTERVAL=daily                           # hourly|daily|weekly
EXPORT_HOUR=2                                   # 0-23, hour of day
EXPORT_CLIENTS=CLIENT_001,CLIENT_002            # Comma-separated client IDs
MASTER_API_KEY=a1b2c3d4...                     # For automation API calls
```

---

## 8. Manual Triggers

### API Endpoints for Manual Sync

#### Trigger Immediate Export
```bash
POST /api/eway-bills-hub/export/run-now
Authorization: MasterKey <MASTER_API_KEY>

Body: { "clients": ["CLIENT_001"] }
```

#### Check Export Status
```bash
GET /api/eway-bills-hub/export/status
Authorization: MasterKey <MASTER_API_KEY>
```

#### Configure Export Schedule
```bash
POST /api/eway-bills-hub/export/schedule
Authorization: MasterKey <MASTER_API_KEY>

Body: {
  "interval": "daily",      # hourly|daily|weekly
  "hour": 2,                # 0-23
  "clients": ["CLIENT_001"]
}
```

#### Trigger EWB Discovery
```bash
POST /api/eway-bills-hub/discover-now
Authorization: MasterKey <MASTER_API_KEY>
```

---

## 9. Timing Summary Table

| Process | Default Interval | Configurable | Startup Delay |
|---------|------------------|--------------|---------------|
| **GPS Vehicle Sync** | 2 minutes (120s) | YES: `AUTO_SYNC_INTERVAL_MS` | +8s |
| **EWB Auto-Refresh** | 4 hours | NO (hardcoded) | +30s |
| **EWB Discovery** | 30 minutes | NO (hardcoded) | +30s |
| **Daily Export** | Once/day at 2 AM | YES: `EXPORT_HOUR` | On app startup or via API |
| **Frontend EWB Refresh** | 30-60 seconds | Per component | Immediate |

---

## 10. Troubleshooting

### GPS Data Not Updating
- Check: `AUTO_SYNC_ENABLED=true`
- Check: `PROVIDER_API_URL` is valid and accessible
- Check: Server started (wait 8+ seconds)
- Verify: `gps_current` table has recent `updated_at`

### E-Way Bills Not Refreshing
- Check: `MASTERS_USERNAME` and `MASTERS_GSTIN` configured
- Check: Masters India credentials are valid
- Check: Server started (wait 30+ seconds)
- Verify: Bills exist in database from last 30 days

### Exports Not Running
- Check: `.env` has `EXPORT_INTERVAL` and `EXPORT_HOUR`
- Check: `MASTER_API_KEY` configured
- Check: `/data/exports/` directory writable
- Use API: `GET /api/eway-bills-hub/export/status` to verify scheduler

---

## 11. Performance Notes

| Operation | CPU Impact | Memory Impact | Network |
|-----------|-----------|---------------|---------| 
| GPS Sync (120s) | Low | ~20 MB | 1 HTTP call |
| EWB Refresh (4h) | Medium | ~50 MB | Up to 100 API calls |
| EWB Discovery (30m) | Medium | ~30 MB | 1-2 API calls |
| Export (hourly/daily) | High | ~100-200 MB | Minimal |
| Frontend Refresh | None (client) | ~5 MB per tab | 1 HTTP call per interval |

---

**Last Updated**: April 4, 2026
**Version**: 1.0
