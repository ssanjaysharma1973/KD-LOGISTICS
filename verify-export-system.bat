@echo off
REM ============================================================================
REM Pre-Deployment Verification Script (Windows)
REM Tests all components of the Automated E-Way Bill Export System
REM Usage: verify-export-system.bat
REM ============================================================================

setlocal enabledelayedexpansion

REM Variables
set PASS=0
set FAIL=0
set WARN=0

REM ============================================================================
echo.
echo ============================================================================
echo  AUTOMATED E-WAY BILL EXPORT SYSTEM - PRE-DEPLOYMENT CHECK (Windows)
echo ============================================================================
echo.

REM ============================================================================
echo [1/10] ENVIRONMENT ^& PREREQUISITES
echo.

REM Check Node.js
where node >nul 2>&1
if !errorlevel! equ 0 (
  for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
  echo [PASS] Node.js installed: !NODE_VERSION!
  set /a PASS+=1
) else (
  echo [FAIL] Node.js not found
  set /a FAIL+=1
)

REM Check npm
where npm >nul 2>&1
if !errorlevel! equ 0 (
  for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
  echo [PASS] npm installed: !NPM_VERSION!
  set /a PASS+=1
) else (
  echo [FAIL] npm not found
  set /a FAIL+=1
)

REM Check .env file
if exist ".env" (
  echo [PASS] .env file exists
  set /a PASS+=1
) else (
  echo [WARN] .env file not found
  set /a WARN+=1
)

echo.

REM ============================================================================
echo [2/10] MASTER API KEY CONFIGURATION
echo.

REM Check MASTER_API_KEY
if defined MASTER_API_KEY (
  setlocal enabledelayedexpansion
  set KEY_LEN=0
  for /L %%A in (0,1,100) do (
    if defined MASTER_API_KEY (
      set "TEST=!MASTER_API_KEY:~0,%%A!"
      if "!TEST!" neq "!MASTER_API_KEY!" (
        set KEY_LEN=%%A
        goto :key_len_found
      )
    )
  )
  :key_len_found
  if !KEY_LEN! geq 32 (
    echo [PASS] MASTER_API_KEY set (length: !KEY_LEN!)
    set /a PASS+=1
  ) else (
    echo [WARN] MASTER_API_KEY too short (length: !KEY_LEN!, need 32+)
    set /a WARN+=1
  )
  endlocal enabledelayedexpansion
) else (
  echo [FAIL] MASTER_API_KEY not set in environment
  echo        Add to .env and run: set /p MASTER_API_KEY=^<.env
  set /a FAIL+=1
)

echo.

REM ============================================================================
echo [3/10] DEPENDENCIES
echo.

REM Check package.json
if exist "package.json" (
  echo [PASS] package.json exists
  set /a PASS+=1
  
  REM Check for ExcelJS
  find /I "exceljs" package.json >nul 2>&1
  if !errorlevel! equ 0 (
    echo [PASS] exceljs in package.json
    set /a PASS+=1
  ) else (
    echo [WARN] exceljs not in package.json - required for Excel export
    set /a WARN+=1
  )
) else (
  echo [FAIL] package.json not found
  set /a FAIL+=1
)

REM Test ExcelJS
node -e "require('exceljs')" >nul 2>&1
if !errorlevel! equ 0 (
  echo [PASS] exceljs module loadable
  set /a PASS+=1
) else (
  echo [WARN] exceljs not installed in node_modules
  echo        Run: npm install exceljs
  set /a WARN+=1
)

echo.

REM ============================================================================
echo [4/10] CODEBASE
echo.

REM Check core files
set FILES[0]=src\middleware\masterKeyAuth.js
set FILES[1]=src\services\excelExport.js
set FILES[2]=src\services\exportScheduler.js
set FILES[3]=src\middleware\auditLogger.js

for /L %%i in (0,1,3) do (
  if exist "!FILES[%%i]!" (
    echo [PASS] !FILES[%%i]! exists
    set /a PASS+=1
  ) else (
    echo [FAIL] !FILES[%%i]! not found
    set /a FAIL+=1
  )
)

REM Check if server.js has export endpoints
find /I "export/xlsx" server.js >nul 2>&1
if !errorlevel! equ 0 (
  echo [PASS] Export endpoints in server.js
  set /a PASS+=1
) else (
  echo [FAIL] Export endpoints not found in server.js
  set /a FAIL+=1
)

echo.

REM ============================================================================
echo [5/10] DATABASE
echo.

REM Check client databases
if exist "data\client_001.db" (
  echo [PASS] Found client database files
  set /a PASS+=1
) else (
  echo [WARN] No client database files found yet
  echo        They'll be created on first insert
  set /a WARN+=1
)

echo.

REM ============================================================================
echo [6/10] FILE SYSTEM
echo.

REM Check export directory
if exist "C:\data\exports" (
  echo [PASS] C:\data\exports exists
  set /a PASS+=1
) else (
  echo [WARN] C:\data\exports not found
  echo        Will be created on first export
  set /a WARN+=1
)

REM Check logs directory
if exist "logs" (
  echo [PASS] logs directory exists
  set /a PASS+=1
) else (
  echo [WARN] logs directory not found
  echo        Will be created on first log entry
  set /a WARN+=1
)

echo.

REM ============================================================================
echo [7/10] SERVER CONNECTIVITY
echo.

where curl >nul 2>&1
if !errorlevel! equ 0 (
  curl -s http://localhost:3000/api/health >nul 2>&1
  if !errorlevel! equ 0 (
    echo [PASS] Server running on http://localhost:3000
    set /a PASS+=1
  ) else (
    echo [WARN] Cannot reach http://localhost:3000
    echo        Start server with: npm start
    set /a WARN+=1
  )
) else (
  echo [WARN] curl not found - cannot test connectivity
  set /a WARN+=1
)

echo.

REM ============================================================================
echo [8/10] CONFIGURATION VALIDATION
echo.

if exist ".env" (
  echo Checking .env variables...
  
  find /I "MASTER_API_KEY=" .env >nul 2>&1
  if !errorlevel! equ 0 (
    echo [PASS] MASTER_API_KEY in .env
    set /a PASS+=1
  ) else (
    echo [FAIL] MASTER_API_KEY missing from .env
    set /a FAIL+=1
  )
  
  find /I "EXPORT_INTERVAL=" .env >nul 2>&1
  if !errorlevel! equ 0 (
    echo [PASS] EXPORT_INTERVAL configured in .env
    set /a PASS+=1
  ) else (
    echo [WARN] EXPORT_INTERVAL not set - will default to daily
    set /a WARN+=1
  )
  
  find /I "EXPORT_CLIENTS=" .env >nul 2>&1
  if !errorlevel! equ 0 (
    echo [PASS] EXPORT_CLIENTS configured in .env
    set /a PASS+=1
  ) else (
    echo [WARN] EXPORT_CLIENTS not set - auto-export won't run
    set /a WARN+=1
  )
)

echo.

REM ============================================================================
echo [9/10] API ENDPOINT TESTS
echo.

where curl >nul 2>&1
if !errorlevel! equ 0 (
  if defined MASTER_API_KEY (
    echo Testing API endpoints...
    
    curl -s -H "Authorization: MasterKey !MASTER_API_KEY!" ^
      http://localhost:3000/api/eway-bills-hub/export/status >nul 2>&1
    
    if !errorlevel! equ 0 (
      echo [PASS] GET /api/eway-bills-hub/export/status ^<= OK
      set /a PASS+=1
    ) else (
      echo [WARN] Export status endpoint not responding
      set /a WARN+=1
    )
  )
)

echo.

REM ============================================================================
echo [10/10] SUMMARY
echo.

set /a TOTAL=%PASS% + %FAIL% + %WARN%

echo Passed:   %PASS%
if %WARN% gtr 0 echo Warnings: %WARN%
if %FAIL% gtr 0 echo Failed:   %FAIL%
echo.
echo Total checks: %TOTAL%

echo.
echo ============================================================================

if %FAIL% equ 0 (
  echo [SUCCESS] SYSTEM READY FOR DEPLOYMENT
  echo.
  echo Next steps:
  echo.
  echo 1. Ensure environment variables are set:
  echo    - MASTER_API_KEY (from .env)
  echo.
  echo 2. Install dependencies if needed:
  echo    npm install exceljs
  echo.
  echo 3. Start the server (scheduler will auto-start):
  echo    npm start
  echo.
  echo 4. Monitor exports:
  echo    curl -H "Authorization: MasterKey %MASTER_API_KEY%" ^
  echo      http://localhost:3000/api/eway-bills-hub/export/status
  echo.
  echo 5. Check generated files:
  echo    dir C:\data\exports\
  echo.
  
  exit /b 0
) else (
  echo [WARNING] ISSUES FOUND - PLEASE FIX BEFORE DEPLOYMENT
  echo.
  echo Please fix the %FAIL% failed checks above and re-run this script.
  echo.
  exit /b 1
)

REM ============================================================================
echo.
echo DOCUMENTATION
echo.
echo For more details, see:
echo   * docs/AUTOMATED-EXPORT-SETUP.md - Detailed setup
echo   * docs/QUICK-START-EXPORT.md - Quick start
echo   * docs/DEPLOYMENT-GUIDE.md - Deployment guide
echo   * docs/LEVEL-5-AUDIT-IMPLEMENTATION.md - Audit system
echo.

endlocal
