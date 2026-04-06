# Phase 6: Backend API Endpoints

## Overview
Phase 6 implements complete REST API endpoints for Trip Management and Billing & Revenue Management, making the frontend dashboards fully functional with backend support.

## API Endpoints Created

### Trips Management API (`/api/trips`)

#### 1. List Trips
- **GET** `/api/trips/list`
- **Query Parameters:**
  - `status` (optional): Filter by trip status (pending, in-progress, completed)
  - `driver_id` (optional): Filter by driver
  - `vehicle_id` (optional): Filter by vehicle
- **Response:** Array of trips

```bash
curl http://localhost:3000/api/trips/list?status=completed
```

#### 2. Create Trip
- **POST** `/api/trips/add`
- **Required Fields:**
  - `vehicle_id`: ID of assigned vehicle
  - `driver_id`: ID of assigned driver
  - `origin`: Starting location
  - `destination`: Ending location
- **Optional Fields:**
  - `load_type`: Type of cargo
  - `weight`: Cargo weight (kg)
  - `distance`: Trip distance (km)
  - `status`: Trip status (pending, in-progress, completed)

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

#### 3. Get Trip Details
- **GET** `/api/trips/<trip_id>`
- **Response:** Single trip object with all details

```bash
curl http://localhost:3000/api/trips/1
```

#### 4. Update Trip
- **PUT** `/api/trips/<trip_id>`
- **Updatable Fields:**
  - `status`: Update trip status
  - `started_at`: When trip started
  - `completed_at`: When trip completed
  - `notes`: Trip notes

```bash
curl -X PUT http://localhost:3000/api/trips/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in-progress",
    "started_at": "2026-04-05T10:30:00"
  }'
```

#### 5. Delete Trip
- **DELETE** `/api/trips/<trip_id>`
- **Response:** Success message

```bash
curl -X DELETE http://localhost:3000/api/trips/1
```

#### 6. Get Trip Statistics
- **GET** `/api/trips/stats`
- **Response:** Statistics including:
  - Total trips count
  - Completed trips count
  - Active trips count
  - Pending trips count
  - Total distance covered
  - Total weight transported

```bash
curl http://localhost:3000/api/trips/stats
```

### Billing & Revenue Management API (`/api/billing`)

#### 1. List Invoices
- **GET** `/api/billing/invoices`
- **Query Parameters:**
  - `status` (optional): Filter by invoice status (pending, paid, overdue)
  - `vehicle_id` (optional): Filter by vehicle
  - `trip_id` (optional): Filter by trip
- **Response:** Array of invoices

```bash
curl http://localhost:3000/api/billing/invoices?status=pending
```

#### 2. Create Invoice
- **POST** `/api/billing/invoices/add`
- **Required Fields:**
  - `trip_id`: Associated trip ID
  - `vehicle_id`: Associated vehicle ID
  - `driver_id`: Associated driver ID
  - `amount`: Invoice amount
- **Optional Fields:**
  - `status`: Invoice status (pending, paid, overdue)

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

#### 3. Get Invoice Details
- **GET** `/api/billing/invoices/<invoice_id>`
- **Response:** Invoice with complete payment history

```bash
curl http://localhost:3000/api/billing/invoices/1
```

#### 4. Record Payment
- **POST** `/api/billing/invoices/<invoice_id>/pay`
- **Required Fields:**
  - `amount`: Payment amount
- **Optional Fields:**
  - `payment_method`: Payment method (cash, bank, card, etc.)
  - `reference_number`: Payment reference
  - `notes`: Payment notes
- **Response:** Updated invoice (auto-marked as paid if fully paid)

```bash
curl -X POST http://localhost:3000/api/billing/invoices/1/pay \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "payment_method": "bank_transfer",
    "reference_number": "REF123456"
  }'
```

#### 5. Revenue Summary
- **GET** `/api/billing/revenue/summary`
- **Response:** Summary including:
  - Total revenue (all time)
  - Monthly revenue (current month)
  - Pending invoices count & amount
  - Overdue invoices count & amount

```bash
curl http://localhost:3000/api/billing/revenue/summary
```

#### 6. Monthly Revenue Breakdown
- **GET** `/api/billing/revenue/monthly`
- **Response:** Last 12 months revenue data with:
  - Month
  - Number of trips
  - Total revenue for month
  - Number of paid trips
  - Total paid amount

```bash
curl http://localhost:3000/api/billing/revenue/monthly
```

#### 7. Billing Statistics
- **GET** `/api/billing/stats`
- **Response:** Overall billing statistics:
  - Total invoices
  - Paid invoices count
  - Pending invoices count
  - Overdue invoices count
  - Total paid amount
  - Total pending amount
  - Average invoice amount

```bash
curl http://localhost:3000/api/billing/stats
```

## Database Schema

### Trips Table
```sql
CREATE TABLE trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    driver_id INTEGER NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    load_type TEXT,
    weight INTEGER,
    distance INTEGER,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    eta TIMESTAMP,
    notes TEXT
);
```

### Invoices Table
```sql
CREATE TABLE invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    driver_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP,
    paid_date TIMESTAMP,
    payment_method TEXT,
    notes TEXT
);
```

### Payments Table
```sql
CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method TEXT,
    reference_number TEXT,
    notes TEXT
);
```

### Revenue Table
```sql
CREATE TABLE revenue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL,
    total_trips INTEGER,
    total_revenue REAL,
    vehicle_revenue REAL,
    driver_commission REAL,
    operational_cost REAL,
    net_profit REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Features

### Trip Management
- ✅ Create and manage trips
- ✅ Track trip status (pending, in-progress, completed)
- ✅ Filter trips by status, driver, or vehicle
- ✅ Record trip start and completion times
- ✅ Add trip notes and details
- ✅ Automatic trip statistics

### Billing Management
- ✅ Auto-generate invoices for completed trips
- ✅ Track invoice status (pending, paid, overdue)
- ✅ Record payments with multiple methods
- ✅ Calculate total revenue and monthly breakdown
- ✅ Track pending and overdue payments
- ✅ Maintain payment history per invoice

### Revenue Analytics
- ✅ Total revenue tracking
- ✅ Monthly revenue breakdown
- ✅ Payment method tracking
- ✅ Revenue statistics and summaries
- ✅ Overdue payment tracking

## Integration Points

### Frontend Integration
The frontend dashboards in Phase 5 can now connect to these endpoints:

1. **Trips Dashboard** → `/api/trips/list`, `/api/trips/stats`
2. **Billing Dashboard** → `/api/billing/invoices`, `/api/billing/revenue/summary`
3. **Revenue Dashboard** → `/api/billing/revenue/monthly`, `/api/billing/stats`

### Environment Configuration
Add to your `.env` file:
```
API_HOST=0.0.0.0
API_PORT=3000
API_DEBUG=True
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## Testing

### Using cURL

1. **Create a trip:**
   ```bash
   curl -X POST http://localhost:3000/api/trips/add \
     -H "Content-Type: application/json" \
     -d '{"vehicle_id":1,"driver_id":1,"origin":"Mumbai","destination":"Bangalore","distance":1000}'
   ```

2. **Get all trips:**
   ```bash
   curl http://localhost:3000/api/trips/list
   ```

3. **Create an invoice:**
   ```bash
   curl -X POST http://localhost:3000/api/billing/invoices/add \
     -H "Content-Type: application/json" \
     -d '{"trip_id":1,"vehicle_id":1,"driver_id":1,"amount":5000}'
   ```

4. **Record payment:**
   ```bash
   curl -X POST http://localhost:3000/api/billing/invoices/1/pay \
     -H "Content-Type: application/json" \
     -d '{"amount":5000,"payment_method":"bank_transfer"}'
   ```

## Next Steps

Phase 7 could include:
1. **Real-time Tracking** - GPS integration for live vehicle tracking
2. **Notifications System** - Email/SMS alerts for trip updates and payments
3. **Reports & Export** - PDF/Excel report generation
4. **Payment Gateway** - Stripe/Razorpay integration
5. **Mobile App** - Driver-facing mobile app for trip management
