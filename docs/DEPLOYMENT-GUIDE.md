# Deployment Guide: Automated E-Way Bill Export System

## System Overview

**What**: Automated client-wise export of e-way bills to Excel/CSV
**When**: Scheduled daily at 2 AM (configurable)
**Who**: Each client gets their own export file
**How**: Master API key for server-to-server automation
**Output**: Formatted Excel with warnings and statistics

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│           Scheduled Export Trigger                  │
│  (Daily 2 AM via Cron/Node.js Scheduler)           │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│    Master API Key Authentication Check              │
│    (Timing-safe comparison with MASTER_API_KEY)    │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│    Query E-Way Bills for Client                    │
│    (SELECT * FROM eway_bills_master WHERE ...)     │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│    Generate Excel/CSV with Formatting              │
│    • Main sheet with color-coding                  │
│    • Summary statistics                            │
│    • Warnings for expired/expiring bills           │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│    Save to /data/exports/                          │
│    Filename: ewaybills_CLIENT_001_2024-04-03.xlsx │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│    Rotate Old Files (Keep 5 per client)            │
│    Log Export Event for Audit Trail                │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│    Client Notified (email/webhook optional)        │
│    Export Ready for Download                       │
└─────────────────────────────────────────────────────┘
```

---

## Pre-Deployment Checklist

### Step 1: Verify Prerequisites
```bash
# Check Node.js version (need 14+)
node --version

# Check npm
npm --version

# Verify database exists
ls -la /data/client_*.db

# Check if server is running
curl http://localhost:3000/api/health || echo "Server not running"
```

### Step 2: Environment Setup
```bash
# Generate secure Master API Key
MASTER_API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo $MASTER_API_KEY

# Add to .env
cat >> .env << EOF

# Export Automation
MASTER_API_KEY=$MASTER_API_KEY
EXPORT_INTERVAL=daily
EXPORT_HOUR=2
EXPORT_CLIENTS=CLIENT_001,CLIENT_002
EOF

# Verify it's set
grep MASTER_API_KEY .env
```

### Step 3: Dependencies
```bash
# Install ExcelJS for advanced formatting
npm install exceljs

# Verify installation
node -e "const ExcelJS = require('exceljs'); console.log('✓ ExcelJS OK')"
```

### Step 4: Create Export Directory
```bash
# Create with proper permissions
mkdir -p /data/exports
chmod 755 /data/exports
chmod 755 /data

# Verify
ls -la /data/ | grep exports
```

---

## Deployment Options

### Option A: Built-in Scheduler (Recommended)

Edit `server.js` - add this near the end (after all routes defined):

```javascript
// Auto-start export scheduler on server startup
if (process.env.EXPORT_INTERVAL) {
  import exportScheduler from './src/services/exportScheduler.js';
  import excelExport from './src/services/excelExport.js';
  
  const scheduler = exportScheduler.scheduleExport(
    // Query function
    async (clientId) => {
      return await sqAll(
        `SELECT * FROM eway_bills_master 
         WHERE client_id=? 
         ORDER BY imported_at DESC 
         LIMIT 10000`,
        [clientId]
      );
    },
    
    // Export function
    async (bills, clientId) => {
      return await excelExport.exportEwayBillsToExcel(bills, clientId);
    },
    
    // Schedule config
    {
      interval: process.env.EXPORT_INTERVAL || 'daily',
      hour: parseInt(process.env.EXPORT_HOUR || '2'),
      clients: (process.env.EXPORT_CLIENTS || 'CLIENT_001').split(','),
    }
  );
  
  console.log('[Init] Export Scheduler:', scheduler.status());
}
```

**Advantages**:
- ✅ Simple setup - just set env vars
- ✅ No external dependencies
- ✅ Runs within Node.js process
- ✅ Full audit logging

**Start**:
```bash
npm start
```

---

### Option B: External Cron Job

**For Linux/Mac**:

```bash
# Edit crontab
crontab -e

# Add this line (exports daily at 2 AM)
0 2 * * * /home/user/kd-logistics/scripts/export-ewaybills.sh

# Create the script: scripts/export-ewaybills.sh
#!/bin/bash
set -a
source /home/user/kd-logistics/.env
set +a

CLIENTS="CLIENT_001 CLIENT_002 CLIENT_003"
for client in $CLIENTS; do
  curl -s -H "Authorization: MasterKey $MASTER_API_KEY" \
    "http://localhost:3000/api/eway-bills-hub/export/xlsx?client_id=$client" \
    -o /data/exports/ewaybills_${client}_$(date +%Y-%m-%d).xlsx
done

# Make executable
chmod +x scripts/export-ewaybills.sh

# Test
bash scripts/export-ewaybills.sh
```

**For Windows (Task Scheduler)**:

1. Create `export-ewaybills.bat`:
```batch
@echo off
setlocal enabledelayedexpansion

REM Load .env variables
for /f "delims== tokens=1,*" %%a in (.env) do set %%a=%%b

REM Export each client
for %%c in (CLIENT_001 CLIENT_002 CLIENT_003) do (
  curl -H "Authorization: MasterKey !MASTER_API_KEY!" ^
    "http://localhost:3000/api/eway-bills-hub/export/xlsx?client_id=%%c" ^
    -o "C:\data\exports\ewaybills_%%c_!date:~-4,4!-!date:~-10,2!-!date:~-7,2!.xlsx"
)
```

2. Open Task Scheduler
   - New Task → "Export E-Way Bills"
   - Trigger: Daily at 2:00 AM
   - Action: Start program → `export-ewaybills.bat`
   - Condition: Run whether user is logged in or not

---

### Option C: Docker Container

**Dockerfile**:
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["npm", "start"]
```

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  kd-logistics:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MASTER_API_KEY=${MASTER_API_KEY}
      - EXPORT_INTERVAL=daily
      - EXPORT_HOUR=2
      - EXPORT_CLIENTS=CLIENT_001,CLIENT_002
      - DATABASE_PATH=/data
    volumes:
      - ./data:/data
      - ./logs:/app/logs
    restart: unless-stopped

  # Optional: Export cron job
  exporter:
    image: curlimages/curl:latest
    entrypoint: /bin/sh
    command: -c "while true; do curl -H 'Authorization: MasterKey $MASTER_API_KEY' http://kd-logistics:3000/api/eway-bills-hub/export/xlsx?client_id=CLIENT_001 -o /exports/ewaybills_CLIENT_001_$(date +%Y-%m-%d).xlsx; sleep 86400; done"
    depends_on:
      - kd-logistics
    environment:
      - MASTER_API_KEY=${MASTER_API_KEY}
    volumes:
      - ./data/exports:/exports
```

**Deploy**:
```bash
docker-compose up -d
docker-compose logs -f kd-logistics
```

---

### Option D: Kubernetes CronJob

**k8s-export-cronjob.yaml**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: kd-logistics-secrets
type: Opaque
stringData:
  master-api-key: "your-master-api-key-here"

---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: eway-bill-export
spec:
  schedule: "0 2 * * *"  # Daily 2 AM UTC
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: eway-export
          containers:
          - name: exporter
            image: curlimages/curl:latest
            command:
            - sh
            - -c
            - |
              set -e
              echo "Starting E-Way Bill Exports..."
              
              for CLIENT in CLIENT_001 CLIENT_002 CLIENT_003; do
                echo "Exporting for $CLIENT"
                curl -H "Authorization: MasterKey $MASTER_API_KEY" \
                  "http://kd-logistics:3000/api/eway-bills-hub/export/xlsx?client_id=$CLIENT" \
                  -o /exports/ewaybills_${CLIENT}_$(date +%Y-%m-%d_%H%M).xlsx
              done
              
              echo "Export complete"
            env:
            - name: MASTER_API_KEY
              valueFrom:
                secretKeyRef:
                  name: kd-logistics-secrets
                  key: master-api-key
            volumeMounts:
            - name: exports
              mountPath: /exports
          volumes:
          - name: exports
            persistentVolumeClaim:
              claimName: eway-exports-pvc
          restartPolicy: OnFailure
```

**Deploy**:
```bash
kubectl create -f k8s-export-cronjob.yaml
kubectl get cronjobs
kubectl get jobs -l app=eway-bill-export
```

---

## Post-Deployment Verification

### 1. Verify Scheduler Status
```bash
curl -H "Authorization: MasterKey $MASTER_API_KEY" \
  http://localhost:3000/api/eway-bills-hub/export/status | jq
```

Expected output:
```json
{
  "lastRun": "2024-04-03T02:00:00Z",
  "nextRun": "2024-04-04T02:00:00Z",
  "lastStatus": "success",
  "totalExported": 156,
  "totalErrors": 0,
  "jobsCount": 2
}
```

### 2. Test Manual Export
```bash
curl -H "Authorization: MasterKey $MASTER_API_KEY" \
  "http://localhost:3000/api/eway-bills-hub/export/xlsx?client_id=CLIENT_001" \
  -o test_export.xlsx

# Verify file
ls -lh test_export.xlsx
file test_export.xlsx  # Should show: Microsoft Excel 2007+
```

### 3. Verify File Storage
```bash
# Check exports directory
ls -lah /data/exports/

# Expected structure:
# -rw-r--r-- ewaybills_CLIENT_001_2024-04-03_0200.xlsx
# -rw-r--r-- ewaybills_CLIENT_002_2024-04-03_0200.xlsx
```

### 4. Check Audit Logs
```bash
# Recent exports logged
tail -20 /logs/audit.log | grep "bulk_export"

# Expected:
# {"timestamp":"2024-04-03T02:00:00Z","level":"INFO","event":"DATA_READ",...,"action":"bulk_export_xlsx"}
```

### 5. List Recent Exports
```bash
curl -H "Authorization: MasterKey $MASTER_API_KEY" \
  http://localhost:3000/api/eway-bills-hub/export/recent?limit=5 | jq
```

---

## Troubleshooting

### Issue: "Unauthorized" Error
```bash
# Verify MASTER_API_KEY is set
echo $MASTER_API_KEY

# Check it matches in .env
grep MASTER_API_KEY .env

# Re-export if needed
export MASTER_API_KEY=$(cat .env | grep MASTER_API_KEY | cut -d= -f2)

# Test with correct header
curl -v -H "Authorization: MasterKey $MASTER_API_KEY" \
  http://localhost:3000/api/eway-bills-hub/export/status
```

### Issue: No Exports Generated
```bash
# Check if bills exist
sqlite3 /data/client_001.db "SELECT COUNT(*) FROM eway_bills_master;"

# Manually trigger
curl -X POST \
  -H "Authorization: MasterKey $MASTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clients":["CLIENT_001"]}' \
  http://localhost:3000/api/eway-bills-hub/export/run-now | jq

# Check for errors in logs
grep -i "error\|export" /logs/*.log | tail -20
```

### Issue: ExcelJS Errors
```bash
# Reinstall
npm install exceljs --save

# Verify
node -e "require('exceljs'); console.log('OK')"

# Restart server
npm start
```

### Issue: Permission Denied on /data/exports
```bash
# Fix permissions
sudo chmod 777 /data/exports
sudo chown node:node /data/exports

# Or for Docker:
docker exec kd-logistics chmod 777 /data/exports
```

---

## Monitoring & Maintenance

### Daily Checks
```bash
# 1. Verify today's exports exist
ls -lah /data/exports/ | grep $(date +%Y-%m-%d)

# 2. Check scheduler status
curl -s -H "Authorization: MasterKey $MASTER_API_KEY" \
  http://localhost:3000/api/eway-bills-hub/export/status | jq .lastStatus

# 3. Check for errors in logs
grep ERROR /logs/audit.log | tail -5
```

### Weekly Maintenance
```bash
# Verify old exports are cleaned up (keep 5)
ls -lah /data/exports/ | wc -l  # Should be < 20 files per client

# Archive old audit logs
tar -czf /backups/audit_$(date +%Y%m%d).tar.gz /logs/audit.log
```

### Monthly Review
```bash
# Export audit summary
curl -s -H "Authorization: MasterKey $MASTER_API_KEY" \
  http://localhost:3000/api/admin/audit-summary?since=2024-03-01 | jq > /backups/audit_march_2024.json

# Check total exports
grep "bulk_export" /logs/audit.log | wc -l
```

---

## Scale Configuration

### For 1-5 Clients
- Option A (Built-in Scheduler) ✅ Recommended
- Frequency: Daily at 2 AM
- Storage: ~1-5 MB per month

### For 5-50 Clients
- Option B (External Cron) + Option A
- Sync exports to S3: `aws s3 sync /data/exports s3://bucket/`
- Consider compression: `gzip /data/exports/*.xlsx`

### For 50+ Clients
- Option D (Kubernetes CronJob)
- Use distributed storage (S3, GCS, Azure Blob)
- Implement export queuing for large datasets

---

## Success Metrics

**After deployment, verify**:
- ✅ Exports run on schedule (check timestamps)
- ✅ All client files present
- ✅ No authorization errors
- ✅ File sizes reasonable (250 KB per 1000 bills)
- ✅ Audit logs contain export events
- ✅ Old files auto-deleted (keep 5 per client)
- ✅ Performance: < 2 seconds per export

---

## Rollback Plan

If issues occur:

```bash
# 1. Stop scheduler
# Edit .env: comment out EXPORT_INTERVAL or restart without it

# 2. Stop cron/service
systemctl stop eway-bill-export  # or equivalent

# 3. Restore from backup
tar -xzf /backups/exports_backup.tar.gz -C /data/

# 4. Verify system still works
curl http://localhost:3000/api/eway-bills-hub/status
```

---

**Deployment Status**: ✅ Production Ready

Choose one option above based on your infrastructure, set environment variables, and start exporting!
