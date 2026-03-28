import React, { useState, useEffect, useCallback } from 'react';
import { TenantContext, useTenant } from './TenantContext.js';
import {
  MapPin,
  Search,
  Truck,
  LayoutDashboard,
  Bell,
  AlertTriangle,
  Zap,
  RefreshCw,
  Route,
  Settings,
  Upload,
  Clock,
  Package,
  Navigation,
  LayoutGrid,
  Map,
  MapPinned
} from 'lucide-react';
import VehicleTracker from './vehicletracker.jsx';
import TrackModal from './modals/TrackModal.jsx';
import FleetMap from './FleetMap.jsx';
import VehicleFormTable from './VehicleFormTable.jsx';
import VehicleDropdown from './VehicleDropdown.jsx';
import POIManagement from './components/POIManagement.jsx';
import UnloadingRatesManager from './components/UnloadingRatesManager.jsx';
import BulkUnloadingCharges from './components/BulkUnloadingCharges.jsx';
import VehicleTrackerTab from './components/VehicleTrackerTab.jsx';
import './RoutPlanner.css';
import { useVehicleData } from './context/VehicleDataContext.jsx';
import FleetPreview from "./components/FleetPreview";
import MapComponent from "./components/MapComponent.jsx";
import Card, { CardContent, CardHeader, CardTitle } from "./components/ui/card.jsx";
import Sidebar from "./components/Sidebar.jsx";
import VehicleManagement from "./components/VehicleManagement.jsx";
import TripDispatchWizard from "./components/TripDispatchWizard.jsx";
import TripMonitor from "./components/TripMonitor.jsx";
import RouteOperations from "./components/RouteOperations.jsx";
import MunshiPage from "./components/MunshiPage.jsx";
import Ledgers from "./components/Ledgers.jsx";
import EwayBillHub from "./components/EwayBillHub.jsx";
import DevAdmin from "./components/DevAdmin.jsx";
import RouteMemoryAdmin from "./components/RouteMemoryAdmin.jsx";
import { formatDurationSince } from './utils.js';
import { sortVehiclesByTime } from './utils/vehicle.js';

// Error Boundary to catch React errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', background: '#fff', padding: 32, borderRadius: 16, margin: 32 }}>
          <h2>React Error Caught</h2>
          <pre>{String(this.state.error)}</pre>
          <p>Check the console for more details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- UI COMPONENTS ---
const Badge = ({ status }) => {
  const s = status?.toLowerCase() || 'available';
  const styles = {
    active: 'bg-emerald-100/50 text-emerald-700 border-emerald-200',
    available: 'bg-blue-50 text-blue-700 border-blue-200',
    maintenance: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  const dotColor = { active: 'bg-emerald-500', available: 'bg-blue-500', maintenance: 'bg-rose-500' };
  return (
    <span className={`pl-2 pr-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 w-fit uppercase tracking-wider ${styles[s] || styles.available}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor[s] || dotColor.available}`} />
      {status || 'Available'}
    </span>
  );
};

const StatCard = ({ label, value, onClick, children, className = '' }) => (
  <Card onClick={onClick} noPadding className={`flex flex-col justify-between h-full relative overflow-hidden group cursor-pointer p-2 ${className}`}>
    <div className="z-10">
      <h3 className="text-xl font-bold text-slate-800 tracking-tight leading-none">{value}</h3>
      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-0.5">{label}</p>
      {children}
    </div>
  </Card>
);

const VehicleDetailCard = ({ vehicle, onBack }) => (
  <Card className="p-4 border-indigo-100 bg-indigo-50/30">
    <div className="flex justify-between items-start">
      <div>
        <h4 className="font-bold text-slate-900">{vehicle?.number || 'Vehicle'}</h4>
        <p className="text-sm text-slate-500">{vehicle?.driver || 'No Driver assigned'}</p>
      </div>
      <button onClick={onBack} className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded border-2 border-blue-500">CLOSE</button>
    </div>
  </Card>
);

function App() {
  // Haversine formula to calculate distance between two lat/lon points in meters
  function haversine(lat1, lon1, lat2, lon2) {
    function toRad(x) { return x * Math.PI / 180; }
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  const { tenantKey } = useTenant();
  const { vehicles, pois, munshis, stats, loading, refresh: refreshVehicleContext } = useVehicleData();
  const [trackModalVehicle, setTrackModalVehicle] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // const [routes] = useState([]); // unused
  const [poiRadiusMeters] = useState(1000);
  const [poiDelayMinutes] = useState(0);
  const [, setSelectedPOI] = useState(null);
  const [selectedPoiFilter, setSelectedPoiFilter] = useState(null);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState(null);
  const [selectedSizeFilter, setSelectedSizeFilter] = useState(null);
  const [dashboardView, setDashboardView] = useState('poi');
  const [showAllPois, setShowAllPois] = useState(false);
  const [ewbVehicleMap, setEwbVehicleMap] = useState({}); // vehicle_no → ewb movement data

  // Fetch EWB vehicle-movement for dashboard cards
  const fetchEwbMovement = useCallback(async () => {
    try {
      const res = await fetch('/api/eway-bills-hub/vehicle-movement');
      if (!res.ok) return;
      const data = await res.json();
      const map = {};
      (data.vehicles || []).forEach(v => { map[v.vehicle_no] = v; });
      setEwbVehicleMap(map);
    } catch { /* ignore — EWB may not be available */ }
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchEwbMovement();
      const t = setInterval(fetchEwbMovement, 60000);
      return () => clearInterval(t);
    }
  }, [activeTab, fetchEwbMovement]);

  // Radius threshold settings
  const [minRadius, setMinRadius] = useState(1000);
  const [maxRadius, setMaxRadius] = useState(5000);
  const [defaultRadius, setDefaultRadius] = useState(1000);
  
  // Edit POI state
  const [selectedPOIForEdit, setSelectedPOIForEdit] = useState(null);
  const [_editingPOI, _setEditingPOI] = useState(null);
  
  // Vehicle Management state
  const [vehicleList, setVehicleList] = useState([]);
  const [_selectedVehicleData, _setSelectedVehicleData] = useState(null);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [selectedVehicleForEdit, setSelectedVehicleForEdit] = useState(null);
  
  // Fuel type rates (master rates for Diesel/Petrol/CNG/Electric)
  const [fuelTypeRates, setFuelTypeRates] = useState([]);
  const [fuelRateSaving, setFuelRateSaving] = useState(null); // which fuel_type is saving
  const [fuelRateEdits, setFuelRateEdits] = useState({}); // {Diesel: '89.62', ...}
  const [fuelFetchState, setFuelFetchState] = useState('Haryana');
  const [fuelFetchLoading, setFuelFetchLoading] = useState(false);
  const [fuelFetchMsg, setFuelFetchMsg] = useState(null); // {ok, text}

  // Driver Salary settings
  const [settingDrivers, setSettingDrivers] = useState([]);
  const [settingDriverSalaryEdits, setSettingDriverSalaryEdits] = useState({});
  const [settingDriverEditingId, setSettingDriverEditingId] = useState(null);
  const [settingDriverSaving, setSettingDriverSaving] = useState(null);

  const INDIAN_STATES = [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
    'Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand',
    'Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
    'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
    'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
    'Uttarakhand','West Bengal',
  ];

  const autoFetchFuelRates = async () => {
    setFuelFetchLoading(true);
    setFuelFetchMsg(null);
    try {
      const res = await fetch(`/api/fuel-prices/fetch?state=${encodeURIComponent(fuelFetchState)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.tip ? `${data.error} — ${data.tip}` : (data.error || 'Fetch failed'));
      // Pre-fill edits with fetched prices
      setFuelRateEdits(prev => ({ ...prev, ...Object.fromEntries(Object.entries(data.prices).map(([k,v]) => [k, String(v)])) }));
      const fetched = Object.entries(data.prices).map(([k,v]) => `${k} ₹${v}`).join(', ');
      setFuelFetchMsg({ ok: true, text: `✅ ${fetched} (${fuelFetchState}). Review & click Save All.` });
    } catch (e) {
      setFuelFetchMsg({ ok: false, text: `❌ ${e.message}` });
    }
    setFuelFetchLoading(false);
  };

  const loadSettingDrivers = useCallback(async () => {
    try {
      const res = await fetch('/api/drivers');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setSettingDrivers(list);
      const edits = {};
      list.forEach(d => { edits[d.id] = String(parseFloat(d.monthly_salary) || ''); });
      setSettingDriverSalaryEdits(edits);
    } catch { /* ignore */ }
  }, []);

  const saveDriverSalaryInSettings = async (driverId) => {
    setSettingDriverSaving(driverId);
    try {
      const res = await fetch(`/api/ledger/driver/${driverId}/salary`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthly_salary: parseFloat(settingDriverSalaryEdits[driverId]) || 0 }),
      });
      const d = await res.json();
      if (d.success) {
        setSettingDrivers(prev => prev.map(x => x.id === driverId ? { ...x, monthly_salary: parseFloat(settingDriverSalaryEdits[driverId]) || 0 } : x));
        setSettingDriverEditingId(null);
      } else alert('Save failed');
    } catch (e) { alert(e.message); }
    setSettingDriverSaving(null);
  };

  const saveAllFuelRates = async () => {
    for (const type of ['Diesel', 'Petrol', 'CNG', 'Electric']) {
      if (fuelRateEdits[type]) await saveFuelTypeRate(type);
    }
    setFuelFetchMsg({ ok: true, text: '✅ All rates saved to master (all clients).' });
  };

  const fetchFuelTypeRates = async () => {
    try {
      const res = await fetch('/api/fuel-type-rates');
      if (res.ok) {
        const data = await res.json();
        setFuelTypeRates(data);
        const edits = {};
        data.forEach(r => { edits[r.fuel_type] = String(r.cost_per_liter); });
        setFuelRateEdits(edits);
      }
    } catch (e) { console.error('fetchFuelTypeRates:', e); }
  };

  const saveFuelTypeRate = async (fuelType) => {
    setFuelRateSaving(fuelType);
    try {
      const res = await fetch(`/api/fuel-type-rates/${fuelType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost_per_liter: parseFloat(fuelRateEdits[fuelType]) || 0 }),
      });
      if (res.ok) await fetchFuelTypeRates();
    } catch (e) { console.error('saveFuelTypeRate:', e); }
    setFuelRateSaving(null);
  };

  // Client name constant
  const CLIENT_NAME = 'ATUL LOGISTICS';

  const POI_DELAY_MS = poiDelayMinutes * 60 * 1000;

  // Vehicles, POIs, and stats now come from shared VehicleDataContext
  // (auto-refreshes every 30 seconds across all pages)

  // Fetch vehicles from vehicle management API
  const fetchVehicles = useCallback(async () => {
    try {
      const clientId = tenantKey || 'CLIENT_001';
      const response = await fetch(`/api/vehicles-master?clientId=${encodeURIComponent(clientId)}`);
      if (response.ok) {
        const data = await response.json();
        setVehicleList(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setVehicleList([]);
    }
  }, [tenantKey]);

  useEffect(() => {
    if (activeTab === 'vehicles') {
      fetchVehicles();
    }
  }, [activeTab, fetchVehicles]);

  // Secret dev panel: Ctrl+Shift+F2
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F2' && e.shiftKey && e.ctrlKey) setActiveTab('__dev__');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleVehicleSubmit = async (formData) => {
    try {
      const clientId = tenantKey || 'CLIENT_001';
      const url = selectedVehicleForEdit
        ? `/api/vehicles-master/${selectedVehicleForEdit.id}`
        : '/api/vehicles-master';
      
      const method = selectedVehicleForEdit ? 'PUT' : 'POST';
      const payload = { client_id: clientId, ...formData };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setShowVehicleForm(false);
        setSelectedVehicleForEdit(null);
        fetchVehicles();
        alert(`✅ Vehicle ${selectedVehicleForEdit ? 'updated' : 'created'} successfully!`);
      } else {
        alert('❌ Error saving vehicle');
      }
    } catch (error) {
      console.error('Error saving vehicle:', error);
      alert('❌ Error: ' + error.message);
    }
  };

  const handleVehicleEdit = (vehicle) => {
    setSelectedVehicleForEdit(vehicle);
    setShowVehicleForm(true);
  };

  const handleVehicleDelete = async (vehicleId) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;
    
    try {
      const response = await fetch(`/api/vehicles-master/${vehicleId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchVehicles();
        _setSelectedVehicleData(null);
        // Sync all pages — backend already cleaned gps_current so dashboard
        // and tracker will no longer show this vehicle
        refreshVehicleContext();
        alert('✅ Vehicle deleted successfully!');
      } else {
        alert('❌ Error deleting vehicle');
      }
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      alert('❌ Error: ' + error.message);
    }
  };

  const _handleVehicleSelect = (vehicle) => {
    _setSelectedVehicleData(vehicle);
  };

  const SIZE_DISPLAY = {
    'category_1_32ft_34ft': '32/34 FT',
    'category_2_22ft_24ft': '22/24 FT',
    'category_3_small': 'Small',
  };

  // Vehicles filtered by POI + size (for status card counts)
  const vehiclesForStatusCounts = vehicles.filter(v => {
    if (selectedPoiFilter === '__NO_POI__' && v.stop_poi) return false;
    if (selectedPoiFilter && selectedPoiFilter !== '__NO_POI__' && v.stop_poi !== selectedPoiFilter) return false;
    if (selectedSizeFilter && (v.vehicle_size || '') !== selectedSizeFilter) return false;
    return true;
  });
  // Vehicles filtered by status + size (for POI chip counts)
  const vehiclesForPoiCounts = vehicles.filter(v => {
    if (selectedStatusFilter && v.status !== selectedStatusFilter) return false;
    if (selectedSizeFilter && (v.vehicle_size || '') !== selectedSizeFilter) return false;
    return true;
  });

  const filteredStatusCounts = { total: vehiclesForStatusCounts.length };
  vehiclesForStatusCounts.forEach(v => {
    const s = (v.status || 'OFFLINE').toUpperCase();
    filteredStatusCounts[s] = (filteredStatusCounts[s] || 0) + 1;
  });

  const summaryCards = [
    { label: 'Total', value: filteredStatusCounts.total || 0, icon: Truck, bg: '#eff6ff', fg: '#1e40af', border: '#2563eb', filterKey: null },
    { label: 'Active', value: filteredStatusCounts.ACTIVE || 0, icon: MapPin, bg: '#f0fdf4', fg: '#166534', border: '#bbf7d0', filterKey: 'ACTIVE' },
    { label: 'Slow', value: filteredStatusCounts.SLOW || 0, icon: MapPin, bg: '#e0f2fe', fg: '#0369a1', border: '#bae6fd', filterKey: 'SLOW' },
    { label: 'Stopped', value: filteredStatusCounts.STOPPED || 0, icon: Clock, bg: '#f9fafb', fg: '#374151', border: '#d1d5db', filterKey: 'STOPPED' },
    { label: 'Alert (>1d)', value: filteredStatusCounts.ALERT_MUNSHI || 0, icon: AlertTriangle, bg: '#fefce8', fg: '#854d0e', border: '#fde68a', filterKey: 'ALERT_MUNSHI' },
    { label: 'Alert (>2d)', value: filteredStatusCounts.ALERT_ADMIN || 0, icon: Bell, bg: '#fef2f2', fg: '#991b1b', border: '#fecaca', filterKey: 'ALERT_ADMIN' },
    { label: 'Offline', value: filteredStatusCounts.OFFLINE || 0, icon: Bell, bg: '#fef2f2', fg: '#991b1b', border: '#fecaca', filterKey: 'OFFLINE' },
    { label: 'No GPS', value: filteredStatusCounts.NO_GPS || 0, icon: Truck, bg: '#f3f4f6', fg: '#6b7280', border: '#d1d5db', filterKey: 'NO_GPS' },
  ];

  const poiCounts = {};
  let nonPoiCount = 0;
  vehiclesForPoiCounts.forEach(v => {
    if (v.stop_poi) {
      poiCounts[v.stop_poi] = (poiCounts[v.stop_poi] || 0) + 1;
    } else {
      nonPoiCount++;
    }
  });

  const hasAnyFilter = selectedStatusFilter || selectedPoiFilter || selectedSizeFilter;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', fontFamily: 'sans-serif', background: '#fff' }}>
      {/* Top navigation bar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} dashboardView={dashboardView} setDashboardView={setDashboardView} pois={pois} onSelectPOI={setSelectedPOI} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(c => !c)} sidebarCollapsed={sidebarCollapsed} />
      {/* Main Content Area */}
      <div style={{ flex: 1, marginTop: 46, padding: activeTab === 'ewaybill' ? '12px 12px' : 20, overflowY: 'auto', background: '#fff', color: '#111' }}>
        {loading && (
          <div style={{ color: '#111', textAlign: 'center', marginTop: 32, fontSize: 24 }}>
            Loading vehicles...
          </div>
        )}
        {!loading && vehicles.length === 0 && (
          <div style={{ color: '#111', textAlign: 'center', marginTop: 32, fontSize: 24 }}>
            No vehicles found or API error.
          </div>
        )}

        {activeTab === 'dashboard' && (
          <>
            {/* ── Summary Stats Bar ── */}
            <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 6, padding: '0 8px 10px 8px', overflowX: 'auto' }}>
              {summaryCards.map(card => {
                const isActive = selectedStatusFilter === card.filterKey;
                return (
                  <div key={card.label}
                    onClick={() => setSelectedStatusFilter(isActive ? null : card.filterKey)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: isActive ? card.fg : card.bg,
                      color: isActive ? '#fff' : card.fg,
                      borderRadius: 8, padding: '6px 10px',
                      minWidth: 80, flexShrink: 0,
                      border: `1px solid ${isActive ? card.fg : card.border}`,
                      cursor: 'pointer', transition: 'all 0.15s',
                      boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                    }}
                  >
                    {React.createElement(card.icon, { size: 14, style: { opacity: 0.7 } })}
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{card.value}</div>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', marginTop: 1 }}>{card.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── POI Summary (inline chips) ── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 8px 12px 8px', alignItems: 'center' }}>
                {hasAnyFilter && (
                  <span
                    onClick={() => { setSelectedPoiFilter(null); setSelectedStatusFilter(null); setSelectedSizeFilter(null); }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: '#dc2626', color: '#fff', borderRadius: 6,
                      padding: '4px 10px', fontSize: 11, fontWeight: 700,
                      border: '1px solid #dc2626', cursor: 'pointer',
                    }}
                  >
                    ✕ Reset All
                  </span>
                )}
                {Object.entries(poiCounts).map(([poi, count]) => {
                  const isSelected = selectedPoiFilter === poi;
                  return (
                    <span key={poi}
                      onClick={() => setSelectedPoiFilter(isSelected ? null : poi)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: isSelected ? '#4338ca' : '#eef2ff',
                        color: isSelected ? '#fff' : '#3730a3',
                        borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                        border: isSelected ? '1px solid #4338ca' : '1px solid #c7d2fe',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      📍 {count} at {poi}
                    </span>
                  );
                })}
                {nonPoiCount > 0 && (
                  <span
                    onClick={() => setSelectedPoiFilter(selectedPoiFilter === '__NO_POI__' ? null : '__NO_POI__')}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: selectedPoiFilter === '__NO_POI__' ? '#374151' : '#f3f4f6',
                      color: selectedPoiFilter === '__NO_POI__' ? '#fff' : '#6b7280',
                      borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                      border: selectedPoiFilter === '__NO_POI__' ? '1px solid #374151' : '1px solid #d1d5db',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    🛣️ {nonPoiCount} On Road
                  </span>
                )}
            </div>

            {/* ── Size Filters + View Toggle (single row) ── */}
            {(() => {
              const SIZE_CHIP_STYLES = {
                'category_1_32ft_34ft': { bg: '#dbeafe', color: '#1e40af', activeColor: '#1e40af', icon: '🚛' },
                'category_2_22ft_24ft': { bg: '#d1fae5', color: '#065f46', activeColor: '#065f46', icon: '🚚' },
                'category_3_small':     { bg: '#fef3c7', color: '#92400e', activeColor: '#92400e', icon: '🛻' },
              };
              const sizesInData = [...new Set(vehicles.map(v => v.vehicle_size || ''))].filter(Boolean);
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 8px 10px 8px', alignItems: 'center' }}>
                  {sizesInData.length > 0 && <>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Size:</span>
                    {['category_1_32ft_34ft', 'category_2_22ft_24ft', 'category_3_small'].filter(s => sizesInData.includes(s)).map(sz => {
                      const isActive = selectedSizeFilter === sz;
                      const cs = SIZE_CHIP_STYLES[sz];
                      const count = vehicles.filter(v => (v.vehicle_size || '') === sz).length;
                      return (
                        <span key={sz}
                          onClick={() => setSelectedSizeFilter(isActive ? null : sz)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            background: isActive ? cs.activeColor : cs.bg,
                            color: isActive ? '#fff' : cs.color,
                            borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                            border: `1px solid ${isActive ? cs.activeColor : cs.color}55`,
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          {cs.icon} {SIZE_DISPLAY[sz]} <span style={{ opacity: 0.75, fontSize: 10 }}>({count})</span>
                        </span>
                      );
                    })}
                    {sizesInData.includes('') && (
                      <span
                        onClick={() => setSelectedSizeFilter(selectedSizeFilter === '__UNSET__' ? null : '__UNSET__')}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: selectedSizeFilter === '__UNSET__' ? '#374151' : '#f3f4f6',
                          color: selectedSizeFilter === '__UNSET__' ? '#fff' : '#6b7280',
                          borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                          border: `1px solid ${selectedSizeFilter === '__UNSET__' ? '#374151' : '#d1d5db'}`,
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        ❓ Unset ({vehicles.filter(v => !v.vehicle_size).length})
                      </span>
                    )}
                    <span style={{ width: 1, height: 20, background: '#e2e8f0', margin: '0 2px' }} />
                  </>}
                  {[{ key: 'grid', icon: LayoutGrid, label: 'Grid' }, { key: 'map', icon: Map, label: 'Map' }, { key: 'poi', icon: MapPinned, label: 'POI' }].map(v => (
                    <button key={v.key}
                      onClick={() => setDashboardView(v.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 14px', fontSize: 12, fontWeight: 600,
                        borderRadius: 6, border: '1px solid',
                        background: dashboardView === v.key ? '#4338ca' : '#fff',
                        color: dashboardView === v.key ? '#fff' : '#4b5563',
                        borderColor: dashboardView === v.key ? '#4338ca' : '#d1d5db',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {React.createElement(v.icon, { size: 14 })}
                      {v.label}
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* ── Vehicle Grid / Map ── */}
            {dashboardView === 'grid' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 8, padding: '0 8px',
            }}>
              {[...vehicles]
                .filter(v => {
                  if (selectedStatusFilter && v.status !== selectedStatusFilter) return false;
                  if (selectedPoiFilter === '__NO_POI__' && v.stop_poi) return false;
                  if (selectedPoiFilter && selectedPoiFilter !== '__NO_POI__' && v.stop_poi !== selectedPoiFilter) return false;
                  if (selectedSizeFilter === '__UNSET__' && v.vehicle_size) return false;
                  if (selectedSizeFilter && selectedSizeFilter !== '__UNSET__' && (v.vehicle_size || '') !== selectedSizeFilter) return false;
                  return true;
                })
                .sort((a, b) => {
                  const priority = { ALERT_ADMIN: 0, ALERT_MUNSHI: 1, ACTIVE: 2, SLOW: 3, STOPPED: 4, OFFLINE: 6, NO_GPS: 7 };
                  const pa = priority[a.status] ?? 5;
                  const pb = priority[b.status] ?? 5;
                  if (pa !== pb) return pa - pb;
                  const ta = a.gps_time ? new Date(a.gps_time).getTime() : 0;
                  const tb = b.gps_time ? new Date(b.gps_time).getTime() : 0;
                  return tb - ta;
                })
                .map((vehicle, index) => {
                  const S = {
                    ACTIVE:       { bg: '#f0fdf4', badge: '#16a34a', badgeText: '#fff', label: 'ACTIVE', left: '#22c55e' },
                    SLOW:         { bg: '#e0f2fe', badge: '#0369a1', badgeText: '#fff', label: 'SLOW', left: '#38bdf8' },
                    STOPPED:      { bg: '#f9fafb', badge: '#6b7280', badgeText: '#fff', label: 'STOPPED', left: '#9ca3af' },
                    ALERT_MUNSHI: { bg: '#fefce8', badge: '#ca8a04', badgeText: '#fff', label: 'ALERT', left: '#eab308' },
                    ALERT_ADMIN:  { bg: '#fef2f2', badge: '#dc2626', badgeText: '#fff', label: 'ALERT', left: '#dc2626' },
                    OFFLINE:      { bg: '#fef2f2', badge: '#991b1b', badgeText: '#fff', label: 'OFFLINE', left: '#ef4444' },
                    NO_GPS:       { bg: '#f3f4f6', badge: '#6b7280', badgeText: '#fff', label: 'NO GPS', left: '#d1d5db' },
                  };
                  const s = S[vehicle.status] || S.OFFLINE;
                  const stopTime = vehicle.gps_time ? formatDurationSince(vehicle.gps_time) : null;
                  return (
                    <div key={vehicle.vehicle_number || index} style={{
                      background: s.bg, borderRadius: 8,
                      border: '1px solid #e5e7eb', borderLeft: `4px solid ${s.left}`,
                      padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3,
                    }}>
                      {/* Line 1: badge + truck + number + size tag */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: s.badge, color: s.badgeText, letterSpacing: 0.5,
                        }}>{s.label}</span>
                        <Truck size={14} color="#9ca3af" />
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#111', flex: 1 }}>{vehicle.vehicle_number}</span>
                        {vehicle.vehicle_size && (
                          <span style={{
                            fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                            background: vehicle.vehicle_size === 'category_1_32ft_34ft' ? '#dbeafe' : vehicle.vehicle_size === 'category_2_22ft_24ft' ? '#d1fae5' : '#fef3c7',
                            color: vehicle.vehicle_size === 'category_1_32ft_34ft' ? '#1e40af' : vehicle.vehicle_size === 'category_2_22ft_24ft' ? '#065f46' : '#92400e',
                            whiteSpace: 'nowrap',
                          }}>
                            {SIZE_DISPLAY[vehicle.vehicle_size] || vehicle.vehicle_size}
                          </span>
                        )}
                      </div>
                      {/* Line 2: POI / approaching + stop time */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4b5563' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                          {vehicle.stop_poi
                            ? `📍 ${vehicle.stop_poi}`
                            : vehicle.nearby_poi
                              ? <span style={{ color: '#854d0e', fontWeight: 600 }}>🔜 {vehicle.nearby_poi}{vehicle.nearby_poi_dist_m != null ? ` ~${vehicle.nearby_poi_dist_m}m` : ''}</span>
                              : ''}
                        </span>
                        {stopTime && <span style={{ fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>⏱ {stopTime}</span>}
                      </div>
                      {/* Line 3: driver + date */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b7280' }}>
                        <span>{vehicle.driver || ''}</span>
                        <span>{vehicle.gps_time ? new Date(vehicle.gps_time).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                      {/* EWB Load Status + mini History link */}
                      {(() => {
                        const ewb = ewbVehicleMap[vehicle.vehicle_number];
                        const LOAD_STATUS = {
                          unloading_at_delivery: { icon: '🔴', label: 'Unloading', color: '#dc2626', bg: '#fee2e2' },
                          in_transit_loaded:     { icon: '🟢', label: 'In Transit', color: '#166534', bg: '#dcfce7' },
                          empty_at_loading:      { icon: '🟡', label: 'Loading',   color: '#92400e', bg: '#fef3c7' },
                          empty_at_delivery:     { icon: '📦', label: 'Empty/Delivery', color: '#3730a3', bg: '#ede9fe' },
                        };
                        const ls = ewb ? LOAD_STATUS[ewb.load_status] : null;
                        const firstEwb = ewb?.active_ewbs?.[0];
                        const dest = firstEwb?.to_poi_name || firstEwb?.to_place || null;
                        const ewbCount = ewb?.ewb_count || 0;
                        return (
                          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {ls ? (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                background: ls.bg, borderRadius: 4, padding: '2px 6px',
                              }}>
                                <span style={{ fontSize: 10 }}>{ls.icon}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: ls.color }}>{ls.label}</span>
                                {ewb.current_poi_name && ewb.load_status !== 'in_transit_loaded' && (
                                  <span style={{ fontSize: 9, color: ls.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                                    @ {ewb.current_poi_name}
                                  </span>
                                )}
                                {ls.label === 'In Transit' && dest && (
                                  <span style={{ fontSize: 9, color: ls.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                                    → {dest}
                                  </span>
                                )}
                                {ewbCount > 0 && (
                                  <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: ls.color, whiteSpace: 'nowrap' }}>
                                    {ewbCount} EWB{ewbCount > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize: 9, color: '#9ca3af', fontStyle: 'italic' }}>No active EWB</div>
                            )}
                            <button onClick={() => setTrackModalVehicle(vehicle)} style={{
                              padding: '2px 8px', fontSize: 9, fontWeight: 600,
                              background: 'transparent', color: '#6b7280',
                              border: '1px solid #e5e7eb', borderRadius: 4,
                              cursor: 'pointer', alignSelf: 'flex-start',
                            }}>View History</button>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
            </div>
            ) : dashboardView === 'map' ? (
              <div style={{ height: 600, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <FleetMap
                  vehicles={vehicles.filter(v => {
                    if (selectedStatusFilter && v.status !== selectedStatusFilter) return false;
                    if (selectedPoiFilter === '__NO_POI__') return !v.stop_poi;
                    if (selectedPoiFilter && v.stop_poi !== selectedPoiFilter) return false;
                    return true;
                  })}
                  setTrackModalVehicle={setTrackModalVehicle}
                />
              </div>
            ) : dashboardView === 'poi' ? (
              <div style={{ padding: '0 8px' }}>
                {(() => {
                  const STATUS_STYLE = {
                    ACTIVE:       { dot: '#16a34a' },
                    SLOW:         { dot: '#0369a1' },
                    STOPPED:      { dot: '#6b7280' },
                    ALERT_MUNSHI: { dot: '#ca8a04' },
                    ALERT_ADMIN:  { dot: '#dc2626' },
                    OFFLINE:      { dot: '#ef4444' },
                  };
                  const POI_TYPE_STYLE = {
                    PRIMARY:     { bg: '#dbeafe', color: '#1e40af' },
                    WAREHOUSE:   { bg: '#e0f2fe', color: '#0369a1' },
                    SECONDARY:   { bg: '#ede9fe', color: '#6d28d9' },
                    TERTIARY:    { bg: '#d1fae5', color: '#065f46' },
                    OTHER:       { bg: '#f1f5f9', color: '#475569' },
                  };
                  const POI_TYPE_LABEL = {
                    PRIMARY: 'Hub', WAREHOUSE: 'Warehouse',
                    SECONDARY: 'Distributor', TERTIARY: 'Dealer', OTHER: 'Other',
                  };
                  // Assign each vehicle to its single nearest POI; leftovers = in transit
                  const filteredVehicles = vehicles
                    .map(v => ({ ...v, latitude: v.latitude ?? v.lat, longitude: v.longitude ?? v.lng }))
                    .filter(v => {
                    if (selectedStatusFilter && v.status !== selectedStatusFilter) return false;
                    if (selectedSizeFilter === '__UNSET__' && v.vehicle_size) return false;
                    if (selectedSizeFilter && selectedSizeFilter !== '__UNSET__' && (v.vehicle_size || '') !== selectedSizeFilter) return false;
                    return true;
                  });
                  const poiVehicleMap = {};
                  const poiApproachingMap = {}; // vehicles within 300m but outside POI radius
                  const inTransit = [];
                  filteredVehicles.forEach(v => {
                    // Use backend-computed nearby_poi if available (no GPS needed client-side)
                    if (v.nearby_poi && !v.stop_poi) {
                      const matchPoi = pois.find(p => (p.poi_name || p.name) === v.nearby_poi);
                      if (matchPoi) {
                        if (!poiApproachingMap[matchPoi.id]) poiApproachingMap[matchPoi.id] = [];
                        poiApproachingMap[matchPoi.id].push(v);
                        return; // don't add to inTransit
                      }
                    }
                    if (!v.latitude || !v.longitude) return;
                    let nearestPoi = null, nearestDist = Infinity;
                    pois.forEach(poi => {
                      if (!poi.latitude || !poi.longitude) return;
                      const dist = haversine(parseFloat(v.latitude), parseFloat(v.longitude), parseFloat(poi.latitude), parseFloat(poi.longitude));
                      const r = poi.radius_meters || 1000;
                      if (dist <= r && dist < nearestDist) { nearestDist = dist; nearestPoi = poi; }
                    });
                    if (nearestPoi) {
                      if (!poiVehicleMap[nearestPoi.id]) poiVehicleMap[nearestPoi.id] = [];
                      poiVehicleMap[nearestPoi.id].push(v);
                    } else {
                      inTransit.push(v);
                    }
                  });
                  const approachTotal = Object.values(poiApproachingMap).reduce((s, arr) => s + arr.length, 0);
                  const poisWithVehicles = [...pois]
                    .map(poi => ({ ...poi, vehiclesAtPoi: poiVehicleMap[poi.id] || [], approachingVehicles: poiApproachingMap[poi.id] || [] }))
                    .filter(poi => showAllPois ? true : (poi.vehiclesAtPoi.length > 0 || poi.approachingVehicles.length > 0))
                    .sort((a, b) => (b.vehiclesAtPoi.length + b.approachingVehicles.length) - (a.vehiclesAtPoi.length + a.approachingVehicles.length));
                  const totalParked = poisWithVehicles.reduce((s, p) => s + p.vehiclesAtPoi.length, 0);

                  const VehiclePill = ({ v, bg = '#f8fafc', border = '#e2e8f0', extraLabel }) => {
                    const vNum = v.vehicle_number || v.number || 'Unknown';
                    const dot = (STATUS_STYLE[v.status] || STATUS_STYLE.OFFLINE).dot;
                    const szLabel = SIZE_DISPLAY[v.vehicle_size] || null;
                    if (v.gps_time) {
                      const days = (new Date() - new Date(v.gps_time)) / 86400000;
                      if (days > 2) { bg = '#fef2f2'; border = '#fecaca'; }
                      else if (days > 1) { bg = '#fefce8'; border = '#fde68a'; }
                    }
                    return (
                      <button onClick={() => setTrackModalVehicle(v)} title="Click to view history" style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: bg, border: `1px solid ${border}`, borderRadius: 6,
                        padding: '4px 9px', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#1e293b',
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontWeight: 700 }}>{vNum}</span>
                        {szLabel && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: v.vehicle_size === 'category_1_32ft_34ft' ? '#dbeafe' : v.vehicle_size === 'category_2_22ft_24ft' ? '#d1fae5' : '#fef3c7', color: v.vehicle_size === 'category_1_32ft_34ft' ? '#1e40af' : v.vehicle_size === 'category_2_22ft_24ft' ? '#065f46' : '#92400e' }}>{szLabel}</span>}
                        {v.gps_time && <span style={{ color: '#64748b', fontWeight: 500 }}>{formatDurationSince(v.gps_time)}</span>}
                        {extraLabel && <span style={{ color: '#b45309', fontWeight: 500 }}>{extraLabel}</span>}
                      </button>
                    );
                  };

                  return (
                    <>
                      {/* Summary bar */}
                      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '5px 13px', fontSize: 12, fontWeight: 700, color: '#166534' }}>
                          📍 {showAllPois ? pois.length : poisWithVehicles.length} POIs {showAllPois ? 'total' : 'occupied'}
                        </div>
                        <div style={{ background: '#eff6ff', border: '1px solid #2563eb', borderRadius: 8, padding: '5px 13px', fontSize: 12, fontWeight: 700, color: '#1e40af' }}>
                          🚛 {totalParked} parked
                        </div>
                        {approachTotal > 0 && (
                          <div style={{ background: '#eff6ff', border: '1px solid #2563eb', borderRadius: 8, padding: '5px 13px', fontSize: 12, fontWeight: 700, color: '#1e40af' }}>
                            🔜 {approachTotal} approaching
                          </div>
                        )}
                        {inTransit.length > 0 && (
                          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '5px 13px', fontSize: 12, fontWeight: 700, color: '#9a3412' }}>
                            🛣️ {inTransit.length} in transit
                          </div>
                        )}
                        <button
                          onClick={() => setShowAllPois(v => !v)}
                          style={{ marginLeft: 'auto', padding: '5px 13px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: '1px solid #6366f1', background: showAllPois ? '#6366f1' : '#fff', color: showAllPois ? '#fff' : '#6366f1', cursor: 'pointer' }}>
                          {showAllPois ? '📍 Occupied only' : '🗂️ Show all POIs'}
                        </button>
                      </div>

                      {/* POI cards */}
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 0 }}>
                        {poisWithVehicles.map(poi => {
                          const typeKey = (poi.type || 'OTHER').toUpperCase();
                          const ts = POI_TYPE_STYLE[typeKey] || POI_TYPE_STYLE.OTHER;

                          // Group vehicles at this POI by load status
                          const LOAD_GROUPS = [
                            { key: 'in_transit_loaded',     label: 'Loaded / In Transit', icon: '🟢', bg: '#eff6ff', border: '#2563eb', color: '#1e40af' },
                            { key: 'empty_at_loading',      label: 'Loading',              icon: '🟡', bg: '#eff6ff', border: '#2563eb', color: '#1e40af' },
                            { key: 'unloading_at_delivery', label: 'Unloading',            icon: '🔴', bg: '#eff6ff', border: '#2563eb', color: '#1e40af' },
                            { key: 'empty_at_delivery',     label: 'Empty / Delivered',    icon: '📦', bg: '#eff6ff', border: '#2563eb', color: '#1e40af' },
                            { key: '__no_ewb__',            label: 'No EWB Data',          icon: '⚪', bg: '#eff6ff', border: '#2563eb', color: '#1e40af' },
                          ];

                          const grouped = {};
                          LOAD_GROUPS.forEach(g => { grouped[g.key] = []; });
                          sortVehiclesByTime(poi.vehiclesAtPoi).forEach(v => {
                            const ewb = ewbVehicleMap[v.vehicle_number];
                            const ls = ewb?.load_status;
                            if (ls && grouped[ls] !== undefined) grouped[ls].push(v);
                            else grouped['__no_ewb__'].push(v);
                          });

                          const hasAnyEwb = LOAD_GROUPS.slice(0, 4).some(g => grouped[g.key].length > 0);

                          return (
                            <li key={poi.id} style={{ marginBottom: 10, background: '#fff', borderRadius: 10, padding: '10px 14px', border: '2.5px solid #2563eb', boxShadow: '0 2px 8px rgba(37,99,235,0.10)' }}>
                              {/* POI header */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{poi.display_name || poi.poi_name || poi.name}</span>
                                {poi.city && <span style={{ fontSize: 11, color: '#64748b' }}>{poi.city}{poi.state ? `, ${poi.state}` : ''}</span>}
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: ts.bg, color: ts.color }}>{POI_TYPE_LABEL[typeKey] || typeKey}</span>
                                <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 'auto' }}>r={poi.radius_meters || 1000}m</span>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 4, background: '#dbeafe', color: '#1e40af' }}>🚗 {poi.vehiclesAtPoi.length}</span>
                              </div>

                              {/* Approaching vehicles (within 300m but outside POI boundary) */}
                              {poi.approachingVehicles.length > 0 && (
                                <div style={{ background: '#eff6ff', border: '1px solid #2563eb', borderRadius: 7, padding: '5px 9px', marginBottom: 6 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: '#1e40af', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    🔜 APPROACHING <span style={{ fontWeight: 500, opacity: 0.75 }}>({poi.approachingVehicles.length}) — within 300m of boundary</span>
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                    {poi.approachingVehicles.map(v => (
                                      <VehiclePill key={v.vehicle_number || v.number} v={v} bg="transparent" border="#3b82f6"
                                        extraLabel={v.nearby_poi_dist_m != null ? `~${v.nearby_poi_dist_m}m away` : null} />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Grouped rows */}
                              {poi.vehiclesAtPoi.length > 0 && (hasAnyEwb ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {LOAD_GROUPS.map(g => {
                                    const list = grouped[g.key];
                                    if (list.length === 0) return null;
                                    return (
                                      <div key={g.key} style={{ background: g.bg, border: `1px solid ${g.border}`, borderRadius: 7, padding: '5px 9px' }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: g.color, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                                          {g.icon} {g.label.toUpperCase()} <span style={{ fontWeight: 500, opacity: 0.75 }}>({list.length})</span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                          {list.map(v => <VehiclePill key={v.vehicle_number || v.number} v={v} bg="#fff" border={g.border} />)}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {sortVehiclesByTime(poi.vehiclesAtPoi).map(v => (
                                    <VehiclePill key={v.vehicle_number || v.number} v={v} />
                                  ))}
                                </div>
                              ))}
                            </li>
                          );
                        })}
                      </ul>

                      {/* In-transit section */}
                      {inTransit.length > 0 && (
                        <div style={{ marginTop: 16, borderTop: '1px dashed #e2e8f0', paddingTop: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#9a3412', marginBottom: 8 }}>🛣️ IN TRANSIT ({inTransit.length})</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {sortVehiclesByTime(inTransit).map(v => (
                              <VehiclePill key={v.vehicle_number || v.number} v={v} bg="#fff7ed" border="#fed7aa" extraLabel={v.city || null} />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : null}
          </>
        )}

        {(activeTab === 'vehicles' || activeTab === 'vehicles-new') && <VehicleManagement />}



        {activeTab === 'tracker' && (
          <div style={{ padding: 32, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
            <VehicleTrackerTab vehicles={vehicles} />
          </div>
        )}

        {activeTab === 'poimanagement' && (
          <div style={{ padding: 32, maxWidth: 1500, margin: '0 auto' }}>
            <POIManagement />
          </div>
        )}

        {activeTab === 'ewaybill' && (
          <EwayBillHub defaultTab="vehicles" />
        )}

        {(activeTab === 'unloading-rates' || activeTab === 'bulk-unloading-charges') && (
          <div style={{ padding: 32, maxWidth: 1500, margin: '0 auto' }}>
            <BulkUnloadingCharges />
          </div>
        )}

        {activeTab === 'trip-dispatch' && <TripDispatchWizard />}

        {activeTab === 'trip-monitor' && <TripMonitor />}

        {activeTab === 'route-ops' && <RouteOperations />}

        {activeTab === 'munshi-ops' && <MunshiPage munshis={munshis} onRefresh={refreshVehicleContext} onNavigate={setActiveTab} />}

        {activeTab === '__dev__' && <DevAdmin />}

        {activeTab === 'route-memory' && <RouteMemoryAdmin />}

        {activeTab === 'ledgers' && <Ledgers />}

        {activeTab === 'poi' && (
          <div style={{ padding: 32 }}>
            <h2 style={{ color: '#1e293b', fontWeight: 700, fontSize: 28, marginBottom: 16 }}>POI Details (Sorted by Vehicle Count)</h2>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {pois.sort((poiA, poiB) => {
                const normVehicles = vehicles.map(v => ({ ...v, latitude: v.latitude ?? v.lat, longitude: v.longitude ?? v.lng }));
                // Count vehicles for poiA
                const vehiclesA = normVehicles.filter(v => {
                  if (!v.latitude || !v.longitude || !poiA.latitude || !poiA.longitude) return false;
                  const dist = haversine(parseFloat(v.latitude), parseFloat(v.longitude), parseFloat(poiA.latitude), parseFloat(poiA.longitude));
                  return dist <= 1500;
                }).length;
                
                // Count vehicles for poiB
                const vehiclesB = normVehicles.filter(v => {
                  if (!v.latitude || !v.longitude || !poiB.latitude || !poiB.longitude) return false;
                  const dist = haversine(parseFloat(v.latitude), parseFloat(v.longitude), parseFloat(poiB.latitude), parseFloat(poiB.longitude));
                  return dist <= 1500;
                }).length;
                
                // Sort descending (highest vehicle count first)
                return vehiclesB - vehiclesA;
              }).map((poi) => {
                const normVehicles = vehicles.map(v => ({ ...v, latitude: v.latitude ?? v.lat, longitude: v.longitude ?? v.lng }));
                // Only show vehicles within POI's radius
                const poiRadius = poi.radius_meters || 1000; // Use POI's radius, default 1000m
                const vehiclesAtPoi = normVehicles.filter(v => {
                  if (!v.latitude || !v.longitude || !poi.latitude || !poi.longitude) return false;
                  const dist = haversine(
                    parseFloat(v.latitude),
                    parseFloat(v.longitude),
                    parseFloat(poi.latitude),
                    parseFloat(poi.longitude)
                  );
                  return dist <= poiRadius;
                });
                return (
                  <li key={poi.id} style={{ marginBottom: 12, background: '#f1f5f9', borderRadius: 8, padding: '12px 16px', border: '2px solid #3b82f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 600, fontSize: 16, minWidth: '200px' }}>{poi.display_name || poi.poi_name || poi.name}</div>
                      <div style={{ color: '#475569', fontSize: 13 }}>ID: {poi.id}</div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>📍 {poiRadius}m</div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>🚗 {vehiclesAtPoi.length} vehicles</div>
                    </div>
                    {vehiclesAtPoi.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <span style={{ fontWeight: 500, color: '#334155', fontSize: 13 }}>Vehicles (sorted by stop time)</span>
                        <ul style={{ margin: '4px 0', padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {sortVehiclesByTime(vehiclesAtPoi).map(v => {
                            let cardBg = '#fff';
                            let textColor = '#0a0a0a';
                            if (v.gps_time) {
                              const now = new Date();
                              const dt = new Date(v.gps_time);
                              const diffMs = now - dt;
                              if (!isNaN(diffMs) && diffMs >= 0) {
                                const diffSec = Math.floor(diffMs / 1000);
                                const days = Math.floor(diffSec / (3600 * 24));
                                if (days > 2) {
                                  cardBg = '#fecaca';
                                  textColor = '#b91c1c';
                                } else if (days > 1) {
                                  cardBg = '#fef08a';
                                  textColor = '#92400e';
                                }
                              }
                            }
                            const vNumber = v.vehicle_number || v.number || 'Unknown';
                            return (
                              <li key={vNumber} style={{ background: cardBg, borderRadius: 6, padding: '6px 10px', fontWeight: 600, color: textColor, border: '2px solid #3b82f6', fontSize: 12, display: 'inline-block' }}>
                                <div style={{ color: '#1e40af', fontWeight: 800, fontSize: 13 }}>
                                  {vNumber}
                                </div>
                                <div style={{ fontWeight: 500, fontSize: 11, marginTop: 1, color: textColor }}>
                                  {v.gps_time ? formatDurationSince(v.gps_time) : 'Unknown'}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {activeTab === 'settings' && (() => {
          if (fuelTypeRates.length === 0) fetchFuelTypeRates();
          if (settingDrivers.length === 0) loadSettingDrivers();
          return (
          <div style={{ padding: 32 }}>
            <h2 style={{ color: '#1e293b', fontWeight: 700, fontSize: 28, marginBottom: 32 }}>Settings</h2>
            
            {/* User Info Card */}
            <div style={{
              background: 'white',
              border: '2px solid #3b82f6',
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#1e293b', fontWeight: 600, fontSize: 18, marginBottom: 16 }}>User Account</h3>
              <div style={{ color: '#475569', fontSize: 14, marginBottom: 8 }}>
                <strong>Client Name:</strong> {CLIENT_NAME}
              </div>
              <div style={{ color: '#475569', fontSize: 14, marginBottom: 8 }}>
                <strong>Email:</strong> {JSON.parse(localStorage.getItem('user') || '{}').email || 'Not logged in'}
              </div>
              <div style={{ color: '#475569', fontSize: 14, marginBottom: 8 }}>
                <strong>Client ID:</strong> {localStorage.getItem('clientId') || 'CLIENT_001'}
              </div>
              <div style={{ color: '#475569', fontSize: 14 }}>
                <strong>Logged In:</strong> {localStorage.getItem('isLoggedIn') === 'true' ? '✓ Yes' : '✗ No'}
              </div>
            </div>

            {/* Radius Settings */}
            <div style={{
              background: 'white',
              border: '2px solid #3b82f6',
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#1e293b', fontWeight: 600, fontSize: 18, marginBottom: 20 }}>POI Radius Threshold Settings</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontWeight: 500, marginBottom: 6 }}>Minimum Radius (m)</label>
                  <input
                    type="number"
                    value={minRadius}
                    onChange={(e) => setMinRadius(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontWeight: 500, marginBottom: 6 }}>Default Radius (m)</label>
                  <input
                    type="number"
                    value={defaultRadius}
                    onChange={(e) => setDefaultRadius(Math.max(minRadius, Math.min(maxRadius, parseInt(e.target.value) || defaultRadius)))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontWeight: 500, marginBottom: 6 }}>Maximum Radius (m)</label>
                  <input
                    type="number"
                    value={maxRadius}
                    onChange={(e) => setMaxRadius(Math.max(minRadius, parseInt(e.target.value) || maxRadius))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginTop: 12, padding: '8px 12px', background: '#f1f5f9', borderRadius: 6 }}>
                💡 These settings control the allowed radius range when creating new POIs. Default value will be pre-filled in the Add POI form.
              </p>
            </div>

            {/* POI Add Form */}
            <div style={{
              background: 'white',
              border: '2px solid #3b82f6',
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#1e293b', fontWeight: 600, fontSize: 18, marginBottom: 20 }}>Add New POI</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontWeight: 500, marginBottom: 6 }}>POI Name</label>
                  <input
                    type="text"
                    id="poiName"
                    placeholder="e.g., HAIER WAREHOUSE"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontWeight: 500, marginBottom: 6 }}>City</label>
                  <input
                    type="text"
                    id="poiCity"
                    placeholder="e.g., Gurugram, Faridabad"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', color: '#475569', fontWeight: 500, marginBottom: 6 }}>Latitude</label>
                    <input
                      type="number"
                      id="poiLat"
                      placeholder="-90 to 90"
                      step="0.0001"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        fontSize: 14,
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#475569', fontWeight: 500, marginBottom: 6 }}>Longitude</label>
                    <input
                      type="number"
                      id="poiLon"
                      placeholder="-180 to 180"
                      step="0.0001"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: 6,
                        fontSize: 14,
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontWeight: 500, marginBottom: 6 }}>Radius (meters)</label>
                  <input
                    type="number"
                    id="poiRadius"
                    placeholder={`${minRadius} - ${maxRadius}`}
                    defaultValue={defaultRadius}
                    min={minRadius}
                    max={maxRadius}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: 'inherit'
                    }}
                  />
                  <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Allowed: {minRadius}m - {maxRadius}m</p>
                </div>
                <div id="poiMessage" style={{ fontSize: 13, fontWeight: 500, display: 'none' }}></div>
                <button
                  onClick={() => {
                    const name = document.getElementById('poiName').value.trim();
                    const city = document.getElementById('poiCity').value.trim();
                    const lat = parseFloat(document.getElementById('poiLat').value);
                    const lon = parseFloat(document.getElementById('poiLon').value);
                    const radius = parseInt(document.getElementById('poiRadius').value);
                    const msgDiv = document.getElementById('poiMessage');
                    
                    // Validation
                    if (!name || name.length < 2) {
                      msgDiv.textContent = '❌ POI name must be at least 2 characters';
                      msgDiv.style.color = '#ef4444';
                      msgDiv.style.display = 'block';
                      return;
                    }
                    if (!city || city.length < 2) {
                      msgDiv.textContent = '❌ City name must be at least 2 characters';
                      msgDiv.style.color = '#ef4444';
                      msgDiv.style.display = 'block';
                      return;
                    }
                    if (isNaN(lat) || lat < -90 || lat > 90) {
                      msgDiv.textContent = '❌ Latitude must be between -90 and 90';
                      msgDiv.style.color = '#ef4444';
                      msgDiv.style.display = 'block';
                      return;
                    }
                    if (isNaN(lon) || lon < -180 || lon > 180) {
                      msgDiv.textContent = '❌ Longitude must be between -180 and 180';
                      msgDiv.style.color = '#ef4444';
                      msgDiv.style.display = 'block';
                      return;
                    }
                    if (isNaN(radius) || radius < minRadius || radius > maxRadius) {
                      msgDiv.textContent = `❌ Radius must be between ${minRadius} and ${maxRadius} meters`;
                      msgDiv.style.color = '#ef4444';
                      msgDiv.style.display = 'block';
                      return;
                    }
                    
                    // Send to API
                    msgDiv.textContent = '⏳ Adding POI...';
                    msgDiv.style.color = '#0284c7';
                    msgDiv.style.display = 'block';
                    
                    const clientId = localStorage.getItem('clientId') || 'CLIENT_001';
                    fetch('/api/pois/create', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        poi_name: name,
                        city: city,
                        latitude: lat,
                        longitude: lon,
                        radius_meters: radius,
                        client_id: clientId
                      })
                    })
                    .then(r => r.json())
                    .then(data => {
                      if (data.success) {
                        msgDiv.textContent = '✅ POI added successfully! Refreshing...';
                        msgDiv.style.color = '#22c55e';
                        msgDiv.style.display = 'block';
                        document.getElementById('poiName').value = '';
                        document.getElementById('poiCity').value = '';
                        document.getElementById('poiLat').value = '';
                        document.getElementById('poiLon').value = '';
                        document.getElementById('poiRadius').value = '1000';
                        setTimeout(() => window.location.reload(), 1500);
                      } else {
                        msgDiv.textContent = `❌ Error: ${data.error || 'Failed to add POI'}`;
                        msgDiv.style.color = '#ef4444';
                        msgDiv.style.display = 'block';
                      }
                    })
                    .catch(err => {
                      msgDiv.textContent = `❌ Error: ${err.message}`;
                      msgDiv.style.color = '#ef4444';
                      msgDiv.style.display = 'block';
                    });
                  }}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: '2px solid #3b82f6',
                    padding: '12px 24px',
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                  onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
                >
                  ➕ Add POI
                </button>
              </div>
            </div>

            {/* Edit POI Form */}
            <div style={{
              background: 'white',
              border: '2px solid #8b5cf6',
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#1e293b', fontWeight: 600, fontSize: 18, marginBottom: 20 }}>Edit Existing POI</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontWeight: 500, marginBottom: 6 }}>Select POI to Edit</label>
                  <select
                    onChange={(e) => {
                      const poi = pois.find(p => p.id === parseInt(e.target.value));
                      if (poi) {
                        setSelectedPOIForEdit(poi.id);
                        _setEditingPOI({...poi});
                        document.getElementById('editPoiName').value = poi.poi_name;
                        document.getElementById('editPoiCity').value = poi.city || '';
                        document.getElementById('editPoiLat').value = poi.latitude;
                        document.getElementById('editPoiLon').value = poi.longitude;
                        document.getElementById('editPoiRadius').value = poi.radius_meters;
                      }
                    }}
                    defaultValue=""
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      fontSize: 14,
                      fontFamily: 'inherit'
                    }}
                  >
                    <option value="">-- Select a POI --</option>
                    {pois.map((poi) => (
                      <option key={poi.id} value={poi.id}>
                        {poi.display_name || poi.poi_name} ({poi.id})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPOIForEdit && (
                  <>
                    <div>
                      <label style={{ display: 'block', color: '#475569', fontWeight: 500, marginBottom: 6 }}>POI Name</label>
                      <input
                        type="text"
                        id="editPoiName"
                        placeholder="POI Name"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          fontSize: 14,
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#475569', fontWeight: 500, marginBottom: 6 }}>City</label>
                      <input
                        type="text"
                        id="editPoiCity"
                        placeholder="e.g., Gurugram, Faridabad"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          fontSize: 14,
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <label style={{ display: 'block', color: '#475569', fontWeight: 500, marginBottom: 6 }}>Latitude</label>
                        <input
                          type="number"
                          id="editPoiLat"
                          placeholder="-90 to 90"
                          step="0.0001"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                            fontSize: 14,
                            fontFamily: 'inherit'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: '#475569', fontWeight: 500, marginBottom: 6 }}>Longitude</label>
                        <input
                          type="number"
                          id="editPoiLon"
                          placeholder="-180 to 180"
                          step="0.0001"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                            fontSize: 14,
                            fontFamily: 'inherit'
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', color: '#475569', fontWeight: 500, marginBottom: 6 }}>Radius (meters)</label>
                      <input
                        type="number"
                        id="editPoiRadius"
                        placeholder={`${minRadius} - ${maxRadius}`}
                        min={minRadius}
                        max={maxRadius}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          fontSize: 14,
                          fontFamily: 'inherit'
                        }}
                      />
                      <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Allowed: {minRadius}m - {maxRadius}m</p>
                    </div>
                    <div id="editPoiMessage" style={{ fontSize: 13, fontWeight: 500, display: 'none' }}></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <button
                        onClick={() => {
                          const name = document.getElementById('editPoiName').value.trim();
                          const city = document.getElementById('editPoiCity').value.trim();
                          const lat = parseFloat(document.getElementById('editPoiLat').value);
                          const lon = parseFloat(document.getElementById('editPoiLon').value);
                          const radius = parseInt(document.getElementById('editPoiRadius').value);
                          const msgDiv = document.getElementById('editPoiMessage');
                          
                          // Validation
                          if (!name || name.length < 2) {
                            msgDiv.textContent = '❌ POI name must be at least 2 characters';
                            msgDiv.style.color = '#ef4444';
                            msgDiv.style.display = 'block';
                            return;
                          }
                          if (!city || city.length < 2) {
                            msgDiv.textContent = '❌ City name must be at least 2 characters';
                            msgDiv.style.color = '#ef4444';
                            msgDiv.style.display = 'block';
                            return;
                          }
                          if (isNaN(lat) || lat < -90 || lat > 90) {
                            msgDiv.textContent = '❌ Latitude must be between -90 and 90';
                            msgDiv.style.color = '#ef4444';
                            msgDiv.style.display = 'block';
                            return;
                          }
                          if (isNaN(lon) || lon < -180 || lon > 180) {
                            msgDiv.textContent = '❌ Longitude must be between -180 and 180';
                            msgDiv.style.color = '#ef4444';
                            msgDiv.style.display = 'block';
                            return;
                          }
                          if (isNaN(radius) || radius < minRadius || radius > maxRadius) {
                            msgDiv.textContent = `❌ Radius must be between ${minRadius} and ${maxRadius} meters`;
                            msgDiv.style.color = '#ef4444';
                            msgDiv.style.display = 'block';
                            return;
                          }
                          
                          // Send to API
                          msgDiv.textContent = '⏳ Updating POI...';
                          msgDiv.style.color = '#0284c7';
                          msgDiv.style.display = 'block';
                          
                          fetch(`/api/pois/${selectedPOIForEdit}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              poi_name: name,
                              city: city,
                              latitude: lat,
                              longitude: lon,
                              radius_meters: radius
                            })
                          })
                          .then(r => r.json())
                          .then(data => {
                            if (data.success) {
                              msgDiv.textContent = '✅ POI updated successfully! Refreshing...';
                              msgDiv.style.color = '#22c55e';
                              msgDiv.style.display = 'block';
                              setTimeout(() => window.location.reload(), 1500);
                            } else {
                              msgDiv.textContent = `❌ Error: ${data.error || 'Failed to update POI'}`;
                              msgDiv.style.color = '#ef4444';
                              msgDiv.style.display = 'block';
                            }
                          })
                          .catch(err => {
                            msgDiv.textContent = `❌ Error: ${err.message}`;
                            msgDiv.style.color = '#ef4444';
                            msgDiv.style.display = 'block';
                          });
                        }}
                        style={{
                          background: '#8b5cf6',
                          color: 'white',
                          border: '2px solid #8b5cf6',
                          padding: '12px 24px',
                          borderRadius: 8,
                          fontSize: 15,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#7c3aed'}
                        onMouseLeave={(e) => e.target.style.background = '#8b5cf6'}
                      >
                        💾 Update POI
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPOIForEdit(null);
                          _setEditingPOI(null);
                          document.getElementById('editPoiMessage').style.display = 'none';
                        }}
                        style={{
                          background: '#6b7280',
                          color: 'white',
                          border: '2px solid #6b7280',
                          padding: '12px 24px',
                          borderRadius: 8,
                          fontSize: 15,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#4b5563'}
                        onMouseLeave={(e) => e.target.style.background = '#6b7280'}
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Fuel Type Rates */}
            <div style={{
              background: 'white',
              border: '2px solid #f59e0b',
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#1e293b', fontWeight: 600, fontSize: 18, marginBottom: 6 }}>⛽ Fuel Type Rates (₹/Liter)</h3>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>Master rates — shared across all clients, used in Trip Dispatch when a vehicle has no per-vehicle rate.</p>

              {/* Auto-fetch bar */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, padding: '12px 14px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#0369a1' }}>🌐 Live State Prices:</span>
                <select
                  value={fuelFetchState}
                  onChange={e => setFuelFetchState(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #93c5fd', fontSize: 13, background: '#fff' }}
                >
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  onClick={autoFetchFuelRates}
                  disabled={fuelFetchLoading}
                  style={{ padding: '7px 16px', background: fuelFetchLoading ? '#94a3b8' : '#0284c7', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: fuelFetchLoading ? 'not-allowed' : 'pointer' }}
                >
                  {fuelFetchLoading ? '⏳ Fetching...' : '🔄 Auto-fetch Today\'s Rates'}
                </button>
                {fuelFetchMsg && (
                  <span style={{ fontSize: 12, color: fuelFetchMsg.ok ? '#15803d' : '#b91c1c', fontWeight: 600 }}>{fuelFetchMsg.text}</span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                {[{type:'Diesel',icon:'🟤',color:'#fef3c7'},{type:'Petrol',icon:'🟡',color:'#fff3e0'},{type:'CNG',icon:'🟢',color:'#dcfce7'},{type:'Electric',icon:'⚡',color:'#e0e7ff'}].map(({type, icon, color}) => (
                  <div key={type} style={{ background: color, borderRadius: 10, padding: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{icon} {type}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 18, fontWeight: 600, color: '#374151' }}>₹</span>
                      <input
                        type="number" step="0.01" min="0"
                        value={fuelRateEdits[type] ?? ''}
                        onChange={e => setFuelRateEdits(prev => ({ ...prev, [type]: e.target.value }))}
                        style={{ flex: 1, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 15, fontWeight: 600, width: '100%' }}
                        placeholder="0.00"
                      />
                      <span style={{ fontSize: 13, color: '#64748b' }}>/L</span>
                    </div>
                    <button
                      onClick={() => saveFuelTypeRate(type)}
                      disabled={fuelRateSaving === type}
                      style={{ marginTop: 10, width: '100%', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    >
                      {fuelRateSaving === type ? '⏳ Saving...' : '💾 Save'}
                    </button>
                  </div>
                ))}
              </div>
              {/* Save All button */}
              <button
                onClick={saveAllFuelRates}
                disabled={!!fuelRateSaving}
                style={{ marginTop: 16, padding: '10px 24px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                💾 Save All Rates to Master
              </button>
            </div>

            {/* Driver Salary Master */}
            <div style={{
              background: 'white',
              border: '2px solid #6366f1',
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h3 style={{ color: '#1e293b', fontWeight: 600, fontSize: 18, margin: 0 }}>👤 Driver Salary Master</h3>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Set monthly salary for each driver. Used for ledger calculations.</p>
                </div>
                <button onClick={loadSettingDrivers} style={{ padding: '7px 14px', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>🔄 Refresh</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {settingDrivers.map(d => (
                  <div key={d.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', minWidth: 230 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>{d.id} · {d.phone || '—'}</div>
                    {settingDriverEditingId === d.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: '#64748b' }}>₹</span>
                        <input
                          type="number" autoFocus
                          value={settingDriverSalaryEdits[d.id] || ''}
                          onChange={e => setSettingDriverSalaryEdits(prev => ({ ...prev, [d.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') saveDriverSalaryInSettings(d.id); if (e.key === 'Escape') setSettingDriverEditingId(null); }}
                          style={{ width: 100, padding: '5px 8px', fontSize: 13, border: '2px solid #6366f1', borderRadius: 6 }}
                          placeholder="e.g. 18000"
                        />
                        <button onClick={() => saveDriverSalaryInSettings(d.id)} disabled={settingDriverSaving === d.id}
                          style={{ padding: '5px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                          {settingDriverSaving === d.id ? '…' : '✓'}
                        </button>
                        <button onClick={() => setSettingDriverEditingId(null)}
                          style={{ padding: '5px 8px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 5, cursor: 'pointer', fontSize: 13 }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: parseFloat(d.monthly_salary) > 0 ? '#4338ca' : '#94a3b8' }}>
                          {parseFloat(d.monthly_salary) > 0 ? `₹${parseInt(d.monthly_salary).toLocaleString('en-IN')} /mo` : 'Not set'}
                        </span>
                        <button onClick={() => setSettingDriverEditingId(d.id)}
                          style={{ padding: '5px 12px', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✏️ Edit</button>
                      </div>
                    )}
                  </div>
                ))}
                {settingDrivers.length === 0 && (
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>No drivers found. Click Refresh to load.</span>
                )}
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => {
                localStorage.removeItem('user');
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('clientId');
                window.location.href = '/';
              }}
              style={{
                background: '#ef4444',
                color: 'white',
                border: '2px solid #3b82f6',
                padding: '12px 24px',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#dc2626'}
              onMouseLeave={(e) => e.target.style.background = '#ef4444'}
            >
              🚪 Logout
            </button>
          </div>
          );
        })()}

        {trackModalVehicle && (
          <TrackModal
            vehicle={trackModalVehicle}
            onClose={() => setTrackModalVehicle(null)}
            onTrack={async ({ from, to, reversePoints }) => {
              // Use vehicle_number as the primary identifier for tracking
              const vId = trackModalVehicle.vehicle_number || trackModalVehicle.id || trackModalVehicle.number;
              setTrackModalVehicle(null);
              try {
                const { fetchVehicleTrack } = await import('./services/api.js');
                let path = await fetchVehicleTrack(vId, { from, to, tenantId: tenantKey });
                path = Array.isArray(path) ? path : [];
                if (reversePoints && path.length > 0) {
                  path = [...path].reverse();
                }
                // trackedPath removed as it is unused
              } catch {
                // error handling for track modal (was setting trackError, now just comment)
                // trackedPath removed as it is unused
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

export default App;
