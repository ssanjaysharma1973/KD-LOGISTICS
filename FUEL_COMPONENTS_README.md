# 🛢️ Fuel Control Module - React Frontend Components

## Overview
Complete React component library for the fuel control system. Supports three user roles: Driver, Munshi (Supervisor), and Finance.

**Status:** ✅ Phase 1 Complete - Ready for integration  
**Components:** 5 main components  
**Lines of Code:** 1200+ (well-structured React)

---

## Components

### 1. **FuelManagementPage** (Main Portal)
**File:** `src/components/FuelManagementPage.jsx`  
**Purpose:** Main application shell with multi-role navigation

**Props:**
```javascript
{
  userRole: 'driver' | 'munshi' | 'finance',  // Required
  userId: string,                              // Required
  clientId: string,                            // Optional
  tripId: number                               // Optional
}
```

**Features:**
- Side navigation (role-based menu)
- User info card
- Role-specific content areas
- Responsive layout

**Usage:**
```jsx
import FuelManagementPage from './components/FuelManagementPage';

<FuelManagementPage 
  userRole="driver"
  userId="DRV001"
  clientId="CLIENT_001"
  tripId={123}
/>
```

---

### 2. **FuelAdvanceRequestForm** (Driver)
**File:** `src/components/FuelAdvanceRequestForm.jsx`  
**Purpose:** Driver requests fuel advance for a trip

**Props:**
```javascript
{
  tripId: number,                    // Required
  driverId: string,                  // Required
  onRequestSubmitted: function       // Optional callback
}
```

**Features:**
- Auto-fetch trip details
- Fuel plan integration (fetches from backend)
- Suggested amount (80% of max)
- Remarks field
- Real-time validation
- Success/error alerts
- Trip info display card

**API Calls:**
- `GET /api/trips/<tripId>` — Get trip details
- `POST /api/fuel/plan/<tripId>` — Get fuel plan
- `POST /api/fuel/advance/request` — Submit request

**Example:**
```jsx
<FuelAdvanceRequestForm
  tripId={123}
  driverId="DRV001"
  onRequestSubmitted={(data) => {
    console.log('Request created:', data.advance_id);
  }}
/>
```

---

### 3. **FuelApprovalDashboard** (Munshi/Finance)
**File:** `src/components/FuelApprovalDashboard.jsx`  
**Purpose:** Approve/issue fuel advances to drivers

**Props:**
```javascript
{
  userRole: 'munshi' | 'finance',  // Required
  clientId: string                 // Optional
}
```

**Features:**
- List pending approvals with auto-refresh
- Driver details, route, amount, timestamp
- Quick approve button
- Modal approval interface
- Amount adjustment allowed
- Approval + issue in one action
- Pending summary footer

**API Calls:**
- `GET /api/fuel/dashboard/pending-approvals` — Fetch pending
- `POST /api/fuel/advance/<id>/approve` — Approve
- `POST /api/fuel/advance/<id>/issue` — Issue cash

**Workflow:**
```
Display pending → Click Approve → Adjust amount → Confirm
→ Backend: approve + issue
→ Auto-refresh list
```

**Example:**
```jsx
<FuelApprovalDashboard 
  userRole="munshi"
  clientId="CLIENT_001"
/>
```

---

### 4. **FuelBillUpload** (Driver)
**File:** `src/components/FuelBillUpload.jsx`  
**Purpose:** Driver uploads fuel receipt/bill

**Props:**
```javascript
{
  tripId: number,              // Required
  driverId: string,            // Required
  onBillUploaded: function     // Optional callback
}
```

**Features:**
- Image upload with preview
- Drag-n-drop support (native input)
- Calculate rate per liter
- Bill number validation
- Litres, amount, location, remarks
- File size check (max 5MB)
- Image removal
- Success notification

**API Calls:**
- `POST /api/fuel/transaction/create` — Record bill

**Fields:**
- Litres (decimal) — Required
- Amount ₹ (decimal) — Required
- Bill Number (unique) — Required
- Location — Optional
- Remarks — Optional
- Photo — Optional

**Example:**
```jsx
<FuelBillUpload
  tripId={123}
  driverId="DRV001"
  onBillUploaded={(data) => {
    console.log('Bill recorded:', data.fuel_txn_id);
  }}
/>
```

---

### 5. **FuelHistoryView** (Driver/Management)
**File:** `src/components/FuelHistoryView.jsx`  
**Purpose:** View all advances, transactions, and statistics

**Props:**
```javascript
{
  driverId: string,    // Required
  clientId: string     // Optional
}
```

**Tabs:**

#### Tab 1: My Advances
- List all driver's advances
- Status badges (requested/approved/issued/settled/rejected)
- Amount details (requested/approved)
- Bill upload status
- Variance tracking
- Remarks display

#### Tab 2: Statistics
- Total requested (₹)
- Total approved (₹)
- Pending approvals (₹)
- Bills uploaded (count/completion %)
- Grid layout with visual cards

**Features:**
- Auto-refresh every 60 seconds
- Responsive grid layout
- Color-coded status badges
- Trip route info
- Date formatting

**Example:**
```jsx
<FuelHistoryView
  driverId="DRV001"
  clientId="CLIENT_001"
/>
```

---

## Integration Guide

### Step 1: Add Components to App
```jsx
import FuelManagementPage from './components/FuelManagementPage';

function App() {
  const [user] = useState({
    role: 'driver',
    id: 'DRV001',
    clientId: 'CLIENT_001'
  });

  return (
    <FuelManagementPage
      userRole={user.role}
      userId={user.id}
      clientId={user.clientId}
    />
  );
}
```

### Step 2: Create Separate Routes (Optional)
```jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

<Routes>
  <Route path="/fuel/driver" element={<FuelManagementPage userRole="driver" userId="..." />} />
  <Route path="/fuel/munshi" element={<FuelManagementPage userRole="munshi" userId="..." />} />
  <Route path="/fuel/finance" element={<FuelManagementPage userRole="finance" userId="..." />} />
</Routes>
```

### Step 3: Configure Backend URL
Ensure backend API is running on same domain or configure CORS:

```javascript
// In your API calls (components already use relative URLs):
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';
```

---

## UI/UX Features

### Color Scheme
- **Primary:** Purple (#7c3aed) — Main action color
- **Success:** Green (#10b981) — Approvals, confirmations
- **Warning:** Amber (#f59e0b) — Pending items
- **Error:** Red (#ef4444) — Rejections, errors
- **Info:** Blue (#0ea5e9) — Informational alerts

### Icon Set
Uses `lucide-react` library:
- `AlertCircle` — Errors
- `CheckCircle` — Success
- `Clock` — Pending
- `Send` — Submit
- `Upload` — File actions
- `TrendingUp` — Variance
- `RefreshCw` — Reload
- `Trash2` — Delete
- `User`, `Briefcase` — User types
- `LogOut` — Sign out

### Responsive Features
- Mobile-friendly forms
- Image preview scaling
- Grid layouts adapt to screen size
- Modal overlays
- Touch-friendly buttons (min 32px)

---

## State Management

All components use React hooks:
- `useState` — Form state, UI state
- `useEffect` — Data fetching, polling
- `useRef` — File inputs, DOM refs

No Redux/Context required for Phase 1 — can be added later.

---

## API Integration

All components call these endpoints (already built in backend):

### Fuel Planning
```
POST /api/fuel/plan/<trip_id>
```

### Advances
```
POST /api/fuel/advance/request
POST /api/fuel/advance/<id>/approve
POST /api/fuel/advance/<id>/issue
GET /api/fuel/advance/<id>
```

### Transactions
```
POST /api/fuel/transaction/create
GET /api/fuel/transaction/<id>
```

### Dashboard
```
GET /api/fuel/dashboard/pending-approvals
GET /api/fuel/dashboard/summary/<client_id>
```

---

## Error Handling

All components include:
- Try-catch error handling
- User-friendly error messages
- Error alert display
- Loading states
- Validation feedback

---

## Testing Checklist

- [ ] Driver can request advance
- [ ] Driver can upload bill
- [ ] Driver can view history
- [ ] Munshi can see pending approvals
- [ ] Munshi can approve & issue
- [ ] Dashboard shows correct statistics
- [ ] Variance calculations work
- [ ] Image upload works
- [ ] Status badges display correctly
- [ ] Auto-refresh works
- [ ] Mobile layout responsive

---

## Future Enhancements

### Phase 2
- [ ] Designated pump vendor integration
- [ ] OTP-based authorization
- [ ] Vendor portal with login
- [ ] Route deviation control

### Phase 3
- [ ] Mileage intelligence
- [ ] Fraud alerts
- [ ] Owner-pay-later ledger
- [ ] Advanced reporting

---

## File Structure
```
src/components/
├── FuelManagementPage.jsx          (Main portal, 200 lines)
├── FuelAdvanceRequestForm.jsx      (Driver request, 240 lines)
├── FuelApprovalDashboard.jsx       (Munshi approval, 280 lines)
├── FuelBillUpload.jsx              (Bill upload, 300 lines)
└── FuelHistoryView.jsx             (History/stats, 320 lines)

Total: 1,340 lines of React JSX
```

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari 14+, Chrome Android)

---

## Performance

- Lazy loading for images
- Polling limited to 60-120 seconds
- Modal rendering optimized
- CSS-in-JS (inline styles) for quick rendering
- Minimal re-renders with proper hook dependencies

---

## Accessibility

- Semantic HTML
- ARIA labels on buttons
- Color contrasts meet WCAG standards
- Keyboard navigation support (tab, enter)
- Focus states on interactive elements
- Error messages linked to inputs

---

## Notes

- Components use inline CSS (no external stylesheets required)
- All components are functional (React Hooks)
- ESLint/Prettier ready
- No external UI library dependencies (only lucide-react for icons)
- Can be easily styled with Tailwind/Material-UI if needed

---

## Support & Questions

For issues or questions:
1. Check component Props documentation above
2. Review API responses in browser DevTools
3. Verify backend `/api/fuel/health` returns `{status: "ok"}`
4. Check console for error messages
5. Ensure CORS is properly configured

