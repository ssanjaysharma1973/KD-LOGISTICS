/**
 * RoutesPage.jsx — Modern Routes Management with Live OSRM Road Path Map
 * Dark theme, route cards sidebar, Leaflet map with yellow highway + blue local routes
 */
import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API_BASE } from '../utils/apiBase.js';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ROUTE_COLORS = [
  '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#a855f7',
  '#14b8a6', '#eab308',
];

function FitBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length >= 2) {
      try {
        const bounds = L.latLngBounds(coords.map(c => [c[1], c[0]]));
        map.fitBounds(bounds, { padding: [60, 60] });
      } catch (_e) { /* invalid bounds */ }
    }
  }, [coords, map]);
  return null;
}

const inp = {
  width: '100%',
  padding: '9px 12px',
  background: '#0f172a',
  border: '1px solid #475569',
  borderRadius: 8,
  color: '#e2e8f0',
  fontSize: 13,
  boxSizing: 'border-box',
};

const sel = { ...inp, cursor: 'pointer' };

export default function RoutesPage({ clientId = 'CLIENT_001' }) {
  const [routes, setRoutes] = useState([]);
  const [pois, setPois]     = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [selectedRoute, setSelectedRoute]   = useState(null);
  const [routeGeom, setRouteGeom]           = useState(null);
  const [fetchingRoute, setFetchingRoute]   = useState(false);
  const [showForm, setShowForm]             = useState(false);
  const [editingRoute, setEditingRoute]     = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [deleting, setDeleting]             = useState(null);
  const [fromCity, setFromCity]             = useState('');
  const [toCity, setToCity]                 = useState('');
  const [form, setForm] = useState({
    route_no: '', route_name: '', from_location: '', to_location: '',
    route_km: '', expense_per_km: '', num_points: 0, total_estimated_expense: '', toll_charges: '',
  });

  // Live vehicle tracking per route
  const [liveData,       setLiveData]       = useState({}); // routeId -> { vehicles, loading, ts }
  const [liveExpanded,   setLiveExpanded]   = useState({}); // routeId -> bool
  const [showAllRoutes,  setShowAllRoutes]  = useState(false); // false = live only
  const [liveCountsLoaded, setLiveCountsLoaded] = useState(false);
  const liveIntervalRef = React.useRef({});

  const fetchLiveVehicles = useCallback(async (routeId) => {
    setLiveData(p => ({ ...p, [routeId]: { ...(p[routeId] || {}), loading: true } }));
    try {
      const res  = await fetch(`${API_BASE}/api/standard-routes/${routeId}/live-vehicles`);
      const json = await res.json();
      setLiveData(p => ({
        ...p,
        [routeId]: { vehicles: json.vehicles || [], active_count: json.active_count || 0, loading: false, ts: new Date() },
      }));
    } catch {
      setLiveData(p => ({ ...p, [routeId]: { vehicles: [], active_count: 0, loading: false, ts: new Date() } }));
    }
  }, []);

  const toggleLiveTrack = useCallback((routeId) => {
    setLiveExpanded(p => {
      const next = { ...p, [routeId]: !p[routeId] };
      if (next[routeId]) {
        fetchLiveVehicles(routeId);
        liveIntervalRef.current[routeId] = setInterval(() => fetchLiveVehicles(routeId), 30000);
      } else {
        clearInterval(liveIntervalRef.current[routeId]);
        delete liveIntervalRef.current[routeId];
      }
      return next;
    });
  }, [fetchLiveVehicles]);

  // Cleanup intervals on unmount
  React.useEffect(() => {
    const ref = liveIntervalRef.current;
    return () => Object.values(ref).forEach(clearInterval);
  }, []);

  // Bulk vehicle-POI link
  const [bulkModal,    setBulkModal]    = useState(null); // { route, poiType: 'from'|'to' }
  const [bulkVehicles, setBulkVehicles] = useState([]);
  const [bulkChecked,  setBulkChecked]  = useState(new Set());
  const [bulkOriginal, setBulkOriginal] = useState(new Set());
  const [bulkSaving,   setBulkSaving]   = useState(false);
  const [bulkSearch,   setBulkSearch]   = useState('');
  const [bulkLoading,  setBulkLoading]  = useState(false);

  // Map-click POI selection mode
  const [mapSelectMode, setMapSelectMode]         = useState(false);
  const [mapFromPoi, setMapFromPoi]               = useState(null);
  const [mapToPoi, setMapToPoi]                   = useState(null);
  const [mapPreviewGeom, setMapPreviewGeom]       = useState(null);
  const [mapPreviewLoading, setMapPreviewLoading] = useState(false);
  const [showMapConfirm, setShowMapConfirm]       = useState(false);

  // ── Data Fetch ──────────────────────────────────────────────────────────────
  const fetchRoutes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/standard-routes?clientId=${encodeURIComponent(clientId)}`);
      const data = await res.json();
      setRoutes(Array.isArray(data) ? data : []);
    } catch { setRoutes([]); }
  }, [clientId]);

  const fetchPois = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/pois?clientId=${encodeURIComponent(clientId)}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setPois(list);
      setCities([...new Set(list.map(p => p.city).filter(Boolean))].sort());
    } catch { setPois([]); }
  }, [clientId]);

  // Auto-fetch live counts for all routes when routes load
  const fetchAllLiveCounts = useCallback(async (routeList) => {
    await Promise.all(routeList.map(r => fetchLiveVehicles(r.id)));
    setLiveCountsLoaded(true);
  }, [fetchLiveVehicles]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchRoutes(), fetchPois()]).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchRoutes, fetchPois]);

  // Once routes arrive, fetch all live counts
  useEffect(() => {
    if (routes.length > 0) {
      setLiveCountsLoaded(false);
      fetchAllLiveCounts(routes);
    }
  }, [routes, fetchAllLiveCounts]);

  // ── OSRM Road Path ──────────────────────────────────────────────────────────
  const fetchOsrmRoute = async (route) => {
    const fromPoi = pois.find(p => p.poi_name === route.from_location);
    const toPoi   = pois.find(p => p.poi_name === route.to_location);
    if (!fromPoi?.latitude || !toPoi?.latitude) return;
    setFetchingRoute(true);
    try {
      const coordStr = `${fromPoi.longitude},${fromPoi.latitude};${toPoi.longitude},${toPoi.latitude}`;
      const res  = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&alternatives=true`);
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.length > 0) {
        setRouteGeom({
          highway:    data.routes[0].geometry.coordinates,
          highwayKm:  (data.routes[0].distance / 1000).toFixed(1),
          local:      data.routes[1]?.geometry.coordinates || null,
          localKm:    data.routes[1] ? (data.routes[1].distance / 1000).toFixed(1) : null,
          fromPoi,
          toPoi,
        });
      }
    } catch (_e) { /* OSRM unavailable — no road path */ }
    setFetchingRoute(false);
  };

  const handleSelectRoute = (route) => {
    setSelectedRoute(route);
    setRouteGeom(null);
    fetchOsrmRoute(route);
  };

  // ── Form Helpers ─────────────────────────────────────────────────────────────
  const openAddForm = () => {
    setEditingRoute(null);
    setFromCity(''); setToCity('');
    setForm({ route_no: '', route_name: '', from_location: '', to_location: '', route_km: '', expense_per_km: '18', num_points: 0, total_estimated_expense: '', toll_charges: '' });
    setMapSelectMode(true);
    setMapFromPoi(null);
    setMapToPoi(null);
    setMapPreviewGeom(null);
    setShowMapConfirm(false);
    setShowForm(false);
  };

  const resetMapSelect = () => {
    setMapFromPoi(null);
    setMapToPoi(null);
    setMapPreviewGeom(null);
    setShowMapConfirm(false);
  };

  const handlePoiMapClick = async (poi) => {
    if (!mapFromPoi) {
      setMapFromPoi(poi);
    } else if (poi.id !== mapFromPoi.id && !mapToPoi) {
      setMapToPoi(poi);
      setMapPreviewLoading(true);
      const from = mapFromPoi;
      let km = null;
      let previewGeom = null;
      try {
        const coordStr = `${from.longitude},${from.latitude};${poi.longitude},${poi.latitude}`;
        const res  = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&alternatives=true`);
        const data = await res.json();
        if (data.code === 'Ok' && data.routes?.length > 0) {
          km = (data.routes[0].distance / 1000).toFixed(1);
          previewGeom = {
            highway:   data.routes[0].geometry.coordinates,
            highwayKm: km,
            local:     data.routes[1]?.geometry.coordinates || null,
            localKm:   data.routes[1] ? (data.routes[1].distance / 1000).toFixed(1) : null,
          };
          setMapPreviewGeom(previewGeom);
        } else throw new Error('no route');
      } catch {
        // Fallback: Haversine straight-line
        const R = 6371;
        const lat1 = from.latitude  * Math.PI / 180;
        const lat2 = poi.latitude   * Math.PI / 180;
        const dLat = lat2 - lat1;
        const dLon = (poi.longitude - from.longitude) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
        km = (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
      }
      const autoToll = km ? Math.round(parseFloat(km) * 5.5).toString() : '';
      setForm(f => ({
        ...f,
        from_location: from.poi_name,
        to_location:   poi.poi_name,
        route_km:      km,
        route_name:    f.route_name || `${from.poi_name} → ${poi.poi_name}`,
        total_estimated_expense: calcExpense(km, f.expense_per_km),
        toll_charges:  f.toll_charges || autoToll,
      }));
      setMapPreviewLoading(false);
      setShowMapConfirm(true);
    }
  };

  const handleMapConfirmSubmit = async (e) => {
    e.preventDefault();
    if (!form.route_no || !form.from_location || !form.to_location) {
      alert('Fill Route No, From and To POI');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/standard-routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, clientId }),
      });
      if (res.ok) {
        setMapSelectMode(false);
        setShowMapConfirm(false);
        resetMapSelect();
        fetchRoutes();
      } else { const msg = await res.text(); alert('Save failed: ' + msg); }
    } catch (err) { alert('Save error: ' + err.message); }
    setSaving(false);
  };

  const openEditForm = (route) => {
    setEditingRoute(route);
    const fp = pois.find(p => p.poi_name === route.from_location);
    const tp = pois.find(p => p.poi_name === route.to_location);
    setFromCity(fp?.city || '');
    setToCity(tp?.city || '');
    const km = parseFloat(route.route_km) || 0;
    setForm({
      ...route,
      toll_charges: route.toll_charges != null ? route.toll_charges : (km > 0 ? Math.round(km * 5.5).toString() : ''),
    });
    setShowForm(true);
  };

  const calcExpense = (km, rate) => {
    const k = parseFloat(km) || 0;
    const r = parseFloat(rate) || 0;
    return k && r ? (k * r).toFixed(2) : '';
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!form.route_no || !form.from_location || !form.to_location) {
      alert('Fill required fields: Route No, From POI, To POI');
      return;
    }
    setSaving(true);
    try {
      const url    = editingRoute ? `${API_BASE}/api/standard-routes/${editingRoute.id}` : `${API_BASE}/api/standard-routes`;
      const method = editingRoute ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, clientId }),
      });
      if (res.ok) { setShowForm(false); fetchRoutes(); }
      else { const msg = await res.text(); alert('Save failed: ' + msg); }
    } catch (err) { alert('Save error: ' + err.message); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this route?')) return;
    setDeleting(id);
    try {
      await fetch(`${API_BASE}/api/standard-routes/${id}`, { method: 'DELETE' });
      fetchRoutes();
      if (selectedRoute?.id === id) { setSelectedRoute(null); setRouteGeom(null); }
    } catch (_e) { /* delete failed */ }
    setDeleting(null);
  };

  const getPoisForCity = (city) =>
    pois.filter(p => p.city === city).sort((a, b) => a.poi_name.localeCompare(b.poi_name));

  const openBulkLink = async (route, poiType = 'from') => {
    setBulkModal({ route, poiType });
    setBulkSearch('');
    setBulkLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/vehicles-master?clientId=${encodeURIComponent(clientId)}`);
      const list = await res.json();
      const vehicles = Array.isArray(list) ? list : [];
      setBulkVehicles(vehicles);
      const poiName = poiType === 'from' ? route.from_location : route.to_location;
      const poi = pois.find(p => p.poi_name === poiName);
      const checked = new Set();
      if (poi) {
        vehicles.forEach(v => {
          try { if ((JSON.parse(v.primary_poi_ids || '[]')).includes(poi.id)) checked.add(v.id); } catch {}
        });
      }
      setBulkChecked(new Set(checked));
      setBulkOriginal(new Set(checked));
    } catch { /* ignore */ }
    setBulkLoading(false);
  };

  const switchBulkPoiType = (route, poiType) => {
    setBulkModal(m => ({ ...m, poiType }));
    setBulkSearch('');
    const poiName = poiType === 'from' ? route.from_location : route.to_location;
    const poi = pois.find(p => p.poi_name === poiName);
    const checked = new Set();
    if (poi) {
      bulkVehicles.forEach(v => {
        try { if ((JSON.parse(v.primary_poi_ids || '[]')).includes(poi.id)) checked.add(v.id); } catch {}
      });
    }
    setBulkChecked(new Set(checked));
    setBulkOriginal(new Set(checked));
  };

  const saveBulkLink = async () => {
    if (!bulkModal) return;
    const { route, poiType } = bulkModal;
    const poiName = poiType === 'from' ? route.from_location : route.to_location;
    const poi = pois.find(p => p.poi_name === poiName);
    if (!poi) { alert('POI not found in database'); return; }
    setBulkSaving(true);
    const toUpdate = bulkVehicles.filter(v => bulkOriginal.has(v.id) !== bulkChecked.has(v.id));
    await Promise.all(toUpdate.map(async v => {
      let ids; try { ids = JSON.parse(v.primary_poi_ids || '[]'); } catch { ids = []; }
      ids = bulkChecked.has(v.id) ? [...new Set([...ids, poi.id])] : ids.filter(id => id !== poi.id);
      await fetch(`${API_BASE}/api/vehicles-master/${v.id}/default-pois`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poi_ids: ids }),
      });
    }));
    // refresh local bulkVehicles so re-open is accurate
    const res  = await fetch(`${API_BASE}/api/vehicles-master?clientId=${encodeURIComponent(clientId)}`);
    const list = await res.json();
    setBulkVehicles(Array.isArray(list) ? list : []);
    setBulkSaving(false);
    setBulkModal(null);
  };

  const filteredRoutes = routes.filter(r => {
    // Live-only filter
    if (!showAllRoutes && liveCountsLoaded) {
      const ld = liveData[r.id];
      if (!ld || (ld.active_count || 0) === 0) return false;
    }
    // Search filter
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.route_name?.toLowerCase().includes(q) ||
      r.route_no?.toLowerCase().includes(q) ||
      r.from_location?.toLowerCase().includes(q) ||
      r.to_location?.toLowerCase().includes(q)
    );
  });

  const liveCount   = routes.filter(r => (liveData[r.id]?.active_count || 0) > 0).length;
  const activeVehs  = Object.values(liveData).reduce((s, d) => s + (d?.active_count || 0), 0);

  const mapCenter = routeGeom?.fromPoi
    ? [routeGeom.fromPoi.latitude, routeGeom.fromPoi.longitude]
    : [28.4695, 77.5855];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f172a', color: '#e2e8f0', overflow: 'hidden' }}>

      {/* ── TOP HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', background: '#1e293b', borderBottom: '1px solid #334155', flexShrink: 0, minHeight: 52 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', letterSpacing: 1 }}>🛣️ ROUTE MANAGEMENT</span>
        <div style={{ width: 1, height: 28, background: '#334155', margin: '0 4px' }} />
        <span style={{ fontSize: 12, color: '#64748b' }}>{routes.length} routes</span>

        {/* Selected route info */}
        {selectedRoute && (
          <>
            <div style={{ width: 1, height: 28, background: '#334155', margin: '0 4px' }} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Selected:</span>
            <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: 13 }}>{selectedRoute.route_no}</span>
            <span style={{ color: '#cbd5e1', fontSize: 12, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedRoute.from_location} → {selectedRoute.to_location}
            </span>
            {routeGeom && (
              <>
                <span style={{ background: '#78350f', color: '#fde68a', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                  🛣️ {routeGeom.highwayKm} km highway
                </span>
                {routeGeom.localKm && (
                  <span style={{ background: '#1e3a5f', color: '#93c5fd', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                    🛤️ {routeGeom.localKm} km local
                  </span>
                )}
                {parseFloat(selectedRoute?.toll_charges) > 0 && (
                  <span style={{ background: '#451a03', color: '#fbbf24', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                    🛣️ Toll ₹{Math.round(parseFloat(selectedRoute.toll_charges)).toLocaleString('en-IN')}
                  </span>
                )}
                {parseFloat(selectedRoute?.total_estimated_expense) > 0 && (
                  <span style={{ background: '#14532d', color: '#86efac', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                    🚛 Exp ₹{Math.round(parseFloat(selectedRoute.total_estimated_expense)).toLocaleString('en-IN')}
                  </span>
                )}
              </>
            )}
            {fetchingRoute && (
              <span style={{ color: '#fbbf24', fontSize: 12, fontStyle: 'italic' }}>⏳ loading road...</span>
            )}
          </>
        )}

        <span style={{ flex: 1 }} />
        <button
          onClick={openAddForm}
          style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          ➕ Add Route
        </button>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT PANEL: Route Cards ── */}
        <div style={{ width: 370, background: '#0f172a', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>

          {/* Search + Live toggle */}
          <div style={{ padding: '10px 14px', background: '#1e293b', borderBottom: '1px solid #334155' }}>
            {/* Live / All toggle */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button
                onClick={() => setShowAllRoutes(false)}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: !showAllRoutes ? '#16a34a' : '#1e293b',
                  color: !showAllRoutes ? '#fff' : '#64748b',
                  border: `1.5px solid ${!showAllRoutes ? '#16a34a' : '#334155'}`,
                }}
              >
                🟢 LIVE ONLY {liveCountsLoaded ? `(${liveCount})` : '…'}
              </button>
              <button
                onClick={() => setShowAllRoutes(true)}
                style={{
                  flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: showAllRoutes ? '#334155' : '#1e293b',
                  color: showAllRoutes ? '#e2e8f0' : '#64748b',
                  border: `1.5px solid ${showAllRoutes ? '#475569' : '#334155'}`,
                }}
              >
                📋 All Routes ({routes.length})
              </button>
            </div>
            <input
              type="text"
              placeholder="🔍 Search routes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: 10, color: '#475569', marginTop: 5 }}>
              {!showAllRoutes && liveCountsLoaded
                ? `${filteredRoutes.length} live route${filteredRoutes.length !== 1 ? 's' : ''} · ${activeVehs} active vehicle${activeVehs !== 1 ? 's' : ''}`
                : `${filteredRoutes.length} of ${routes.length} routes · click card to view on map`
              }
            </div>
          </div>

          {/* Cards list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#475569', paddingTop: 40, fontSize: 14 }}>⏳ Loading routes...</div>
            ) : filteredRoutes.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#475569', paddingTop: 40, fontSize: 14 }}>
                No routes found.
                <br />
                <button
                  onClick={openAddForm}
                  style={{ marginTop: 12, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                >
                  ➕ Add First Route
                </button>
              </div>
            ) : (
              filteredRoutes.map((route, idx) => {
                const isSelected = selectedRoute?.id === route.id;
                const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
                const km      = parseFloat(route.route_km) || 0;
                const expense = parseFloat(route.total_estimated_expense) || 0;
                const toll    = parseFloat(route.toll_charges) || 0;
                const eta = km > 0 ? `~${Math.floor(km / 55)}h ${Math.round(((km / 55) % 1) * 60)}m` : null;

                return (
                  <div
                    key={route.id}
                    onClick={() => handleSelectRoute(route)}
                    style={{
                      background: isSelected ? '#1e3a5f' : '#1e293b',
                      border: `2px solid ${isSelected ? '#3b82f6' : '#334155'}`,
                      borderRadius: 12,
                      padding: '13px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      position: 'relative',
                      overflow: 'hidden',
                      boxShadow: isSelected ? `0 0 0 1px ${color}44` : 'none',
                    }}
                  >
                    {/* Left color accent */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color, borderRadius: '12px 0 0 12px' }} />

                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingLeft: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Route No + badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                          <span style={{ background: color, color: '#000', borderRadius: 5, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>
                            {route.route_no}
                          </span>
                          {isSelected && (
                            <span style={{ fontSize: 9, background: '#1d4ed8', color: '#bfdbfe', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                              ● ON MAP
                            </span>
                          )}
                        </div>

                        {/* Route name */}
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', marginBottom: 7, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                          {route.route_name}
                        </div>

                        {/* From → To */}
                        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: '#4ade80', fontSize: 8 }}>▲</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
                            {route.from_location}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: '#f87171', fontSize: 8 }}>▼</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
                            {route.to_location}
                          </span>
                        </div>
                      </div>

                      {/* Right stats */}
                      <div style={{ textAlign: 'right', paddingLeft: 8, flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: color, lineHeight: 1 }}>
                          {km > 0 ? km : '?'}
                        </div>
                        <div style={{ fontSize: 9, color: '#64748b', marginBottom: 4 }}>km</div>
                        {eta && <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>{eta}</div>}
                        {expense > 0 && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80' }}>
                            ₹{expense.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 400 }}>transport</div>
                          </div>
                        )}
                        {toll > 0 && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', marginTop: 2 }}>
                            🛣️ ₹{Math.round(toll).toLocaleString('en-IN')}
                            <div style={{ fontSize: 9, color: '#78716c', fontWeight: 400 }}>toll</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 9, paddingLeft: 10 }}>
                      <button
                        onClick={e => { e.stopPropagation(); openEditForm(route); }}
                        style={{ flex: 1, padding: '5px 0', background: '#1d4ed8', color: '#bfdbfe', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); openBulkLink(route, 'from'); }}
                        style={{ flex: 1, padding: '5px 0', background: '#065f46', color: '#6ee7b7', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >
                        🔗 Vehicles
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); toggleLiveTrack(route.id); }}
                        style={{ flex: 1, padding: '5px 0', background: liveExpanded[route.id] ? '#78350f' : '#1c1917', color: liveExpanded[route.id] ? '#fde68a' : '#a78bfa', border: `1px solid ${liveExpanded[route.id] ? '#92400e' : '#4c1d95'}`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >
                        🚛 Live
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(route.id); }}
                        disabled={deleting === route.id}
                        style={{ flex: 1, padding: '5px 0', background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: deleting === route.id ? 0.6 : 1 }}
                      >
                        {deleting === route.id ? '...' : '🗑️ Del'}
                      </button>
                    </div>

                    {/* ── Live vehicle tracking panel ── */}
                    {liveExpanded[route.id] && (() => {
                      const ld = liveData[route.id];
                      const vehs = ld?.vehicles || [];
                      const PHASE_COLOR = {
                        loading:              { bg: '#1e3a5f', text: '#93c5fd', dot: '#3b82f6' },
                        in_transit:           { bg: '#1a2e1a', text: '#86efac', dot: '#22c55e' },
                        arrived_destination:  { bg: '#2d2000', text: '#fcd34d', dot: '#f59e0b' },
                        unloading:            { bg: '#2d1a00', text: '#fdba74', dot: '#f97316' },
                        completed:            { bg: '#14532d', text: '#6ee7b7', dot: '#10b981' },
                      };
                      return (
                        <div onClick={e => e.stopPropagation()} style={{ marginTop: 8, marginLeft: 10, marginRight: 6, background: '#0a0f1a', borderRadius: 8, border: '1px solid #1e3a5f', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', background: '#0e1f3d', borderBottom: '1px solid #1e3a5f' }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd', letterSpacing: 0.5 }}>
                              🚛 LIVE TRACKING — {ld?.active_count ?? '…'} active vehicle{ld?.active_count !== 1 ? 's' : ''}
                            </span>
                            {ld?.ts && (
                              <span style={{ fontSize: 9, color: '#475569' }}>
                                ⏱ {ld.ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            )}
                          </div>

                          {ld?.loading && (
                            <div style={{ padding: '14px 12px', textAlign: 'center', color: '#475569', fontSize: 11 }}>⏳ Fetching live status...</div>
                          )}
                          {!ld?.loading && vehs.length === 0 && (
                            <div style={{ padding: '14px 12px', textAlign: 'center', color: '#475569', fontSize: 11 }}>
                              No vehicles currently active on this route.
                            </div>
                          )}
                          {!ld?.loading && vehs.map((v, vi) => {
                            const pc = PHASE_COLOR[v.phase] || PHASE_COLOR.in_transit;
                            return (
                              <div key={v.job_card_number + vi} style={{ borderBottom: vi < vehs.length - 1 ? '1px solid #1e293b' : 'none', padding: '9px 12px' }}>
                                {/* Vehicle header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                                  <span style={{ fontWeight: 800, fontSize: 12, color: '#e2e8f0' }}>{v.vehicle_number || '—'}</span>
                                  {v.driver_name && <span style={{ fontSize: 10, color: '#94a3b8' }}>👤 {v.driver_name}</span>}
                                  <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#475569' }}>{v.job_card_number}</span>
                                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 12, background: pc.bg }}>
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: pc.dot, display: 'inline-block' }} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: pc.text }}>{v.phase_label}</span>
                                  </div>
                                </div>

                                {/* Stop progress bar */}
                                {v.stops?.length > 0 && (
                                  <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
                                    {v.stops.map((s, si) => {
                                      const sc = s.stop_status === 'departed' ? '#22c55e'
                                               : s.stop_status === 'unloading' ? '#f97316'
                                               : s.stop_status === 'arrived'   ? '#f59e0b'
                                               : '#334155';
                                      return (
                                        <React.Fragment key={si}>
                                          <div title={`${s.poi_name} (${s.stop_status})`} style={{
                                            padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                                            background: sc + '22', color: sc, border: `1px solid ${sc}55`,
                                            whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis',
                                          }}>
                                            {s.stop_type === 'origin' ? '📦' : s.stop_type === 'destination' ? '🏁' : '📍'}{' '}{s.poi_name}
                                          </div>
                                          {si < v.stops.length - 1 && <span style={{ color: '#334155', fontSize: 10 }}>→</span>}
                                        </React.Fragment>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* GPS info row */}
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                  {v.gps ? (
                                    <>
                                      <span style={{ fontSize: 10, color: '#22c55e' }}>📡 GPS Live</span>
                                      <span style={{ fontSize: 10, color: '#94a3b8' }}>⚡ {v.gps.speed?.toFixed(0) || 0} km/h</span>
                                      {v.dist_to_dest_km != null && (
                                        <span style={{ fontSize: 10, color: '#fbbf24' }}>📍 {v.dist_to_dest_km} km to {v.to_location || 'dest.'}</span>
                                      )}
                                    </>
                                  ) : (
                                    <span style={{ fontSize: 10, color: '#475569' }}>📡 No GPS data</span>
                                  )}
                                  {v.next_stop && !v.gps && (
                                    <span style={{ fontSize: 10, color: '#64748b' }}>Next: {v.next_stop}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: Leaflet Map ── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {mapSelectMode ? (
            <>
              <MapContainer key="map-poi-select" center={[28.4695, 77.5855]} zoom={8} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                {pois.filter(p => p.latitude && p.longitude).map(poi => {
                  const isFrom = mapFromPoi?.id === poi.id;
                  const isTo   = mapToPoi?.id   === poi.id;
                  const color  = isFrom ? '#22c55e' : isTo ? '#ef4444' : '#60a5fa';
                  const size   = isFrom || isTo ? 18 : 12;
                  const icon = L.divIcon({
                    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5);cursor:pointer"></div>`,
                    className: '',
                    iconSize: [size, size],
                    iconAnchor: [size/2, size/2],
                  });
                  return (
                    <Marker key={poi.id} position={[poi.latitude, poi.longitude]} icon={icon} eventHandlers={{ click: () => handlePoiMapClick(poi) }}>
                      <Popup><strong>{isFrom ? '🟢 FROM: ' : isTo ? '🔴 TO: ' : ''}{poi.poi_name}</strong>{poi.city ? <><br/>{poi.city}</> : null}</Popup>
                    </Marker>
                  );
                })}
                {mapPreviewGeom?.highway && (
                  <>
                    <Polyline positions={mapPreviewGeom.highway.map(c => [c[1], c[0]])} pathOptions={{ color: '#f59e0b', weight: 6, opacity: 0.9 }} />
                    <FitBounds coords={mapPreviewGeom.highway} />
                  </>
                )}
                {mapPreviewGeom?.local && (
                  <Polyline positions={mapPreviewGeom.local.map(c => [c[1], c[0]])} pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8, dashArray: '10 8' }} />
                )}
              </MapContainer>

              {/* Instruction bar */}
              <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(15,23,42,0.93)', color: '#e2e8f0', padding: '10px 18px', borderRadius: 10, zIndex: 1000, fontSize: 13, fontWeight: 700, backdropFilter: 'blur(6px)', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
                {!mapFromPoi ? (
                  <span>🟢 Click <strong>FROM</strong> POI on map</span>
                ) : !mapToPoi ? (
                  <><span>🔴 Click <strong>TO</strong> POI</span><button onClick={resetMapSelect} style={{ background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>↺ Reset</button></>
                ) : (
                  <span>✅ Route ready — confirm in the panel</span>
                )}
                <button onClick={() => { setMapSelectMode(false); resetMapSelect(); }} style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', marginLeft: 4 }}>✕ Cancel</button>
              </div>

              {/* OSRM loading */}
              {mapPreviewLoading && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(0,0,0,0.85)', color: '#fbbf24', padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, zIndex: 1001 }}>🛣️ Calculating road distance...</div>
              )}
            </>
          ) : !selectedRoute ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0f172a', color: '#334155', gap: 16 }}>
              <div style={{ fontSize: 72 }}>🗺️</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#475569' }}>Select a route to view on map</div>
              <div style={{ fontSize: 13, color: '#334155' }}>Click any route card on the left — road path loads automatically</div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', borderRadius: 8, padding: '8px 14px' }}>
                  <div style={{ width: 24, height: 4, background: '#f59e0b', borderRadius: 2 }} />
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Highway route</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', borderRadius: 8, padding: '8px 14px' }}>
                  <div style={{ width: 24, height: 2, borderTop: '3px dashed #3b82f6', borderRadius: 2 }} />
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Local route</span>
                </div>
              </div>
            </div>
          ) : (
            <MapContainer
              center={mapCenter}
              zoom={7}
              style={{ height: '100%', width: '100%' }}
              key={`map-${selectedRoute.id}`}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />

              {/* Highway route — yellow thick */}
              {routeGeom?.highway && (
                <>
                  <Polyline
                    positions={routeGeom.highway.map(c => [c[1], c[0]])}
                    pathOptions={{ color: '#f59e0b', weight: 8, opacity: 0.95 }}
                  />
                  <FitBounds coords={routeGeom.highway} />
                </>
              )}

              {/* Local/alternative route — blue dashed */}
              {routeGeom?.local && (
                <Polyline
                  positions={routeGeom.local.map(c => [c[1], c[0]])}
                  pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.85, dashArray: '10 8' }}
                />
              )}

              {/* From marker */}
              {routeGeom?.fromPoi && (
                <Marker position={[routeGeom.fromPoi.latitude, routeGeom.fromPoi.longitude]}>
                  <Popup>
                    <strong style={{ color: '#16a34a' }}>🟢 FROM</strong><br />
                    {routeGeom.fromPoi.poi_name}
                  </Popup>
                </Marker>
              )}

              {/* To marker */}
              {routeGeom?.toPoi && (
                <Marker position={[routeGeom.toPoi.latitude, routeGeom.toPoi.longitude]}>
                  <Popup>
                    <strong style={{ color: '#dc2626' }}>🔴 TO</strong><br />
                    {routeGeom.toPoi.poi_name}
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          )}
          {/* Loading spinner overlay */}
          {!mapSelectMode && fetchingRoute && (
            <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', color: '#fbbf24', padding: '9px 22px', borderRadius: 10, fontSize: 13, fontWeight: 700, zIndex: 1000, backdropFilter: 'blur(4px)' }}>
              🛣️ Loading road path...
            </div>
          )}

          {/* Map legend (top-right) */}
          {!mapSelectMode && routeGeom && !fetchingRoute && (
            <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(15,23,42,0.92)', borderRadius: 10, padding: '10px 16px', zIndex: 1000, fontSize: 12, color: '#e2e8f0', backdropFilter: 'blur(6px)', border: '1px solid #334155' }}>
              <div style={{ fontWeight: 800, marginBottom: 8, color: '#f8fafc', fontSize: 13 }}>
                🚛 {selectedRoute?.route_no}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <div style={{ width: 22, height: 4, background: '#f59e0b', borderRadius: 2 }} />
                <span>Highway &nbsp;<strong style={{ color: '#fbbf24' }}>{routeGeom.highwayKm} km</strong></span>
              </div>
              {routeGeom.localKm && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <div style={{ width: 22, borderTop: '3px dashed #3b82f6' }} />
                  <span>Local &nbsp;<strong style={{ color: '#93c5fd' }}>{routeGeom.localKm} km</strong></span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, paddingTop: 4, borderTop: '1px solid #334155' }}>
                <span style={{ fontSize: 13 }}>🛣️</span>
                <span>Toll &nbsp;<strong style={{ color: '#fbbf24' }}>
                  {parseFloat(selectedRoute?.toll_charges) > 0
                    ? `₹${Math.round(parseFloat(selectedRoute.toll_charges)).toLocaleString('en-IN')}`
                    : '—'}
                </strong></span>
              </div>
              {parseFloat(selectedRoute?.total_estimated_expense) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                  <span style={{ fontSize: 13 }}>💰</span>
                  <span>Transport &nbsp;<strong style={{ color: '#4ade80' }}>₹{Math.round(parseFloat(selectedRoute.total_estimated_expense)).toLocaleString('en-IN')}</strong></span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <span style={{ color: '#4ade80', fontSize: 14 }}>●</span><span>From</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ color: '#f87171', fontSize: 14 }}>●</span><span>To</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MAP-SELECT CONFIRM FORM ── */}
      {mapSelectMode && showMapConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 6000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#1e293b', borderRadius: 16, width: 440, padding: 24, border: '1px solid #334155', boxShadow: '0 25px 60px rgba(0,0,0,0.9)' }}>
            <h3 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16, fontWeight: 800 }}>✅ Confirm New Route</h3>
            <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#4ade80', marginBottom: 4 }}>▲ FROM: <strong>{mapFromPoi?.poi_name}</strong></div>
              <div style={{ fontSize: 12, color: '#f87171' }}>▼ TO: <strong>{mapToPoi?.poi_name}</strong></div>
              {mapPreviewGeom && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#fbbf24', fontWeight: 700 }}>
                  🛣️ {mapPreviewGeom.highwayKm} km (road){mapPreviewGeom.localKm ? <span style={{ color: '#93c5fd', marginLeft: 10 }}>🛤️ {mapPreviewGeom.localKm} km (local)</span> : null}
                </div>
              )}
            </div>
            <form onSubmit={handleMapConfirmSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>ROUTE NO *</label>
                  <input required value={form.route_no} onChange={e => setForm(f => ({ ...f, route_no: e.target.value }))} placeholder="e.g. RT008" style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>₹ / KM</label>
                  <input type="number" value={form.expense_per_km} onChange={e => setForm(f => ({ ...f, expense_per_km: e.target.value, total_estimated_expense: calcExpense(f.route_km, e.target.value) }))} placeholder="18" style={inp} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>ROUTE NAME *</label>
                <input required value={form.route_name} onChange={e => setForm(f => ({ ...f, route_name: e.target.value }))} style={inp} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>ROUTE KM</label>
                  <input type="number" step="0.1" value={form.route_km} onChange={e => setForm(f => ({ ...f, route_km: e.target.value, total_estimated_expense: calcExpense(e.target.value, f.expense_per_km) }))} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#fbbf24', display: 'block', marginBottom: 4 }}>🛣️ TOLL CHARGES (₹) — separate</label>
                  <input type="number" step="1" value={form.toll_charges} onChange={e => setForm(f => ({ ...f, toll_charges: e.target.value }))} placeholder="auto-calculated" style={{ ...inp, borderColor: '#78350f', color: '#fbbf24' }} />
                </div>
              </div>
              <div style={{ marginBottom: 14, background: '#0f172a', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>TRANSPORT EXPENSE <span style={{ color: '#475569' }}>(excl. toll)</span></span>
                <span style={{ fontWeight: 800, color: '#4ade80', fontSize: 14 }}>{form.total_estimated_expense ? `₹${parseFloat(form.total_estimated_expense).toFixed(0)}` : '—'}</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => { setShowMapConfirm(false); setMapToPoi(null); setMapPreviewGeom(null); }} style={{ flex: 1, padding: '10px 0', background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>← Re-select</button>
                <button type="submit" disabled={saving} style={{ flex: 2, padding: '10px 0', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? '⏳ Saving...' : '✅ Create Route'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT FORM MODAL ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#1e293b', borderRadius: 16, width: '100%', maxWidth: 660, maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.9)', border: '1px solid #334155', display: 'flex', flexDirection: 'column' }}>

            {/* Modal header */}
            <div style={{ background: '#3b82f6', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff' }}>
                {editingRoute ? '✏️ Edit Route' : '➕ New Standard Route'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {/* Form body */}
            <form onSubmit={handleFormSubmit} style={{ padding: 22, overflowY: 'auto', flex: 1 }}>

              {/* Row 1: Route No + Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 5 }}>ROUTE NO *</label>
                  <input
                    required
                    value={form.route_no}
                    onChange={e => setForm(f => ({ ...f, route_no: e.target.value }))}
                    disabled={!!editingRoute}
                    placeholder="e.g. RT001"
                    style={{ ...inp, background: editingRoute ? '#334155' : '#0f172a', color: editingRoute ? '#94a3b8' : '#e2e8f0' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 5 }}>ROUTE NAME *</label>
                  <input
                    required
                    value={form.route_name}
                    onChange={e => setForm(f => ({ ...f, route_name: e.target.value }))}
                    placeholder="e.g. Delhi → Gurgaon Express"
                    style={inp}
                  />
                </div>
              </div>

              {/* Row 2: From City + From POI */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                  FROM LOCATION
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 5 }}>CITY</label>
                    <select
                      value={fromCity}
                      onChange={e => { setFromCity(e.target.value); setForm(f => ({ ...f, from_location: '' })); }}
                      style={sel}
                    >
                      <option value="">-- Select City --</option>
                      {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 5 }}>POI POINT *</label>
                    <select
                      required
                      value={form.from_location}
                      onChange={e => setForm(f => ({ ...f, from_location: e.target.value }))}
                      disabled={!fromCity}
                      style={sel}
                    >
                      <option value="">-- Select POI --</option>
                      {getPoisForCity(fromCity).map(p => <option key={p.id} value={p.poi_name}>{p.poi_name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 3: To City + To POI */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                  TO LOCATION
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 5 }}>CITY</label>
                    <select
                      value={toCity}
                      onChange={e => { setToCity(e.target.value); setForm(f => ({ ...f, to_location: '' })); }}
                      style={sel}
                    >
                      <option value="">-- Select City --</option>
                      {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 5 }}>POI POINT *</label>
                    <select
                      required
                      value={form.to_location}
                      onChange={e => setForm(f => ({ ...f, to_location: e.target.value }))}
                      disabled={!toCity}
                      style={sel}
                    >
                      <option value="">-- Select POI --</option>
                      {getPoisForCity(toCity).map(p => <option key={p.id} value={p.poi_name}>{p.poi_name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Row 4: KM, ₹/km, toll, total */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 22 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 5 }}>ROUTE KM</label>
                  <input
                    type="number" step="0.1"
                    value={form.route_km}
                    onChange={e => setForm(f => ({ ...f, route_km: e.target.value, total_estimated_expense: calcExpense(e.target.value, f.expense_per_km) }))}
                    placeholder="125"
                    style={inp}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 5 }}>₹ / KM</label>
                  <input
                    type="number" step="0.01"
                    value={form.expense_per_km}
                    onChange={e => setForm(f => ({ ...f, expense_per_km: e.target.value, total_estimated_expense: calcExpense(f.route_km, e.target.value) }))}
                    placeholder="18"
                    style={inp}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#fbbf24', marginBottom: 5 }}>🛣️ TOLL (₹)</label>
                  <input
                    type="number" step="1"
                    value={form.toll_charges}
                    onChange={e => setForm(f => ({ ...f, toll_charges: e.target.value }))}
                    placeholder="auto"
                    style={{ ...inp, borderColor: '#78350f', color: '#fbbf24' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4ade80', marginBottom: 5 }}>TRANSPORT EXP.</label>
                  <input
                    readOnly
                    value={form.total_estimated_expense ? `₹${parseFloat(form.total_estimated_expense).toFixed(0)}` : '-'}
                    style={{ ...inp, background: '#334155', color: '#4ade80', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{ padding: '10px 24px', background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '10px 24px', background: saving ? '#1d4ed8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? '⏳ Saving...' : editingRoute ? '💾 Save Changes' : '➕ Create Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── BULK VEHICLE-POI LINK MODAL ── */}
      {bulkModal && (() => {
        const { route, poiType } = bulkModal;
        const poiName   = poiType === 'from' ? route.from_location : route.to_location;
        const poi       = pois.find(p => p.poi_name === poiName);
        const q         = bulkSearch.toLowerCase();
        const displayed = bulkVehicles.filter(v =>
          !bulkSearch || (v.vehicle_no || '').toLowerCase().includes(q) || (v.driver_name || '').toLowerCase().includes(q)
        );
        const allShownChecked = displayed.length > 0 && displayed.every(v => bulkChecked.has(v.id));
        const changedCount    = bulkVehicles.filter(v => bulkOriginal.has(v.id) !== bulkChecked.has(v.id)).length;

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 7000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#1e293b', borderRadius: 16, width: 480, maxHeight: '88vh', display: 'flex', flexDirection: 'column', border: '1px solid #334155', boxShadow: '0 25px 60px rgba(0,0,0,0.9)' }}>

              {/* Header */}
              <div style={{ background: '#065f46', padding: '14px 20px', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>🔗 Link Vehicles to POI</div>
                  <div style={{ fontSize: 11, color: '#6ee7b7', marginTop: 2 }}>{route.route_no} · {route.route_name}</div>
                </div>
                <button onClick={() => setBulkModal(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
              </div>

              {/* POI type tabs */}
              <div style={{ display: 'flex', padding: '10px 16px', gap: 8, background: '#0f172a', flexShrink: 0 }}>
                <button
                  onClick={() => switchBulkPoiType(route, 'from')}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: poiType === 'from' ? '2px solid #22c55e' : '1px solid #334155', background: poiType === 'from' ? '#14532d' : '#1e293b', color: poiType === 'from' ? '#86efac' : '#94a3b8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  ▲ FROM: {route.from_location?.split(',')[0] || '—'}
                </button>
                <button
                  onClick={() => switchBulkPoiType(route, 'to')}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: poiType === 'to' ? '2px solid #ef4444' : '1px solid #334155', background: poiType === 'to' ? '#7f1d1d' : '#1e293b', color: poiType === 'to' ? '#fca5a5' : '#94a3b8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  ▼ TO: {route.to_location?.split(',')[0] || '—'}
                </button>
              </div>

              {/* POI info strip */}
              <div style={{ padding: '6px 16px', background: '#0f172a', flexShrink: 0, borderBottom: '1px solid #1e293b' }}>
                {poi ? (
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    📍 <strong style={{ color: '#e2e8f0' }}>{poi.poi_name}</strong>
                    {poi.city && <span style={{ color: '#64748b' }}> · {poi.city}</span>}
                    <span style={{ background: '#1e293b', color: '#4ade80', borderRadius: 4, padding: '1px 7px', fontSize: 10, fontWeight: 700, marginLeft: 8 }}>POI ID #{poi.id}</span>
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: '#ef4444' }}>⚠ POI "{poiName}" not found in database</span>
                )}
              </div>

              {/* Search + select all */}
              <div style={{ padding: '10px 16px 6px', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  placeholder="🔍 Search vehicle / driver..."
                  value={bulkSearch}
                  onChange={e => setBulkSearch(e.target.value)}
                  style={{ flex: 1, padding: '7px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: 7, color: '#e2e8f0', fontSize: 12, outline: 'none' }}
                />
                <button
                  onClick={() => {
                    const newSet = new Set(bulkChecked);
                    displayed.forEach(v => allShownChecked ? newSet.delete(v.id) : newSet.add(v.id));
                    setBulkChecked(newSet);
                  }}
                  style={{ padding: '6px 12px', background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {allShownChecked ? '☐ None' : '☑ All'}
                </button>
              </div>
              <div style={{ padding: '0 16px 6px', fontSize: 10, color: '#475569', flexShrink: 0 }}>
                {bulkChecked.size} selected · {changedCount} change{changedCount !== 1 ? 's' : ''} pending
              </div>

              {/* Vehicle list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 10px' }}>
                {bulkLoading ? (
                  <div style={{ textAlign: 'center', color: '#475569', padding: '30px 0', fontSize: 13 }}>⏳ Loading vehicles...</div>
                ) : displayed.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#475569', padding: '30px 0', fontSize: 13 }}>No vehicles found.</div>
                ) : (
                  displayed.map(v => {
                    const isChecked  = bulkChecked.has(v.id);
                    const wasChecked = bulkOriginal.has(v.id);
                    const changed    = isChecked !== wasChecked;
                    return (
                      <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, marginBottom: 4, cursor: 'pointer', background: isChecked ? '#14532d' : '#0f172a', border: `1px solid ${changed ? '#f59e0b' : (isChecked ? '#22c55e' : '#1e293b')}`, transition: 'all 0.1s' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const s = new Set(bulkChecked);
                            isChecked ? s.delete(v.id) : s.add(v.id);
                            setBulkChecked(s);
                          }}
                          style={{ width: 15, height: 15, accentColor: '#22c55e', cursor: 'pointer', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: isChecked ? '#86efac' : '#e2e8f0' }}>{v.vehicle_no}</div>
                          {v.driver_name && <div style={{ fontSize: 11, color: '#64748b' }}>👤 {v.driver_name}</div>}
                        </div>
                        {changed && <span style={{ fontSize: 9, background: '#78350f', color: '#fde68a', borderRadius: 4, padding: '2px 6px', fontWeight: 700, flexShrink: 0 }}>{isChecked ? '+LINK' : '−UNLINK'}</span>}
                        {!changed && isChecked && <span style={{ fontSize: 9, color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>✓</span>}
                      </label>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b', display: 'flex', gap: 10, flexShrink: 0 }}>
                <button onClick={() => setBulkModal(null)} style={{ flex: 1, padding: '10px 0', background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button
                  onClick={saveBulkLink}
                  disabled={bulkSaving || !poi || changedCount === 0}
                  style={{ flex: 2, padding: '10px 0', background: changedCount > 0 && poi ? '#16a34a' : '#334155', color: changedCount > 0 && poi ? '#fff' : '#64748b', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 13, cursor: changedCount > 0 && poi ? 'pointer' : 'not-allowed', opacity: bulkSaving ? 0.7 : 1 }}
                >
                  {bulkSaving ? '⏳ Saving...' : changedCount > 0 ? `💾 Save ${changedCount} Change${changedCount !== 1 ? 's' : ''}` : 'No Changes'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
