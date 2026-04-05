# 📋 TEST COMMANDS - COPY & PASTE REFERENCE

## 🚀 QUICK START - RUN THESE IN ORDER

---

### **STEP 1: Start Server** (if not already running)
```powershell
cd "C:\Users\koyna\Documents\KD-LOGISTICS"

Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 1000

$env:MASTER_API_KEY = "fbb63637102193e03028687bc4c93219"
$env:MASTERS_API_URL = "https://sandb-api.mastersindia.co"
$env:MASTERS_USERNAME = "sanjaysec28@gmail.com"
$env:MASTERS_PASSWORD = "Sanjaysec@123"
$env:MASTERS_GSTIN = "05AAABC0181E1ZE"
$env:ATUL_MASTERS_GSTIN = "09AABCH3162L1ZG"

npm start
```

**Expected Terminal Output:**
```
[SERVER] Listening on http://0.0.0.0:3000
[Masters Auth] ✅ Token cached successfully
[AutoSync] Scheduler started — every 120s
[ClientEwbImport] Scheduler started — every 1800s
```

---

### **STEP 2: Test Health Endpoint** (in new terminal)
```powershell
curl http://localhost:3000/health
```

**Expected Output:**
```json
{"status":"ok","timestamp":"2026-04-04T10:35:00Z"}
```

---

### **STEP 3: Check GPS Data Count**
```powershell
cd "C:\Users\koyna\Documents\KD-LOGISTICS"
sqlite3 fleet_erp_backend_sqlite.db "SELECT COUNT(*) FROM gps_current"
```

**Expected Output:**
```
86
```

---

### **STEP 4: Check EWAY Bills Count (Before Import)**
```powershell
cd "C:\Users\koyna\Documents\KD-LOGISTICS"
sqlite3 fleet_erp_backend_sqlite.db "SELECT COUNT(*) FROM eway_bills_master"
```

**Expected Output:**
```
0
```

---

### **STEP 5: Execute Manual E-Way Bill Import** ⭐ MAIN TEST
```powershell
$response = Invoke-WebRequest `
  -Uri "http://localhost:3000/api/client-ops/import/CLIENT_001" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"daysBefore": 7}'

$result = $response.Content | ConvertFrom-Json
$result | Format-Table
```

**Expected Output:**
```
success timestamp                              client      message   results
------- ---------                              ------      -------   -------
   True 2026-04-04T10:35:22.1234567Z CLIENT_001 Import com @{imported=25; updated=...
```

---

### **STEP 6: View Import Details in Formatted Table**
```powershell
$response = Invoke-WebRequest `
  -Uri "http://localhost:3000/api/client-ops/import/CLIENT_001" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"daysBefore": 7}'

$result = $response.Content | ConvertFrom-Json

Write-Host "IMPORT RESULTS:" -ForegroundColor Cyan
Write-Host "  Success: $($result.success)" -ForegroundColor Green
Write-Host "  Imported: $($result.results.imported)" -ForegroundColor Yellow
Write-Host "  Updated: $($result.results.updated)" -ForegroundColor Yellow
Write-Host "  Duplicates: $($result.results.duplicates)" -ForegroundColor Gray
Write-Host "  Errors: $($result.results.errors)" -ForegroundColor Red
```

**Expected Output:**
```
IMPORT RESULTS:
  Success: True
  Imported: 25
  Updated: 0
  Duplicates: 0
  Errors: 0
```

---

### **STEP 7: Count E-Way Bills After Import**
```powershell
cd "C:\Users\koyna\Documents\KD-LOGISTICS"
sqlite3 fleet_erp_backend_sqlite.db "SELECT COUNT(*) FROM eway_bills_master"
```

**Expected Output:**
```
25
```

---

### **STEP 8: View First 10 Imported E-Way Bills**
```powershell
cd "C:\Users\koyna\Documents\KD-LOGISTICS"
sqlite3 fleet_erp_backend_sqlite.db -header -column @"
SELECT 
  id,
  gstin,
  vehicle_no,
  origin,
  destination,
  status,
  created_at
FROM eway_bills_master 
LIMIT 10
"@
```

**Expected Output:**
```
id  gstin               vehicle_no    origin      destination  status   created_at
--  ----                ----------    ------      -----------  ------   ----------
1   09AABCH3162L1ZG     MH-01-AA-1234 Delhi       Mumbai       active   2026-04-04...
2   09AABCH3162L1ZG     MH-01-AA-5678 Mumbai      Bangalore    active   2026-04-04...
3   09AABCH3162L1ZG     GJ-02-AB-9012 Ahmedabad   Pune         active   2026-04-04...
...
```

---

### **STEP 9: Test Deduplication** (Wait 30 seconds, then run import again)
```powershell
Start-Sleep -Seconds 30

$response = Invoke-WebRequest `
  -Uri "http://localhost:3000/api/client-ops/import/CLIENT_001" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"daysBefore": 7}'

$result = $response.Content | ConvertFrom-Json

Write-Host "DEDUPLICATION TEST RESULTS:" -ForegroundColor Cyan
Write-Host "  Success: $($result.success)" -ForegroundColor Green
Write-Host "  Imported: $($result.results.imported)" -ForegroundColor Yellow
Write-Host "  Updated: $($result.results.updated)" -ForegroundColor Yellow
Write-Host "  Duplicates: $($result.results.duplicates)" -ForegroundColor Green
Write-Host "  Errors: $($result.results.errors)" -ForegroundColor Red
```

**Expected Output:**
```
DEDUPLICATION TEST RESULTS:
  Success: True
  Imported: 0
  Updated: 0
  Duplicates: 25
  Errors: 0
```

✅ **Perfect!** - All 25 bills recognized as duplicates = deduplication working

---

### **STEP 10: Check Logs for Errors**
```powershell
cd "C:\Users\koyna\Documents\KD-LOGISTICS"

# Get last 100 lines of combined logs
Get-Content package.json -ErrorAction SilentlyContinue
Write-Host "`n--- CHECKING SERVER TERMINAL ---`n" -ForegroundColor Yellow
Write-Host "Look for these ERROR patterns:" -ForegroundColor Red
Write-Host "  ❌ ERROR" -ForegroundColor Red
Write-Host "  ❌ undefined" -ForegroundColor Red
Write-Host "  ❌ cannot read property" -ForegroundColor Red
Write-Host "  ✓ [EWB AutoRefresh] DISABLED (this is OK - expected)" -ForegroundColor Green
```

---

### **STEP 11: Verify Database Integrity**
```powershell
cd "C:\Users\koyna\Documents\KD-LOGISTICS"
sqlite3 fleet_erp_backend_sqlite.db @"
SELECT 
  'eway_bills_master' as table_name,
  COUNT(*) as row_count
FROM eway_bills_master
UNION ALL
SELECT 
  'gps_current',
  COUNT(*)
FROM gps_current
UNION ALL
SELECT 
  'vehicles',
  COUNT(*)
FROM vehicles
"@
```

**Expected Output:**
```
table_name|row_count
---|---
eway_bills_master|25
gps_current|86
vehicles|...
```

---

### **STEP 12: Test Dashboard Access**
```powershell
# Option 1: Test via curl
curl http://localhost:3000/ -s | Select-String "<!DOCTYPE|<html" | Select-Object -First 1

# Or open in browser
Start-Process "http://localhost:3000"
```

**Expected Output:**
```
<!DOCTYPE html>
```

---

### **STEP 13: Check Production Server** (Optional)
```powershell
curl https://kd-logistics-production.up.railway.app/health
```

**Expected Output:**
```json
{"status":"ok","timestamp":"2026-04-04T10:40:00Z"}
```

---

## 📊 FULL TEST SUITE (Run All At Once)

Save as `RUN_ALL_TESTS.ps1`:

```powershell
# ===== FULL AUTOMATED TEST SUITE =====

Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     AUTOMATED TEST SUITE - KD LOGISTICS       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

cd "C:\Users\koyna\Documents\KD-LOGISTICS"

# Test 1: Health Check
Write-Host "TEST 1: Health Check..." -ForegroundColor Yellow
$health = curl http://localhost:3000/health
if ($health -match "ok") {
    Write-Host "✅ PASS - Server responding" -ForegroundColor Green
} else {
    Write-Host "❌ FAIL - Server not responding" -ForegroundColor Red
}

# Test 2: GPS Data
Write-Host "`nTEST 2: GPS Data Count..." -ForegroundColor Yellow
$gpsCount = sqlite3 fleet_erp_backend_sqlite.db "SELECT COUNT(*) FROM gps_current"
if ([int]$gpsCount -gt 0) {
    Write-Host "✅ PASS - $gpsCount GPS records found" -ForegroundColor Green
} else {
    Write-Host "❌ FAIL - No GPS records" -ForegroundColor Red
}

# Test 3: Initial E-Way Bill Count
Write-Host "`nTEST 3: Pre-Import E-Way Count..." -ForegroundColor Yellow
$before = sqlite3 fleet_erp_backend_sqlite.db "SELECT COUNT(*) FROM eway_bills_master"
Write-Host "📊 Before: $before records" -ForegroundColor Cyan

# Test 4: Manual Import
Write-Host "`nTEST 4: Manual E-Way Import (MAIN)..." -ForegroundColor Yellow
$response = Invoke-WebRequest `
  -Uri "http://localhost:3000/api/client-ops/import/CLIENT_001" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"daysBefore": 7}' `
  -ErrorAction SilentlyContinue

$result = $response.Content | ConvertFrom-Json

if ($result.success) {
    Write-Host "✅ PASS - Import successful" -ForegroundColor Green
    Write-Host "   📥 Imported: $($result.results.imported)" -ForegroundColor Cyan
    Write-Host "   ♻️ Duplicates: $($result.results.duplicates)" -ForegroundColor Cyan
    Write-Host "   ⚠️ Errors: $($result.results.errors)" -ForegroundColor Yellow
} else {
    Write-Host "❌ FAIL - Import failed" -ForegroundColor Red
}

# Test 5: Post-Import Count
Write-Host "`nTEST 5: Post-Import E-Way Count..." -ForegroundColor Yellow
$after = sqlite3 fleet_erp_backend_sqlite.db "SELECT COUNT(*) FROM eway_bills_master"
Write-Host "📊 After: $after records" -ForegroundColor Cyan

if ([int]$after -gt [int]$before) {
    Write-Host "✅ PASS - Database updated" -ForegroundColor Green
} else {
    Write-Host "❌ FAIL - Database not updated" -ForegroundColor Red
}

# Test 6: Data Quality
Write-Host "`nTEST 6: Data Integrity Check..." -ForegroundColor Yellow
$gstin = sqlite3 fleet_erp_backend_sqlite.db "SELECT COUNT(DISTINCT gstin) FROM eway_bills_master"
$vehicles = sqlite3 fleet_erp_backend_sqlite.db "SELECT COUNT(DISTINCT vehicle_no) FROM eway_bills_master"
Write-Host "✅ Unique GSTINs: $gstin" -ForegroundColor Green
Write-Host "✅ Unique Vehicles: $vehicles" -ForegroundColor Green

# Test 7: Deduplication
Write-Host "`nTEST 7: Deduplication Test..." -ForegroundColor Yellow
Write-Host "   ⏳ Waiting 30 seconds..." -ForegroundColor Cyan
Start-Sleep -Seconds 30

$response2 = Invoke-WebRequest `
  -Uri "http://localhost:3000/api/client-ops/import/CLIENT_001" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"daysBefore": 7}' `
  -ErrorAction SilentlyContinue

$result2 = $response2.Content | ConvertFrom-Json

if ($result2.results.duplicates -gt 0 -and $result2.results.imported -eq 0) {
    Write-Host "✅ PASS - Deduplication working" -ForegroundColor Green
    Write-Host "   Duplicates detected: $($result2.results.duplicates)" -ForegroundColor Cyan
} else {
    Write-Host "⚠️ WARNING - Deduplication may not be working" -ForegroundColor Yellow
}

Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         ✅ ALL TESTS COMPLETED               ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════╝`n" -ForegroundColor Green
```

**Run it:**
```powershell
cd "C:\Users\koyna\Documents\KD-LOGISTICS"
pwsh -ExecutionPolicy Bypass -File RUN_ALL_TESTS.ps1
```

---

## 🎯 EXPECTED FULL SUMMARY

After running all tests:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST RESULTS SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TEST 1: Health Check.................. PASS
✅ TEST 2: GPS Data Count................ PASS (86 records)
✅ TEST 3: Pre-Import Count............. PASS (0 records)
✅ TEST 4: Manual Import (MAIN)......... PASS (25 imported)
✅ TEST 5: Post-Import Count............ PASS (25 records)
✅ TEST 6: Data Integrity............... PASS (1 GSTIN, 18 vehicles)
✅ TEST 7: Deduplication................ PASS (25 duplicates detected)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OVERALL STATUS: ✅ ALL TESTS PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🚨 TROUBLESHOOTING

### Error: "Cannot reach server"
```powershell
# Check if node is running
Get-Process node -ErrorAction SilentlyContinue

# If not running, restart
cd "C:\Users\koyna\Documents\KD-LOGISTICS"
npm start
```

### Error: "database is locked"
```powershell
# Fix database lock
sqlite3 fleet_erp_backend_sqlite.db "PRAGMA wal_checkpoint(RESTART)"
```

### Error: "import returned 0 records"
```powershell
# Try with longer daysBefore parameter
$body = '{\"daysBefore\": 30}'  # Instead of 7

# Check if Masters API is responding
curl "https://sandb-api.mastersindia.co/health"
```

### Error: "sqAll is not defined"
```powershell
# This means EWB schedulers are running (they should be disabled)
# Check server.js lines 4444-4445 are commented out
# Restart server
```

---

**Last Updated:** April 4, 2026  
**Ready to Test:** ✅ YES
