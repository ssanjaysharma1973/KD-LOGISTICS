# Quick Start: Automated E-Way Bill Export

## ✅ Pre-Deployment Checklist

- [ ] **Master API Key Generated**
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Key: `_______________________________`

- [ ] **Environment Variable Set**
  ```bash
  # Add to .env
  MASTER_API_KEY=your-key-here
  ```

- [ ] **ExcelJS Installed**
  ```bash
  npm install exceljs
  ```

- [ ] **Export Directory Created**
  ```bash
  mkdir -p /data/exports
  chmod 755 /data/exports
  ```

---

## 🚀 Start Export Scheduler

### Option 1: Automatic (Node.js Startup)
Edit `server.js` - near the end, after route definitions:

```javascript
import exportScheduler from './src/services/exportScheduler.js';
import excelExport from './src/services/excelExport.js';

// Auto-start scheduler on server boot
exportScheduler.scheduleExport(
  async (clientId) => {
    return await sqAll(
      `SELECT * FROM eway_bills_master WHERE client_id=? ORDER BY imported_at DESC`,
      [clientId]
    );
  },
  async (bills, clientId) => {
    return await excelExport.exportEwayBillsToExcel(bills, clientId);
  },
  {
    interval: 'daily',
    hour: 2,  // 2 AM
    clients: ['CLIENT_001', 'CLIENT_002']  // Add your client IDs
  }
);

console.log('Export scheduler initialized');
```

Then start server:
```bash
npm start
```

### Option 2: Manual Cron (Linux/Mac)
```bash
# Edit crontab
crontab -e

# Add: Daily 2 AM export
0 2 * * * curl -s -H "Authorization: MasterKey $MASTER_API_KEY" \
  "http://localhost:3000/api/eway-bills-hub/export/xlsx?client_id=CLIENT_001" \
  -o /data/exports/ewaybills_CLIENT_001_$(date +\%Y-\%m-\%d).xlsx
```

---

## 🧪 Test the System

### 1. Check Scheduler Status
```bash
curl -H "Authorization: MasterKey $MASTER_API_KEY" \
  http://localhost:3000/api/eway-bills-hub/export/status | jq
```

### 2. Trigger Immediate Export
```bash
curl -X POST \
  -H "Authorization: MasterKey $MASTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clients":["CLIENT_001"]}' \
  http://localhost:3000/api/eway-bills-hub/export/run-now | jq
```

### 3. List Recent Exports
```bash
curl -H "Authorization: MasterKey $MASTER_API_KEY" \
  http://localhost:3000/api/eway-bills-hub/export/recent | jq
```

### 4. Download Export
```bash
curl -H "Authorization: MasterKey $MASTER_API_KEY" \
  "http://localhost:3000/api/eway-bills-hub/export/xlsx?client_id=CLIENT_001" \
  -o my_export.xlsx

# Open in Excel to verify
open my_export.xlsx
```

---

## 📊 What Gets Exported

Each Excel file includes:

**Sheet 1: E-Way Bills**
- Bill details with formatting
- Color-coded by status:
  - 🔴 Red = Expired
  - 🟡 Yellow = Expiring soon
  - 🟢 Green = Delivered

**Sheet 2: Summary**
- Total count
- By status breakdown
- Average expiry days

**Sheet 3: Warnings**
- Expired bills (action needed!)
- Bills expiring within 3 days
- Any special alerts

---

## 🔐 Security Notes

✅ **Master API Key Protection**
- Store only in `.env` (never commit)
- Use timing-safe comparison (no timing attacks)
- All exports audited and logged

✅ **Per-Client Isolation**
- Each client's bills exported separately
- Cannot access other client data
- API validates client_id on every request

✅ **Audit Trail**
- Every export logged with timestamp
- Tracks which client, how many bills
- Stored in `/logs/audit.log`

---

## 📁 File Storage

**Location**: `/data/exports/`

**File Names**:
```
ewaybills_CLIENT_001_2024-04-03_0200.xlsx
ewaybills_CLIENT_002_2024-04-03_0200.xlsx
```

**Auto Cleanup**: Keeps last 5 versions per client

---

## 🆘 Common Issues

**1. "Unauthorized" Error**
```
"message": "Unauthorized: Invalid or missing master API key"
```
→ Check MASTER_API_KEY env var is set correctly
→ Verify Authorization header format: `Authorization: MasterKey <key>`

**2. No Files Generated**
→ Check if e-way bills exist: `SELECT COUNT(*) FROM eway_bills_master;`
→ Verify /data/exports/ directory permissions

**3. "ExcelJS not found"**
```bash
npm install exceljs
npm start
```

---

## 📞 Support

See full documentation: `docs/AUTOMATED-EXPORT-SETUP.md`

Need help? Check:
1. Scheduler status: `GET /api/eway-bills-hub/export/status`
2. Recent exports: `GET /api/eway-bills-hub/export/recent`
3. Server logs: `grep "Export\|ERROR" logs/*`

---

**Status**: ✅ Ready to Deploy

All code integrated. Just set environment variables and start!
