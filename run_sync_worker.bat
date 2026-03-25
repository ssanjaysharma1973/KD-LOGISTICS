@echo off
REM GPS Sync Worker - Batch launcher with environment variablesmarker movement
REM Sets required environment variables and starts sync_worker.py

cd /d "C:\Users\koyna\OneDrive\Desktop\atul-logistics"

set CLIENT1_ID=CLIENT_001
set CLIENT1_PROVIDER=https://api.wheelseye.com/currentLoc?accessToken=1851c6a3-ef52-4ec3-b470-759908fa0408
set CLIENT1_SYNC_INTERVAL=30
set DB_PATH=fleet_erp_backend_sqlite.db

echo [%date% %time%] Starting GPS Sync Worker... >> sync_worker_startup.log

"C:\Users\koyna\OneDrive\Desktop\atul-logistics\.venv\Scripts\python.exe" sync_worker.py >> sync_worker_stdout.log 2>&1
