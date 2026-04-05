# 🧪 KD-LOGISTICS SANDBOX TESTING GUIDE

**Created:** April 4, 2026  
**Status:** ✅ Ready for Testing  
**Environment:** Sandbox (Masters India API)

---

## 📋 TEST PREREQUISITES

### ✅ Before You Start:
1. **Server Running Locally**
   ```bash
   npm start
   ```
   Expected: `[SERVER] Listening on http://0.0.0.0:3000`

2. **Environment Variables Set** (in PowerShell)
   ```powershell
   $env:MASTER_API_KEY = "fbb63637102193e03028687bc4c93219"
   $env:MASTERS_API_URL = "https://sandb-api.mastersindia.co"
   $env:MASTERS_USERNAME = "sanjaysec28@gmail.com"
   $env:MASTERS_PASSWORD = "Sanjaysec@123"
   $env:MASTERS_GSTIN = "05AAABC0181E1ZE"
   $env:ATUL_MASTERS_GSTIN = "09AABCH3162L1ZG"
   ```

3. **Database Clean** (verify)
   ```bash
   sqlite3 fleet_erp_backend_sqlite.db "SELECT COUNT(*) FROM eway_bills_master"
   ```
   Expected: `0`

---

## 🧪 TEST STEP 1: VERIFY SERVER IS RUNNING

### Command:
```bash
curl http://localhost:3000/health
```

### Expected Output:
```json
{
  "status": "ok",
  "timestamp": "2026-04-04T10:30:00Z"
}
```

### ✅ Success Indicators:
- [ ] HTTP Status: `200 OK`
- [ ] Response includes `"status": "ok"`
- [ ] Server is accessible

---

## 🧪 TEST STEP 2: CHECK MASTERS API AUTHENTICATION

### Check Server Logs:
Look for this in terminal during startup:

```
[Masters Auth] Sandbox API Authentication
[Masters Auth] ✅ Token cached successfully (expires in 23 hours)
```

### Expected in Logs:
```
[Masters Username] sanjaysec28@gmail.com
[Masters API URL] https://sandb-api.mastersindia.co
[ClientEwbImport] Scheduler started — every 1800s (30 minutes)
```

### ✅ Success Indicators:
- [ ] No "ERROR" or "undefined" messages
- [ ] Token cached successfully message appears
- [ ] ClientEwbImport scheduler started

---

## 🧪 TEST STEP 3: CHECK GPS DATA IMPORT (AutoSync Scheduler)

### Command (in another terminal):
```bash
sqlite3 fleet_erp_backend_sqlite.db "SELECT COUNT(*) FROM gps_current"
```

### Expected Output:
```
86
```
(or similar number of vehicles)

### ✅ Success Indicators:
- [ ] Vehicle count > 0
- [ ] AutoSync scheduler is working (runs every 2 minutes)

### Check Logs for:
```
[upsertGps] CLIENT_001: 86 rows upserted
```

---

## 🧪 TEST STEP 4: MANUAL EWAY BILL IMPORT (Primary Test)

### Command (using PowerShell or cURL):

**Option A: PowerShell**
```powershell
$response = Invoke-WebRequest `
  -Uri "http://localhost:3000/api/client-ops/import/CLIENT_001" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"daysBefore": 7}'

$response.Content | ConvertFrom-Json | Format-Table
```

**Option B: cURL (Git Bash or WSL)**
```bash
curl -X POST http://localhost:3000/api/client-ops/import/CLIENT_001 \
  -H "Content-Type: application/json" \
  -d '{"daysBefore": 7}'
```

### Expected Response (JSON):
```json
{
  "success": true,
  "message": "Import completed",
  "client": "CLIENT_001",
  "timestamp": "2026-04-04T10:35:22Z",
  "results": {
    "imported": 25,
    "updated": 5,
    "errors": 0,
    "duplicates": 0
  }
}
```

### Expected Status: `200 OK`

### ✅ Success Indicators:
- [ ] HTTP Status: `200 OK`
- [ ] `"success": true`
- [ ] `"imported"` count > 0 (e.g., 25)
- [ ] `"errors": 0`
- [ ] `"duplicates": 0`

---

## 🧪 TEST STEP 5: VERIFY DATA IN DATABASE

### Command:
```bash
sqlite3 fleet_erp_backend_sqlite.db "SELECT COUNT(*) FROM eway_bills_master"
```

### Expected Output:
```
25
```
(matches the "imported" count from Step 4)

### ✅ Success Indicators:
- [ ] Count increased from 0 to > 0
- [ ] Count matches import results

---

## 🧪 TEST STEP 6: CHECK IMPORTED DATA DETAILS

### Command (View first 5 e-way bills):
```bash
sqlite3 fleet_erp_backend_sqlite.db \
  "SELECT id, gstin, vehicle_no, origin, destination, FROM eway_bills_master LIMIT 5"
```

### Expected Output:
```
1|09AABCH3162L1ZG|MH-01-AA-1234|Delhi|Mumbai|...|
2|09AABCH3162L1ZG|MH-01-AA-5678|Bangalore|Chennai|...|
3|09AABCH3162L1ZG|GJ-02-AB-9012|Ahmedabad|Pune|...|
4|09AABCH3162L1ZG|UP-03-AC-3456|Lucknow|Noida|...|
5|09AABCH3162L1ZG|KA-04-AD-7890|Bangalore|Hyderabad|...|
```

### ✅ Success Indicators:
- [ ] Data appears correctly formatted
- [ ] All rows have GSTIN: `09AABCH3162L1ZG` (Atul's)
- [ ] Vehicle numbers follow format: `STATE-CODE-LETTERS-NUMBERS`
- [ ] Origin and destination cities populated

---

## 🧪 TEST STEP 7: CHECK LOGS FOR ERRORS

### Command (Search for error patterns):
```powershell
cd "C:\Users\koyna\Documents\KD-LOGISTICS"
Get-Content npm-debug.log -Tail 50 | Select-String -Pattern "ERROR|FAIL|undefined|cannot"
```

### Expected Output:
```
(empty - no errors)
```

### ✅ Success Indicators:
- [ ] No error messages
- [ ] No "undefined" references
- [ ] No "cannot read property" errors

### If you see errors, check for:
```
❌ [EWB AutoRefresh] DISABLED - Awaiting sandbox API approval
   (This is EXPECTED - schedulers are intentionally disabled)

✓ [AutoSync] Scheduler started — every 120s
✓ [ClientEwbImport] Scheduler started — every 1800s
```

---

## 🧪 TEST STEP 8: RETRY IMPORT AFTER 30 SECONDS

### Wait 30 seconds, then:
```powershell
$response = Invoke-WebRequest `
  -Uri "http://localhost:3000/api/client-ops/import/CLIENT_001" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"daysBefore": 7}'

$response.Content | ConvertFrom-Json
```

### Expected Response:
```json
{
  "success": true,
  "results": {
    "imported": 0,
    "updated": 0,
    "errors": 0,
    "duplicates": 25
  }
}
```

### ✅ Success Indicators:
- [ ] HTTP Status: `200 OK`
- [ ] `"duplicates": 25` (shows deduplication working)
- [ ] `"imported": 0` (no new data - already in DB)
- [ ] `"errors": 0` (no issues processing)

---

## 🧪 TEST STEP 9: VERIFY DASHBOARD ACCESS

### Command:
```bash
curl http://localhost:3000/
```

Or visit in browser: `http://localhost:3000`

### Expected Output:
- Dashboard loads successfully
- No 404 errors
- React/Vue frontend renders

### ✅ Success Indicators:
- [ ] HTTP Status: `200 OK`
- [ ] HTML content returned
- [ ] Dashboard page loads in browser

---

## 🧪 TEST STEP 10: CHECK PRODUCTION DEPLOYMENT (OPTIONAL)

### Command:
```bash
curl https://kd-logistics-production.up.railway.app/health
```

### Expected Output:
```json
{
  "status": "ok",
  "timestamp": "2026-04-04T10:40:00Z"
}
```

### ✅ Success Indicators:
- [ ] HTTP Status: `200 OK`
- [ ] Production server responding
- [ ] Same response as local server

---

## 📊 FULL TEST CHECKLIST

### Phase 1: Server Readiness
- [ ] Server running on port 3000
- [ ] /health endpoint responds with 200 OK
- [ ] No startup errors in logs

### Phase 2: Authentication
- [ ] Masters API token cached successfully
- [ ] No auth errors in logs
- [ ] ClientEwbImport scheduler initialized

### Phase 3: Data Import
- [ ] Manual import endpoint returns 200 OK
- [ ] Import results show > 0 imported records
- [ ] Database count increased
- [ ] Duplicate detection working on retry

### Phase 4: Verification
- [ ] Database contains correct data
- [ ] GSTIN matches expected (09AABCH3162L1ZG)
- [ ] Vehicle data formatted correctly
- [ ] No errors in logs

### Phase 5: Production
- [ ] Production server accessible
- [ ] Production returns same health status

---

## 🎯 EXPECTED SUMMARY

After completing all tests:

✅ **Server Status:** Running  
✅ **API Status:** Responding  
✅ **Authentication:** Successful  
✅ **Data Import:** Working (25+ bills imported)  
✅ **Database:** Clean and populated  
✅ **Logs:** No critical errors  
✅ **Schedulers:** Active (AutoSync, ClientEwbImport)  
❌ **EWB AutoRefresh:** Disabled (pending approval)  

---

## 🔄 NEXT STEPS

1. **Approve Sandbox API** - Contact Masters India for auto-import approval
2. **Re-enable Schedulers** - Uncomment lines 4444-4445 in `server.js`
3. **Deploy to Production** - Push updated code to Railway
4. **Switch to Production API** - Update MASTERS_API_URL when ready

---

## 📞 TROUBLESHOOTING

### Issue: Port 3000 Already in Use
```powershell
Get-Process -Name "node" | Stop-Process -Force
```

### Issue: Database Lock
```powershell
sqlite3 fleet_erp_backend_sqlite.db "PRAGMA wal_checkpoint(RESTART)"
```

### Issue: Import Returns 0 Bills
- Check Masters API credentials are correct
- Verify daysBefore parameter (try 30 instead of 7)
- Check GSTIN has bills in Masters India system

### Issue: "sqAll is not defined" Error
- This means EWB schedulers running (should be disabled now)
- Verify server.js lines 4444-4445 are still commented out
- Restart server

---

## 📝 NOTES

- All tests should complete within **5 minutes**
- Expected imported e-way bills: **20-50** (depends on Masters India data)
- Duplicate detection: **Automatic** (no duplicate bills inserted)
- GPS data: **Updates every 2 minutes** (AutoSync scheduler)
- Manual import: **Available anytime** via API endpoint

---

**Last Updated:** April 4, 2026  
**Status:** ✅ READY FOR TESTING
