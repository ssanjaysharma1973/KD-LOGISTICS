# 🚀 Atul Logistics - Commands Reference Guide

All available commands and their purposes. Choose the command that matches what you want to do.

---

## 📋 MAIN OPERATIONS MENU (START HERE)

### Command
```
.\OPERATIONS_MENU.bat
```

### Purpose
**Interactive menu with 9 operations** - Single entry point for all tasks. Best choice when you're not sure what to do.

### What It Does
- Shows numbered menu with all available options
- You select by entering 1-9
- Runs the command you need
- Returns to menu for next task

### When to Use
✅ Daily operations  
✅ First time users  
✅ Want to see all available options  

### Example
```
Double-click OPERATIONS_MENU.bat (in File Explorer)
OR
Type: .\OPERATIONS_MENU.bat
```

### Options Inside Menu
```
1) Start GPS Sync Worker (Keep Window Open)      → Watch sync happening live
2) Start GPS Sync Worker + Close Window          → Sync runs in background
3) Check GPS Sync Status                         → Is sync working?
4) Manual GPS Sync (One-Time)                    → Import GPS once now
5) Get Vehicle Location                          → Find where a vehicle is
6) Setup Auto-Start on Boot                      → Run sync automatically
7) Diagnose STOP Status Issues                   → Why are vehicles STOP?
8) Open Documentation                            → Read guides
9) Exit                                          → Close menu
```

---

## 🔧 INDIVIDUAL COMMANDS

### 1️⃣ Setup Auto-Start (RECOMMENDED - ONE TIME ONLY)

#### Command Option A (Easy)
```
.\setup_sync_scheduler.bat
```

#### Command Option B (PowerShell)
```
.\setup_sync_scheduler.ps1
```

#### Purpose
**Configure GPS sync to run automatically when computer starts** - One-time setup, then sync runs forever.

#### What It Does
- Registers task in Windows Task Scheduler
- Runs sync_worker.py on every system boot
- No manual intervention needed after setup

#### When to Use
✅ First setup  
✅ After windows reinstall  
✅ Want sync to survive system restarts  

⚠️ **IMPORTANT**: Requires Administrator privileges

#### Example
```
Right-click on setup_sync_scheduler.bat
Select "Run as administrator"
Follow prompts
```

---

### 2️⃣ Start GPS Sync Worker (Visible)

#### Command
```
python sync_worker.py
```

#### Purpose
**Start GPS sync and watch it run** - Useful for testing/troubleshooting.

#### What It Does
- Fetches GPS data from WHEELSEYE API every 60 seconds
- Updates vehicle locations in database
- Shows log messages in terminal
- Runs until you press Ctrl+C

#### When to Use
✅ Testing if sync works  
✅ Troubleshooting sync issues  
✅ Want to see live sync activity  
✅ Manual testing  

⚠️ **If you close this window, sync stops!**

#### Example
```
Open PowerShell or Command Prompt
Type: python sync_worker.py
Watch output...
Press Ctrl+C to stop
```

---

### 3️⃣ Check GPS Sync Status

#### Command
```
python monitor_sync.py
```

#### Purpose
**Quick check: Is sync running? Is data fresh?** - One-time status check.

#### What It Does
- Checks latest GPS timestamp in database
- Calculates data age
- Shows status: 🟢 WORKING or 🔴 NOT WORKING

#### When to Use
✅ After system restart  
✅ Wondering if vehicles show correct status  
✅ Quick health check  
✅ Before troubleshooting  

#### Example
```
Type: python monitor_sync.py
See: "🟢 SYNC IS WORKING - Data is 8.3 min old"
OR: "🔴 SYNC NOT WORKING - Data is 4.5 HOURS old"
```

---

### 3b️⃣ Check Vehicle Status Counts / List STOPPED Vehicles

#### Commands
```
python _check_status.py                 → Summary counts only
python _check_status.py -f STOP        → List all STOPPED vehicles
python _check_status.py -f ALERT       → List ALERT_ADMIN + ALERT_MUNSHI
python _check_status.py -f all         → All 83 vehicles with status + location
```

#### Purpose
**See how many vehicles are STOPPED, ACTIVE, or ALERT — and drill into each group.**

#### What It Does
- Hits `/api/vehicles` and aggregates status counts
- `-f` flag filters to a specific group (substring match)
- Shows vehicle number, status, minutes since last GPS update, and coordinates
- Results sorted longest-stopped-first

#### When to Use
✅ All vehicles show STOP in dashboard  
✅ Want to see which specific vehicles are stuck  
✅ Quick count of active vs stopped  

#### Example Output (`-f STOP`)
```
Status counts: {'STOPPED': 32, 'ACTIVE': 36, 'ALERT_ADMIN': 14, 'ALERT_MUNSHI': 1}
Total: 83

--- STOP vehicles (32) ---
  DL1LX0851     STOPPED         1420m ago    28.574, 76.794
  HR69E3420     STOPPED         1222m ago    28.482, 76.805
  ...
```

---

### 4️⃣ Manual One-Time GPS Sync

#### Command
```
$env:PYTHONIOENCODING='utf-8'; python manual_sync_test.py
```

⚠️ **Always use with `$env:PYTHONIOENCODING='utf-8'`** on Windows PowerShell — otherwise Unicode characters in output cause a crash.

#### Purpose
**Import GPS data once right now** - Useful if sync is not running.

#### What It Does
- Requests data from WHEELSEYE API
- Updates all 83 vehicles in one batch
- Shows how many succeeded
- Doesn't keep running (one-time only)

#### When to Use
✅ Sync is broken and you need GPS now  
✅ System rebooted and sync hasn't started  
✅ Quick one-time data refresh  
✅ Testing API connectivity  

#### Example
```
$env:PYTHONIOENCODING='utf-8'; python manual_sync_test.py
Output:
  API Status: 200
  Found 83 vehicle records
  Inserted 83/83 records into database
  HR69G8046 | 2026-03-09T00:41:08Z | Age: 0.1min  FRESH
```

---

### 5️⃣ Get Vehicle Location

#### Command
```
python get_vehicle_location.py
```

#### Purpose
**Find exact coordinates of a specific vehicle** - Get latitude/longitude for one vehicle.

#### What It Does
- Asks for vehicle number
- Returns current GPS location
- Shows data age
- Provides Google Maps link

#### When to Use
✅ Find where a vehicle is right now  
✅ Track specific delivery  
✅ Verify GPS data is correct  
✅ Need Google Maps link  

#### Example
```
Type: python get_vehicle_location.py
Enter: HR69F7839
Result:
  Vehicle: HR69F7839
  Location: 28.481977, 76.804550
  Age: 12.3 min
  Maps: https://maps.google.com/?q=28.481977,76.804550
```

---

### 6️⃣ Diagnose STOP Status Issues

#### Command
```
python diagnose_stop_issue.py
```

#### Purpose
**Troubleshoot: Why are vehicles showing STOP?** - Deep diagnostic report.

#### What It Does
- Checks GPS data age
- Verifies sync is running
- Shows vehicle status
- Lists problems found
- Suggests fixes

#### When to Use
✅ All vehicles show STOP  
✅ Some vehicles stuck in STOP  
✅ GPS data seems wrong  
✅ Need detailed troubleshooting  

#### Example
```
Type: python diagnose_stop_issue.py
Output shows:
  ✓ Database connection: OK
  ✗ GPS Data Age: 45 minutes (STALE)
  ✗ Sync Worker: NOT RUNNING
  📋 Recommendation: Start sync immediately
```

---

## 📁 CSV IMPORT (POI Management)

### Command Path in UI
```
Go to Dashboard → POI Management → Upload CSV
```

### Purpose
**Add new POIs from CSV file** - Bulk import locations.

### What It Does
- Reads CSV file with POI data
- Keeps all existing POIs (doesn't delete)
- Only adds new POIs not in database
- Updates address/coordinates if matching POI exists in same city/state

**CSV Format Required:**
```
poi_name,address,city,state,latitude,longitude
Hotel ABC,123 Main St,Delhi,Delhi,28.5921,77.2315
Store XYZ,456 Park Rd,Mumbai,Maharashtra,19.0760,72.8777
```

### When to Use
✅ Adding new sets of locations  
✅ Bulk import from external source  
✅ Regular POI updates  

⚠️ **SAFE**: Won't delete existing POIs

---

## 🐍 PYTHON SCRIPTS QUICK REFERENCE

| Script | Purpose | What It Needs | How Often Run |
|--------|---------|--------------|--------------|
| `sync_worker.py` | Continuous GPS sync | Runs forever (60 sec intervals) | Always running |
| `monitor_sync.py` | Check sync status | Quick status check | Daily/as needed |
| `manual_sync_test.py` | One-time GPS import | Test or emergency refresh | On demand |
| `_check_status.py` | Status counts + STOP list | `-f STOP/ALERT/all` filter | On demand |
| `diagnose_stop_issue.py` | Troubleshoot problems | Full diagnostic report | When issues arise |
| `get_vehicle_location.py` | Find vehicle location | Single vehicle lookup | On demand |

---

## 🎯 COMMON SCENARIOS

### Scenario 1: "All Vehicles Show STOP"
```
Step 1: python _check_status.py                              → How many stopped?
Step 2: python monitor_sync.py                               → Is data stale?
Step 3: $env:PYTHONIOENCODING='utf-8'; python manual_sync_test.py  → Force refresh
Step 4: python _check_status.py -f STOP                     → Check remaining
Step 5: If still broken: python diagnose_stop_issue.py
Step 6: python sync_worker.py                                → Keep sync running
```

### Scenario 2: "System Just Booted, Data Not Fresh"
```
Only if auto-start not configured:
Type: python sync_worker.py
(Wait 60 seconds for first API call)
```

### Scenario 3: "Need to Setup Auto-Start"
```
Option A: .\setup_sync_scheduler.bat (easy)
Option B: .\setup_sync_scheduler.ps1 (PowerShell)
```

### Scenario 4: "Check One Vehicle Location"
```
Type: python get_vehicle_location.py
Enter vehicle number when prompted
```

### Scenario 5: "Upload New POIs from File"
```
Go to Dashboard → POI Management
Click "Upload CSV"
Select file
Review results
```

---

## ✅ VERIFICATION CHECKLIST

After setup, verify everything works:

- [ ] Run `python monitor_sync.py` → Status shows 🟢 WORKING
- [ ] GPS data age is < 30 minutes
- [ ] All 83 vehicles show current location
- [ ] All vehicles show correct status (not all STOP)
- [ ] Can upload CSV to POI Management without errors
- [ ] `.\OPERATIONS_MENU.bat` opens and all 9 options work

---

## 🆘 QUICK HELP

**Q: GPS data is old** → Run `$env:PYTHONIOENCODING='utf-8'; python manual_sync_test.py`

**Q: Vehicles all STOP** → Run `python _check_status.py` to count, then `$env:PYTHONIOENCODING='utf-8'; python manual_sync_test.py` to refresh

**Q: Which vehicles are STOP?** → Run `python _check_status.py -f STOP`

**Q: Want auto-start** → Run `.\setup_sync_scheduler.bat` (admin)

**Q: Don't know what to do** → Run `.\OPERATIONS_MENU.bat` and pick option 1-9

**Q: Need to find a vehicle** → Run `python get_vehicle_location.py`

**Q: Something is broken** → Run `python diagnose_stop_issue.py`

---

## 📞 COMMAND EXECUTION QUICK REFERENCE

### Opening PowerShell/Command Prompt
```
Windows Button + R
Type: powershell
Press Enter
```

### Navigate to Project
```
cd "C:\Users\koyna\OneDrive\Desktop\atul-logistics"
```

### Run Commands
```
.\OPERATIONS_MENU.bat                                        (Start interactive menu)
python sync_worker.py                                        (Start sync visible)
python monitor_sync.py                                       (Check status)
$env:PYTHONIOENCODING='utf-8'; python manual_sync_test.py   (One-time sync - use this exact command)
python _check_status.py                                      (Status counts)
python _check_status.py -f STOP                             (List all STOPPED vehicles)
python _check_status.py -f all                              (List all vehicles)
python diagnose_stop_issue.py                                (Troubleshoot)
python get_vehicle_location.py                               (Find vehicle)
.\setup_sync_scheduler.bat                                   (Setup auto-start)
```

### Stop Running Commands
```
Press Ctrl + C
```

---

## 📝 NOTES

- All commands use Python 3.8+
- Database: `fleet_erp_backend_sqlite.db`
- API: WHEELSEYE API via `.env` CLIENT1_API_URL
- Sync Interval: 60 seconds (configurable in `.env`)
- Data Freshness Threshold: 30 minutes

---

**Last Updated:** March 9, 2026

---

## 🐛 KNOWN ISSUES & FIXES

| Issue | Cause | Fix |
|-------|-------|-----|
| `manual_sync_test.py` crashes with UnicodeEncodeError | Windows PowerShell cp1252 encoding | Use `$env:PYTHONIOENCODING='utf-8'; python manual_sync_test.py` |
| All vehicles show STOPPED | GPS sync not running — data goes stale | Run manual sync then start `sync_worker.py` |
| Trip dispatch history shows 0 entries | API was filtering only `ATLOG-` prefix job cards | Fixed in `route_expense_api.py` — now returns all job cards |
