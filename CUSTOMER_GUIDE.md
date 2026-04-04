# 🎯 CUSTOMER QUICK START GUIDE - E-WAY BILL MANAGEMENT

## Three Core Features Available

### 1️⃣ DOWNLOAD E-Way Bills

**When**: After EWBs are assigned to vehicles (Part A + Part B)

**How to Download**:

```bash
# Excel Format (Recommended)
GET http://your-server:3000/api/eway-bills-hub/export/xlsx?client_id=CLIENT_001

# CSV Format (for spreadsheet tools)
GET http://your-server:3000/api/eway-bills-hub/export/csv?client_id=CLIENT_001
```

**What you get**:
- EWB Number, Vehicle Number, Document Number
- From/To Place, From/To POI
- Date, Validity Date
- Total Value, Status
- Movement Type, Supply Type

---

### 2️⃣ EXTEND E-Way Bill Validity

**When**: Vehicle is running late, needs more time beyond validity date

**How to Extend** (Real-time via Masters India):

```bash
POST /api/ewb/extend-validity

{
  "ewb_no": "123456789",
  "from_place": "Mumbai",
  "state_of_consignor": "MH",
  "remaining_distance": 150,
  "vehicle_number": "KJ01AB1234",
  "mode_of_transport": 1
}
```

**Response**: 
```json
{
  "success": true,
  "new_validity": "2026-04-05T18:00:00Z",
  "extended_hours": 24,
  "message": "EWB validity extended until 6:00 PM tomorrow"
}
```

---

### 3️⃣ MONITOR Routes & Vehicle Status (Live Multi-Link)

**When**: You want to see current vehicle positions and which EWBs they're carrying

**Dashboard Endpoint**:

```bash
GET /api/eway-bills-hub/vehicle-movement?client_id=CLIENT_001
```

**View**:
- Show on map: Real-time vehicle location (lat/lng)
- Show POI: Current loading/delivery point
- Show Status: `empty_at_loading` | `in_transit_loaded` | `unloading_at_delivery` | `in_transit_empty`
- Show Linked EWBs: Each vehicle shows which EWBs it's carrying
- Show EWB Count: Number of bills per vehicle

**Auto-Detection**: When vehicle reaches destination POI, system automatically marks EWB as `at_destination`

---

## 📱 UI Integration Example

```html
<div class="ewb-dashboard">
  <!-- Download Section -->
  <section class="download-section">
    <button onclick="downloadExcel()">📥 Export to Excel</button>
    <button onclick="downloadCSV()">📄 Export to CSV</button>
  </section>

  <!-- Extend Section -->
  <section class="extend-section">
    <input type="text" id="ewbNo" placeholder="EWB Number">
    <input type="number" id="distance" placeholder="Remaining KM">
    <button onclick="extendValidity()">⏱️ Extend Validity</button>
  </section>

  <!-- Monitor Section (Map View) -->
  <section class="monitor-section">
    <map id="vehicle-map"></map>
    <div id="vehicle-status-list">
      <!-- Shows each vehicle with linked EWBs -->
    </div>
  </section>
</div>
```

---

## 🔑 Authentication

**Master API Key**: Use this key for all protected API calls

```
Authorization: MasterKey <your-key>
```

**Example**:
```bash
curl -H "Authorization: MasterKey fbb63637102193e03028687bc4c93219" \
  "http://localhost:3000/api/eway-bills-hub/export/xlsx?client_id=CLIENT_001"
```

---

## 📊 Data Available per Vehicle

```json
{
  "vehicle_no": "KJ01AB1234",
  "driver_name": "Raj Kumar",
  "munshi_name": "ARVIND",
  "vehicle_size": "category_3_small",
  
  "latitude": 28.574393,
  "longitude": 76.794338,
  "current_poi_name": "Delhi Hub",
  "current_poi_type": "primary",
  "load_status": "in_transit_loaded",
  
  "active_ewbs": [
    {
      "ewb_no": "123456789",
      "status": "active",
      "to_poi_name": "Bangalore Hub",
      "total_value": 50000
    }
  ],
  "ewb_count": 1,
  "last_seen": "2026-04-04T10:30:00Z"
}
```

---

## 🔄 Auto-Sync Features

The system automatically:
- ✅ Syncs GPS positions every 2 minutes
- ✅ Refreshes EWB data every 4 hours
- ✅ Discovers new EWBs every 30 minutes
- ✅ Detects vehicle arrival at destinations
- ✅ Caches Masters India auth tokens (23h lifespan)

---

## 🚨 Common Scenarios

### Scenario 1: Download today's EWBs
```bash
# Get all active EWBs for today
GET /api/eway-bills-hub/active-list?client_id=CLIENT_001&limit=50
```

### Scenario 2: Check vehicle fuel status
```bash
# While monitoring, vehicle load_status tells you:
# - in_transit_empty → Vehicle traveling without load
# - unloading_at_delivery → Vehicle at destination, unloading
# - in_transit_loaded → Vehicle traveling with EWBs
```

### Scenario 3: Vehicle running late on delivery
```bash
# Check if extension needed:
POST /api/ewb/extend-validity
{
  "ewb_no": "EWB_FROM_ACTIVE_LIST",
  "remaining_distance": 150,
  ...
}
```

---

## 📞 Support

**API Server**: http://localhost:3000  
**Status Page**: http://localhost:3000/health  
**Database**: SQLite (./fleet_erp_backend_sqlite.db)

---

**Last Updated**: 2026-04-04  
**All Features Verified**: ✅ Working
