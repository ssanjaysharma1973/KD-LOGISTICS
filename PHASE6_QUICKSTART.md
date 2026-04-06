# Phase 6 Quick Start Guide

## Backend API Setup & Testing

### Prerequisites
- Python 3.8 or higher installed
- pip package manager
- Backend dependencies installed

### Step 1: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**Required packages:**
- Flask
- Flask-CORS
- requests (for testing)
- sqlite3 (built-in)

### Step 2: Start the Backend Server

```bash
cd backend
python app.py
```

**Expected output:**
```
[INFO] Vehicle Management Module loaded successfully
[INFO] Driver Management Module loaded successfully
[INFO] Trips Management Module loaded successfully
[INFO] Billing & Revenue Management Module loaded successfully
Starting server on 0.0.0.0:3000
```

### Step 3: Verify Server is Running

Open a new terminal and run:
```bash
curl http://localhost:3000/api/health
```

**Expected response:**
```json
{"status": "ok"}
```

### Step 4: Test the APIs

Open another terminal and run the test suite:
```bash
cd backend
python test_apis.py
```

**This will:**
1. Create sample trips
2. Create sample invoices
3. Record payments
4. Display test results with colors
5. Verify all 15+ endpoints are working

### Quick API Tests

#### Create a Trip
```bash
curl -X POST http://localhost:3000/api/trips/add \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": 1,
    "driver_id": 1,
    "origin": "Mumbai",
    "destination": "Bangalore",
    "load_type": "Electronics",
    "weight": 500,
    "distance": 1000,
    "status": "pending"
  }'
```

#### Get All Trips
```bash
curl http://localhost:3000/api/trips/list
```

#### Get Trip Statistics
```bash
curl http://localhost:3000/api/trips/stats
```

#### Create an Invoice
```bash
curl -X POST http://localhost:3000/api/billing/invoices/add \
  -H "Content-Type: application/json" \
  -d '{
    "trip_id": 1,
    "vehicle_id": 1,
    "driver_id": 1,
    "amount": 5000,
    "status": "pending"
  }'
```

#### Get All Invoices
```bash
curl http://localhost:3000/api/billing/invoices
```

#### Get Revenue Summary
```bash
curl http://localhost:3000/api/billing/revenue/summary
```

#### Record Payment
```bash
curl -X POST http://localhost:3000/api/billing/invoices/1/pay \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "payment_method": "bank_transfer",
    "reference_number": "REF123456"
  }'
```

---

## Frontend Integration

The frontend dashboards created in Phase 5 are now ready to use with these API endpoints.

### Connect Frontend to Backend

1. **Update API Base URL** in frontend config:
   ```typescript
   const API_BASE_URL = 'http://localhost:3000';
   ```

2. **Start Frontend Server:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access Dashboard:**
   - Open http://localhost:5173
   - Navigate to "Trips" dashboard
   - Navigate to "Billing & Revenue" dashboard

---

## Database

The backend automatically creates the required tables on first run:

**Tables Created:**
- `trips` - Trip information
- `invoices` - Invoice records
- `payments` - Payment history
- `revenue` - Revenue tracking

**Database File:**
```
backend/fleet_erp_backend_sqlite.db
```

To reset the database:
```bash
rm backend/fleet_erp_backend_sqlite.db
# Restart the server to recreate tables
```

---

## API Documentation

For complete API documentation with all endpoints and parameters, see:
- [PHASE6_API_ENDPOINTS.md](PHASE6_API_ENDPOINTS.md)

---

## Environment Variables (.env)

Create a `.env` file in the backend directory:

```
# Flask Server
API_HOST=0.0.0.0
API_PORT=3000
API_DEBUG=True

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:3001

# Database
DB_PATH=fleet_erp_backend_sqlite.db

# Flask Secret
SECRET_KEY=dev-secret-key-change-in-production
```

---

## Troubleshooting

### Port Already in Use
If port 3000 is already in use:
```bash
# Change port in .env
API_PORT=3001

# Then access on new port
curl http://localhost:3001/api/health
```

### Database Locked Error
```bash
# Close all connections and remove old database
rm backend/fleet_erp_backend_sqlite.db

# Restart the server
python app.py
```

### CORS Errors in Frontend
Make sure `CORS_ORIGINS` includes your frontend URL:
```
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Modules Not Loading
Check Python imports, update requirements:
```bash
pip install --upgrade -r requirements.txt
```

---

## Project Structure

```
backend/
├── api/
│   ├── __init__.py
│   ├── trips.py           ← New in Phase 6
│   ├── billing.py         ← New in Phase 6
│   ├── vehicles.py
│   ├── drivers.py
│   ├── clients.py
│   ├── admins.py
│   └── ... (other modules)
├── app.py                 ← Updated in Phase 6
├── test_apis.py           ← New in Phase 6
├── requirements.txt
├── fleet_erp_backend_sqlite.db
└── .env
```

---

## Popular Use Cases

### 1. Track a Trip
```python
import requests

# Get trip details
trip_id = 1
response = requests.get(f'http://localhost:3000/api/trips/{trip_id}')
trip = response.json()['trip']

print(f"Trip Status: {trip['status']}")
print(f"From: {trip['origin']} To: {trip['destination']}")
```

### 2. Generate Invoice and Track Payment
```python
import requests

# Create invoice
invoice_data = {
    "trip_id": 1,
    "vehicle_id": 1,
    "driver_id": 1,
    "amount": 5000
}
response = requests.post(
    'http://localhost:3000/api/billing/invoices/add',
    json=invoice_data
)
invoice = response.json()['invoice']

# Record payment
payment = {
    "amount": 2500,
    "payment_method": "bank_transfer"
}
response = requests.post(
    f'http://localhost:3000/api/billing/invoices/{invoice["id"]}/pay',
    json=payment
)
```

### 3. Get Revenue Analytics
```python
import requests

# Get monthly revenue
response = requests.get('http://localhost:3000/api/billing/revenue/monthly')
revenue_data = response.json()['revenue']

for month in revenue_data:
    print(f"{month['month']}: ₹{month['revenue']} ({month['trips']} trips)")
```

---

## Next Steps

After Phase 6 is working:

**Phase 7**: Real-time Tracking System
- GPS live tracking
- WebSocket updates
- Route visualization
- Driver location

**Phase 8**: Notifications System
- Email alerts
- SMS notifications
- In-app alerts

**Phase 9**: Reports & Export
- PDF generation
- Excel export
- Custom reports

---

## Support

For issues or questions:
1. Check [PHASE6_API_ENDPOINTS.md](PHASE6_API_ENDPOINTS.md) for API details
2. Run `python test_apis.py` to verify setup
3. Check backend logs for error messages
4. Verify database file permissions

---

**Total API Endpoints in Phase 6**: 15+  
**Status**: ✅ Complete and Ready to Use  
**Last Updated**: April 5, 2026
