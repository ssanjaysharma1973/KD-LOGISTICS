/**
 * One-time script: replaces hardcoded /api/ fetch calls with ${API_BASE}/api/
 * Run with: node fix-api-paths.js
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, 'src');
const API_CONST = "const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://kd-logistics-production.up.railway.app';";

const files = [
  'components/AnalyticsDashboard.jsx',
  'components/ClientCodeLogin.jsx',
  'components/DriverManagementDashboard.jsx',
  'components/BillingDashboard.jsx',
  'components/CentralControlCenter.jsx',
  'components/DriverManagement.jsx',
  'components/EwayBillHub.jsx',
  'components/FuelAdvanceRequestForm.jsx',
  'components/FuelApprovalDashboard.jsx',
  'components/FuelBillUpload.jsx',
  'vehicletracker.jsx',
  'components/MunshiPortal.jsx',
  'StandardRouteFormTable.jsx',
  'components/RoutesPage.jsx',
  'components/TripManagementDashboard.jsx',
  'components/VehicleTrackerTab.jsx',
  'components/VehicleManagementDashboard.jsx',
  'components/VehicleManagement.jsx',
  'FleetMap.jsx',
  'hooks/usevehicle.ts',
];

files.forEach(f => {
  const fullPath = path.join(BASE, f);
  if (!fs.existsSync(fullPath)) {
    console.log('SKIP (not found):', f);
    return;
  }
  let c = fs.readFileSync(fullPath, 'utf8');
  const original = c;

  // Add API_BASE constant after last import line (if not already present)
  if (!c.includes('const API_BASE = import.meta.env.VITE_API_BASE_URL')) {
    const lines = c.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) lastImportIdx = i;
    }
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, '', API_CONST);
      c = lines.join('\n');
    }
  }

  // Fix template literal fetch calls: fetch(`/api/... → fetch(`${API_BASE}/api/...
  c = c.replace(/fetch\(`\/api\//g, 'fetch(`${API_BASE}/api/');

  // Fix single-quoted fetch calls ending with ') → template literal fetch(`${API_BASE}/api/...`)
  c = c.replace(/fetch\('(\/api\/[^']*)'\)/g, "fetch(`\${API_BASE}$1`)");

  // Fix single-quoted fetch calls followed by , (e.g., fetch('/api/...', { )
  c = c.replace(/fetch\('(\/api\/[^']*)',/g, "fetch(`\${API_BASE}$1`,");

  if (c !== original) {
    fs.writeFileSync(fullPath, c, 'utf8');
    console.log('Fixed:', f);
  } else {
    console.log('No change:', f);
  }
});

console.log('\nDone! Now rebuild: npm run build');
