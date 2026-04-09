/**
 * DevAdmin — Developer-only vehicle bulk import/management page.
 * Access via: click the app title 5 times, or navigate to ?dev=1
 * NOT shown in sidebar. NOT visible to clients.
 */
import React, { useState, useEffect } from 'react';
import CentralControlCenter from './CentralControlCenter.jsx';
import AnalyticsDashboard from './AnalyticsDashboard.jsx';
import VehicleManagementDashboard from './VehicleManagementDashboard.jsx';
import DriverManagementDashboard from './DriverManagementDashboard.jsx';
import TripManagementDashboard from './TripManagementDashboard.jsx';
import BillingDashboard from './BillingDashboard.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://kd-logistics-production.up.railway.app';
const API = API_BASE + '/api';

const SIZE_DISPLAY = {
  category_1_32ft_34ft: '32/34 Ft',
  category_2_22ft_24ft: '22/24 Ft',
  category_3_small: '≤20 Ft / Bolero',
};

const PASTE_COLUMNS = ['sl', 'vehicle_no', 'vehicle_size', 'fuel_type', 'driver_name', 'salary'];

function parsePastedData(text) {
  return text.trim().split('\n').map(line => {
    const cols = line.split('\t').map(c => c.trim());
    return {
      sl: cols[0] || '',
      vehicle_no: (cols[1] || '').toUpperCase(),
      vehicle_size: cols[2] || '',
      fuel_type: (cols[3] || 'CNG').toUpperCase(),
      driver_name: cols[4] || '',
      salary: cols[5] || '',
    };
  }).filter(r => r.vehicle_no);
}

export default function DevAdmin() {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [parsed, setParsed] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dbVehicles, setDbVehicles] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [tab, setTab] = useState('import'); // 'import' | 'review' | 'munshis' | 'drivers' | 'pois' | 'assign' | 'central-control'

  // Assign-munshi tab state
  const [assignVehicles, setAssignVehicles] = useState([]);
  const [assignMunshis, setAssignMunshis] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMsg, setAssignMsg] = useState({});  // { vehicleId: '✅ Saved' }
  const [assignSelected, setAssignSelected] = useState({});  // { vehicleId: munshiId }
  const [editRow, setEditRow] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');

  // Munshis state
  const [munshis, setMunshis] = useState([]);
  const [munshiLoading, setMunshiLoading] = useState(false);
  const [editMunshi, setEditMunshi] = useState(null);
  const [munshiMsg, setMunshiMsg] = useState('');
  const [addMunshi, setAddMunshi] = useState(null);

  // Drivers state
  const [drivers, setDrivers] = useState([]);
  const [driverLoading, setDriverLoading] = useState(false);
  const [editDriver, setEditDriver] = useState(null);
  const [driverMsg, setDriverMsg] = useState('');
  const [addDriver, setAddDriver] = useState(null);

  // POIs state
  const [pois, setPois] = useState([]);
  const [poiLoading, setPoiLoading] = useState(false);
  const [editPoi, setEditPoi] = useState(null);
  const [poiMsg, setPoiMsg] = useState('');
  const [poiSearch, setPoiSearch] = useState('');

  // Delivered EWBs state
  const [deliveredBills, setDeliveredBills] = useState([]);
  const [deliveredLoading, setDeliveredLoading] = useState(false);
  const [deliveredTotal, setDeliveredTotal] = useState(0);
  const [bulkDeliverMsg, setBulkDeliverMsg] = useState('');
  const [bulkDelivering, setBulkDelivering] = useState(false);

  // EWB Munshi assign tab state
  const [ewbPois, setEwbPois] = useState([]);       // [{ poi_id, poi_name, bill_count, munshi_id, munshi_name }]
  const [ewbMunshis, setEwbMunshis] = useState([]); // munshi list from server
  const [ewbPoiSel, setEwbPoiSel] = useState({});   // { poi_id: munshi_id } draft selections
  const [ewbPoiLoading, setEwbPoiLoading] = useState(false);
  const [ewbSaveMsg, setEwbSaveMsg] = useState({});  // { poi_id: '✅' }
  const [ewbReassignMsg, setEwbReassignMsg] = useState('');
  const [ewbReassigning, setEwbReassigning] = useState(false);
  const [ewbAutoPoiMsg, setEwbAutoPoiMsg] = useState('');
  const [ewbAutoPoiLoading, setEwbAutoPoiLoading] = useState(false);

  // Truck frequency tab state
  const [vehFreq, setVehFreq] = useState([]);           // [{ poi_id, poi_name, poi_type, city, vehicles: [...] }]
  const [vehFreqLoading, setVehFreqLoading] = useState(false);
  const [vehFreqPoiType, setVehFreqPoiType] = useState('hub');  // hub | secondary | tertiary | all
  const [vehFreqMode, setVehFreqMode] = useState('gps');         // 'gps' | 'ewb'
  const [vehFreqDays, setVehFreqDays] = useState(90);
  const [vehFreqMeta, setVehFreqMeta] = useState({});            // { days_scanned, poi_count }
  const [vehFreqSel, setVehFreqSel]   = useState({});            // { poi_id: Set<vehicle_no> }
  const [vehFreqAssignMsg, setVehFreqAssignMsg] = useState({});  // { poi_id: string }
  const [autoAssignLoading, setAutoAssignLoading] = useState(false);
  const [autoAssignResult, setAutoAssignResult]   = useState(null);
  const [autoAssignShowAll, setAutoAssignShowAll] = useState(false);

  // Delivery by POI tab state
  const [delivPois, setDelivPois]               = useState([]);
  const [delivLoading, setDelivLoading]         = useState(false);
  const [delivStatus, setDelivStatus]           = useState('all');   // all | pending | delivered
  const [delivPoiType, setDelivPoiType]         = useState('all');
  const [delivExpanded, setDelivExpanded]       = useState({});       // poi_id → bool
  const [delivConfirmMsg, setDelivConfirmMsg]   = useState('');

  // Expense tab
  const [expRows, setExpRows]         = useState([]);
  const [expTotals, setExpTotals]     = useState({});
  const [expLines, setExpLines]       = useState([]);
  const [expLoading, setExpLoading]   = useState(false);
  const [expGroupBy, setExpGroupBy]   = useState('vehicle');   // vehicle | munshi | date
  const [expDateFrom, setExpDateFrom] = useState('');
  const [expDateTo, setExpDateTo]     = useState('');
  const [expExpanded, setExpExpanded] = useState({});
  const [kmLoading, setKmLoading]       = useState(false);
  const [kmResult, setKmResult]         = useState(null);
  const [routeRows, setRouteRows]       = useState([]);
  const [routeTotals, setRouteTotals]   = useState({});
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeExpanded, setRouteExpanded] = useState({});
  const [ledgerMsg, setLedgerMsg]       = useState('');
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Load client list on mount
  useEffect(() => {
    fetch(`${API}/dev/clients`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d) && d.length > 0) {
          setClients(d);
          // Prefer CLIENT_001 (primary tenant) as default
          const primary = d.find(c => c.client_id === 'CLIENT_001') || d[0];
          setClientId(primary.client_id);
        } else {
          setClientId('CLIENT_001');
        }
      })
      .catch(() => { setClientId('CLIENT_001'); });
  }, []);

  // Reload DB vehicles when client changes
  useEffect(() => { if (clientId) loadDB(); }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load tab-specific data when tab or client changes
  useEffect(() => {
    if (!clientId) return;
    if (tab === 'munshis') loadMunshis();
    if (tab === 'drivers') loadDrivers();
    if (tab === 'pois') loadPOIs();
    if (tab === 'assign') loadAssignData();
    if (tab === 'delivered') loadDelivered();
    if (tab === 'ewb-munshi') loadEwbPoiSummary();
    if (tab === 'truck-freq') loadVehFreq();
    if (tab === 'deliveries') loadDelivPois();
    if (tab === 'expense')    loadExpenseSummary();
  }, [tab, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadAssignData() {
    setAssignLoading(true);
    Promise.all([
      fetch(`${API}/vehicles-master?clientId=${encodeURIComponent(clientId)}`).then(r => r.json()),
      fetch(`${API}/munshis?clientId=${encodeURIComponent(clientId)}`).then(r => r.json()),
    ]).then(([vData, mData]) => {
      const vList = Array.isArray(vData) ? vData : [];
      const mList = Array.isArray(mData) ? mData : (mData.munshis || []);
      setAssignVehicles(vList);
      setAssignMunshis(mList);
      // Pre-populate dropdown selections from existing assignments
      const sel = {};
      vList.forEach(v => { if (v.munshi_id) sel[v.id] = String(v.munshi_id); });
      setAssignSelected(sel);
      setAssignLoading(false);
    }).catch(() => setAssignLoading(false));
  }

  async function assignMunshi(vehicleId) {
    const munshiId = assignSelected[vehicleId];
    const munshi = assignMunshis.find(m => String(m.id) === String(munshiId));
    setAssignMsg(p => ({ ...p, [vehicleId]: '⏳' }));
    try {
      const res = await fetch(`${API}/vehicles-master/${vehicleId}/munshi`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ munshi_id: munshiId || null, munshi_name: munshi?.name || '' }),
      });
      const d = await res.json();
      setAssignMsg(p => ({ ...p, [vehicleId]: d.success ? '✅' : '❌' }));
    } catch { setAssignMsg(p => ({ ...p, [vehicleId]: '❌' })); }
  }

  function loadDB() {
    setDbLoading(true);
    fetch(`${API}/vehicles-master?clientId=${encodeURIComponent(clientId)}`)
      .then(r => r.json())
      .then(d => { setDbVehicles(Array.isArray(d) ? d : []); setDbLoading(false); })
      .catch(() => setDbLoading(false));
  }

  function loadMunshis() {
    setMunshiLoading(true);
    fetch(`${API}/munshis?clientId=${encodeURIComponent(clientId)}`)
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : (d.munshis || []);
        setMunshis(list);
        setMunshiLoading(false);
      })
      .catch(() => setMunshiLoading(false));
  }

  function loadDrivers() {
    setDriverLoading(true);
    fetch(`${API}/drivers`)
      .then(r => r.json())
      .then(d => { setDrivers(Array.isArray(d) ? d : []); setDriverLoading(false); })
      .catch(() => setDriverLoading(false));
  }

  function loadDelivered() {
    setDeliveredLoading(true);
    fetch(`${API}/eway-bills-hub?status=delivered&per_page=200&client_id=${encodeURIComponent(clientId)}`)
      .then(r => r.json())
      .then(d => {
        setDeliveredBills(Array.isArray(d.bills) ? d.bills : []);
        setDeliveredTotal(d.total || 0);
        setDeliveredLoading(false);
      })
      .catch(() => setDeliveredLoading(false));
  }

  function loadEwbPoiSummary() {
    setEwbPoiLoading(true);
    fetch(`${API}/eway-bills-hub/from-poi-summary?client_id=${encodeURIComponent(clientId)}`)
      .then(r => r.json())
      .then(d => {
        const pois = d.pois || [];
        setEwbPois(pois);
        setEwbMunshis(d.munshis || []);
        // Pre-populate draft selections from current assignments
        const sel = {};
        pois.forEach(p => { if (p.munshi_id) sel[p.poi_id] = String(p.munshi_id); });
        setEwbPoiSel(sel);
        setEwbPoiLoading(false);
      })
      .catch(() => setEwbPoiLoading(false));
  }

  async function bulkConfirmDelivered(dateStr) {
    setDelivConfirmMsg('⏳ Saving…');
    try {
      const res = await fetch(`${API}/eway-bills-hub/bulk-confirm-delivered`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, delivered_on: dateStr }),
      });
      const d = await res.json();
      setDelivConfirmMsg(d.success ? `✅ ${d.updated} bills marked delivered on ${dateStr}` : `❌ ${d.error}`);
      if (d.success) loadDelivPois();
    } catch { setDelivConfirmMsg('❌ Network error'); }
    setTimeout(() => setDelivConfirmMsg(''), 4000);
  }

  function loadExpenseSummary(groupBy, dateFrom, dateTo) {
    const gb  = groupBy  !== undefined ? groupBy  : expGroupBy;
    const df  = dateFrom !== undefined ? dateFrom : expDateFrom;
    const dt  = dateTo   !== undefined ? dateTo   : expDateTo;
    setExpLoading(true);
    let url = `${API}/eway-bills-hub/expense-summary?client_id=${encodeURIComponent(clientId)}&group_by=${gb}`;
    if (df) url += `&date_from=${df}`;
    if (dt) url += `&date_to=${dt}`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setExpRows(d.rows || []);
        setExpTotals(d.totals || {});
        setExpLines(d.expense_lines || []);
        setExpLoading(false);
      })
      .catch(() => setExpLoading(false));
  }

  function loadRouteKm(dateFrom, dateTo) {
    const df = dateFrom !== undefined ? dateFrom : expDateFrom;
    const dt = dateTo   !== undefined ? dateTo   : expDateTo;
    setRouteLoading(true);
    let url = `${API}/eway-bills-hub/route-km-summary?client_id=${encodeURIComponent(clientId)}`;
    if (df) url += `&date_from=${df}`;
    if (dt) url += `&date_to=${dt}`;
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setRouteRows(d.routes || []);
        setRouteTotals(d.totals || {});
        setRouteLoading(false);
      })
      .catch(() => setRouteLoading(false));
  }

  async function buildLedger(overwrite = false) {
    setLedgerLoading(true); setLedgerMsg('');
    try {
      const r = await fetch(`${API}/eway-bills-hub/build-ledger`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, target: 'both', overwrite }),
      });
      const d = await r.json();
      setLedgerMsg(d.message || (d.error ? `❌ ${d.error}` : '✅ Done'));
    } catch(e) { setLedgerMsg(`❌ ${e.message}`); }
    setLedgerLoading(false);
    setTimeout(() => setLedgerMsg(''), 6000);
  }

  function loadDelivPois(status, poiType) {
    const st = status  || delivStatus;
    const pt = poiType || delivPoiType;
    setDelivLoading(true);
    fetch(`${API}/eway-bills-hub/delivery-by-poi?client_id=${encodeURIComponent(clientId)}&status=${st}&poi_type=${pt}`)
      .then(r => r.json())
      .then(d => { setDelivPois(d.pois || []); setDelivLoading(false); })
      .catch(() => setDelivLoading(false));
  }

  function loadVehFreq(poiType, mode, days) {
    const pt  = poiType || vehFreqPoiType;
    const md  = mode    || vehFreqMode;
    const dy  = days    || vehFreqDays;
    setVehFreqLoading(true);
    setVehFreqSel({});
    const endpoint = md === 'gps'
      ? `${API}/eway-bills-hub/geo-truck-frequency?client_id=${encodeURIComponent(clientId)}&poi_type=${encodeURIComponent(pt)}&days=${dy}`
      : `${API}/eway-bills-hub/vehicle-poi-frequency?client_id=${encodeURIComponent(clientId)}&poi_type=${encodeURIComponent(pt)}`;
    fetch(endpoint)
      .then(r => r.json())
      .then(d => {
        setVehFreq(d.hubs || []);
        setVehFreqMeta({ days_scanned: d.days_scanned, poi_count: d.poi_count });
        setVehFreqLoading(false);
      })
      .catch(() => setVehFreqLoading(false));
  }

  function toggleVehSel(poiId, vehicleNo) {
    setVehFreqSel(prev => {
      const cur = new Set(prev[poiId] || []);
      if (cur.has(vehicleNo)) cur.delete(vehicleNo); else cur.add(vehicleNo);
      return { ...prev, [poiId]: cur };
    });
  }

  async function assignSelectedVehicles(hub) {
    const sel = Array.from(vehFreqSel[hub.poi_id] || []);
    if (!sel.length) return;
    setVehFreqAssignMsg(p => ({ ...p, [hub.poi_id]: '⏳ Saving…' }));
    try {
      const res = await fetch(`${API}/eway-bills-hub/assign-vehicles-to-poi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, poi_id: hub.poi_id, vehicle_nos: sel }),
      });
      const d = await res.json();
      if (d.success) {
        setVehFreqAssignMsg(p => ({ ...p, [hub.poi_id]: `✅ Assigned ${sel.length} truck${sel.length > 1 ? 's' : ''}` }));
        setVehFreqSel(p => ({ ...p, [hub.poi_id]: new Set() }));
      } else {
        setVehFreqAssignMsg(p => ({ ...p, [hub.poi_id]: `❌ ${d.error}` }));
      }
    } catch (e) {
      setVehFreqAssignMsg(p => ({ ...p, [hub.poi_id]: `❌ ${e.message}` }));
    }
  }

  async function savePoiMunshi(poi) {
    const munshiId = ewbPoiSel[poi.poi_id];
    // Find the munshi object
    const munshi = ewbMunshis.find(m => String(m.id) === String(munshiId));
    // Get current primary_poi_ids for ALL munshis; remove poi from old owner, add to new
    setEwbSaveMsg(p => ({ ...p, [poi.poi_id]: '⏳' }));
    try {
      // Remove from previous owner if different
      for (const m of ewbMunshis) {
        let pids;
        try {
          pids = JSON.parse(m.primary_poi_ids || '[]');
          if (typeof pids === 'string') pids = JSON.parse(pids); // handle double-encoded
          if (!Array.isArray(pids)) pids = pids != null ? [pids] : [];
        } catch { pids = []; }
        const hadPoi = pids.includes(poi.poi_id);
        const isNewOwner = munshi && String(m.id) === String(munshi.id);
        let newPids = pids.filter(id => id !== poi.poi_id);
        if (isNewOwner) newPids = [...newPids, poi.poi_id];
        if (hadPoi || isNewOwner) {
          await fetch(`${API}/munshis/${m.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...m, primary_poi_ids: newPids }),
          });
        }
      }
      setEwbSaveMsg(p => ({ ...p, [poi.poi_id]: '✅' }));
      setTimeout(() => setEwbSaveMsg(p => { const n = { ...p }; delete n[poi.poi_id]; return n; }), 2000);
      loadEwbPoiSummary();
    } catch (e) {
      setEwbSaveMsg(p => ({ ...p, [poi.poi_id]: '❌ ' + e.message }));
    }
  }

  async function reassignAllMunshis(overwrite) {
    setEwbReassigning(true); setEwbReassignMsg('');
    try {
      const res = await fetch(`${API}/eway-bills-hub/reassign-munshis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, overwrite }),
      });
      const d = await res.json();
      if (d.success) {
        setEwbReassignMsg(`✅ Assigned munshi to ${d.updated} of ${d.total_bills} bills (${d.mappings} POI mappings used)`);
      } else {
        setEwbReassignMsg('❌ ' + (d.error || 'Unknown error'));
      }
    } catch (e) { setEwbReassignMsg('❌ ' + e.message); }
    setEwbReassigning(false);
  }

  async function autoCreatePois(dryRun) {
    setEwbAutoPoiLoading(true); setEwbAutoPoiMsg('');
    try {
      const res = await fetch(`${API}/eway-bills-hub/auto-create-pois`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, dry_run: dryRun }),
      });
      const d = await res.json();
      if (d.success) {
        if (dryRun) {
          setEwbAutoPoiMsg(`🔍 Dry run: would create ${d.pois_created} new distributor POIs:\n${(d.new_pois || []).map(p => `• ${p.name} (${p.side})`).join('\n')}`);
        } else {
          setEwbAutoPoiMsg(`✅ Created ${d.pois_created} new distributor POIs, re-enriched ${d.bills_enriched} bills`);
          loadEwbPoiSummary();
        }
      } else {
        setEwbAutoPoiMsg('❌ ' + (d.error || 'Unknown error'));
      }
    } catch (e) { setEwbAutoPoiMsg('❌ ' + e.message); }
    setEwbAutoPoiLoading(false);
  }

  async function bulkDeliverHistorical() {
    const today = new Date().toISOString().slice(0, 10);
    if (!window.confirm(`Mark ALL bills with doc_date before ${today} as Delivered?\n\nThis will update their status and set delivered_at = their own doc date.\n\nCannot be undone easily.`)) return;
    setBulkDelivering(true);
    setBulkDeliverMsg('');
    try {
      const res = await fetch(`${API}/eway-bills-hub/bulk-deliver-historical`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, date_before: today }),
      });
      const d = await res.json();
      if (d.success) {
        setBulkDeliverMsg(`✅ Marked ${d.updated} bills as delivered (doc_date before ${today})`);
        loadDelivered();
      } else {
        setBulkDeliverMsg('❌ ' + (d.error || 'Unknown error'));
      }
    } catch (e) {
      setBulkDeliverMsg('❌ ' + e.message);
    }
    setBulkDelivering(false);
  }

  function loadPOIs() {
    setPoiLoading(true);
    fetch(`${API}/pois?clientId=${encodeURIComponent(clientId)}`)
      .then(r => r.json())
      .then(d => { setPois(Array.isArray(d) ? d : []); setPoiLoading(false); })
      .catch(() => setPoiLoading(false));
  }

  async function saveMunshi() {
    if (!editMunshi) return;
    if (!editMunshi.id || editMunshi.id === 'null' || editMunshi.id === 'undefined') {
      setMunshiMsg('\u274c Cannot save: this munshi has no ID in the database. Delete it and re-add.');
      return;
    }
    setMunshiMsg('');
    try {
      const res = await fetch(`${API}/munshis/${editMunshi.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editMunshi),
      });
      const d = await res.json();
      if (d.success) { setMunshiMsg('✅ Saved'); loadMunshis(); setEditMunshi(null); }
      else setMunshiMsg('❌ ' + d.error);
    } catch (e) { setMunshiMsg('❌ ' + e.message); }
  }

  async function deleteMunshi(id) {
    if (!window.confirm('Delete this munshi?')) return;
    try {
      await fetch(`${API}/munshis/${id}`, { method: 'DELETE' });
      loadMunshis();
    } catch (e) { setMunshiMsg('❌ ' + e.message); }
  }

  async function createMunshi() {
    if (!addMunshi?.name || !addMunshi?.area) { setMunshiMsg('❌ Name and Area required'); return; }
    setMunshiMsg('');
    try {
      const res = await fetch(`${API}/munshis`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addMunshi, client_id: clientId }),
      });
      const d = await res.json();
      if (d.id) { setMunshiMsg('✅ Added ' + d.name); loadMunshis(); setAddMunshi(null); }
      else setMunshiMsg('❌ ' + d.error);
    } catch (e) { setMunshiMsg('❌ ' + e.message); }
  }

  async function saveDriver() {
    if (!editDriver) return;
    setDriverMsg('');
    try {
      const res = await fetch(`${API}/drivers/${editDriver.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDriver),
      });
      const d = await res.json();
      if (d.success) { setDriverMsg('✅ Saved'); loadDrivers(); setEditDriver(null); }
      else setDriverMsg('❌ ' + d.error);
    } catch (e) { setDriverMsg('❌ ' + e.message); }
  }

  async function deleteDriver(id) {
    if (!window.confirm('Delete this driver?')) return;
    try {
      await fetch(`${API}/drivers/${id}`, { method: 'DELETE' });
      loadDrivers();
    } catch (e) { setDriverMsg('❌ ' + e.message); }
  }

  async function createDriver() {
    if (!addDriver?.name || !addDriver?.license_number) { setDriverMsg('❌ Name and License required'); return; }
    setDriverMsg('');
    try {
      const res = await fetch(`${API}/drivers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addDriver, client_id: clientId }),
      });
      const d = await res.json();
      if (d.id) { setDriverMsg('✅ Added ' + d.name); loadDrivers(); setAddDriver(null); }
      else setDriverMsg('❌ ' + d.error);
    } catch (e) { setDriverMsg('❌ ' + e.message); }
  }

  async function savePoi() {
    if (!editPoi) return;
    setPoiMsg('');
    try {
      const res = await fetch(`${API}/pois/${editPoi.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPoi),
      });
      const d = await res.json();
      if (d.success || d.id) { setPoiMsg('✅ Saved'); loadPOIs(); setEditPoi(null); }
      else setPoiMsg('❌ ' + (d.error || 'Unknown error'));
    } catch (e) { setPoiMsg('❌ ' + e.message); }
  }

  async function deletePoi(id) {
    if (!window.confirm('Delete this POI?')) return;
    try {
      await fetch(`${API}/pois/${id}`, { method: 'DELETE' });
      loadPOIs();
    } catch (e) { setPoiMsg('❌ ' + e.message); }
  }

  function handleParse() {
    const rows = parsePastedData(pasteText);
    setParsed(rows);
    setResult(null);
  }

  async function handleBulkUpsert() {
    if (!parsed.length) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/dev/vehicles-bulk-upsert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, vehicles: parsed }),
      });
      const d = await res.json();
      setResult(d);
      if (d.success) { loadDB(); setParsed([]); setPasteText(''); }
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit() {
    if (!editRow) return;
    setSaveMsg('');
    try {
      const res = await fetch(`${API}/vehicles-master/${editRow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editRow),
      });
      const d = await res.json();
      if (d.success) { setSaveMsg('✅ Saved'); loadDB(); setEditRow(null); }
      else setSaveMsg('❌ ' + d.error);
    } catch (e) { setSaveMsg('❌ ' + e.message); }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: 24, fontFamily: 'monospace' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, borderBottom: '1px solid #1e293b', paddingBottom: 16 }}>
          <span style={{ fontSize: 28 }}>🛠️</span>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>Developer Admin Panel</h1>
            <span style={{ fontSize: 12, color: '#64748b' }}>Internal tool — not visible to clients</span>
          </div>

          {/* Client Selector */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '8px 14px' }}>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: 1, marginBottom: 5 }}>
                ACTIVE CLIENT
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Existing clients dropdown */}
                {clients.length > 0 && (
                  <select
                    value={clients.some(c => c.client_id === clientId) ? clientId : ''}
                    onChange={e => { if (e.target.value) { setClientId(e.target.value); setParsed([]); setResult(null); setEditRow(null); } }}
                    style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6,
                      padding: '5px 8px', fontSize: 12, cursor: 'pointer', maxWidth: 200 }}
                  >
                    <option value=''>— pick existing —</option>
                    {clients.map(c => (
                      <option key={c.client_id} value={c.client_id}>
                        {c.client_id} ({c.vehicle_count} vehicles)
                      </option>
                    ))}
                  </select>
                )}
                <span style={{ color: '#475569', fontSize: 12 }}>or type:</span>
                {/* Manual input for any client ID */}
                <input
                  value={clientId}
                  onChange={e => { setClientId(e.target.value.toUpperCase()); setParsed([]); setResult(null); setEditRow(null); }}
                  placeholder='CLIENT_001'
                  style={{ width: 120, background: '#0f172a', color: '#38bdf8', border: '2px solid #3b82f6',
                    borderRadius: 6, padding: '5px 8px', fontSize: 13, fontWeight: 800, fontFamily: 'monospace' }}
                />
              </div>
              <div style={{ marginTop: 5, fontSize: 10, color: '#475569' }}>
                {clients.find(c => c.client_id === clientId)
                  ? <span style={{ color: '#4ade80' }}>✓ {clients.find(c => c.client_id === clientId).vehicle_count} vehicles in DB</span>
                  : clientId
                    ? <span style={{ color: '#fbbf24' }}>⚠ New client — not yet in DB</span>
                    : null}
              </div>
            </div>
            <div style={{ background: '#dc2626', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
              🔒 DEV ONLY
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            ['central-control', '🎛️ CENTRAL CONTROL'],
            ['analytics', '📊 ANALYTICS'],
            ['vehicles', '🚗 VEHICLES'],
            ['drivers-mgmt', '👥 DRIVERS'],
            ['trips', '📋 TRIPS'],
            ['billing', '💰 BILLING'],
            ['import', '📥 Bulk Import'],
            ['review', '📋 Vehicles'],
            ['assign', '🔗 Assign Munshi'],
            ['munshis', '🧾 Munshis'],
            ['drivers', '🚗 Drivers'],
            ['pois', '📍 POIs'],
            ['delivered', `📦 Delivered EWBs${deliveredTotal ? ' (' + deliveredTotal + ')' : ''}`],
            ['ewb-munshi', '🧑‍💼 EWB Munshi Assign'],
            ['truck-freq', '🚛 Truck Frequency'],
            ['deliveries', '📦 Delivery Points'],
            ['expense', '💰 Expense'],

          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding: '7px 18px', borderRadius: 7, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                background: tab === key ? '#3b82f6' : '#1e293b', color: tab === key ? '#fff' : '#94a3b8' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── CENTRAL CONTROL TAB ── */}
        {tab === 'central-control' && <CentralControlCenter />}

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && <AnalyticsDashboard />}

        {/* ── VEHICLES TAB ── */}
        {tab === 'vehicles' && <VehicleManagementDashboard />}

        {/* ── DRIVERS TAB ── */}
        {tab === 'drivers-mgmt' && <DriverManagementDashboard />}

        {/* ── TRIPS TAB ── */}
        {tab === 'trips' && <TripManagementDashboard />}

        {/* ── BILLING TAB ── */}
        {tab === 'billing' && <BillingDashboard />}

        {/* ── IMPORT TAB ── */}
        {tab === 'import' && (
          <div>
            <div style={{ background: '#1e293b', borderRadius: 10, padding: 20, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 10px', color: '#93c5fd', fontSize: 14 }}>Step 1 — Paste Excel Data</h3>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>
                Copy directly from Excel. Columns: <code style={{ color: '#fbbf24' }}>Sl | Vehicle No | Vehicle Size | Fuel Type | Driver Name | Salary</code>
              </p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={'1\tHR69C0322\t19 Ft\tDIESEL\tHoshiyar\t18000\n2\tHR69C3792\t22 Ft\tDIESEL\tPradeep\t\n...'}
                style={{ width: '100%', height: 180, background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155',
                  borderRadius: 6, padding: 10, fontSize: 12, fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical' }}
              />
              <button onClick={handleParse} disabled={!pasteText.trim()}
                style={{ marginTop: 10, padding: '8px 20px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                🔍 Parse ({pasteText.trim().split('\n').filter(Boolean).length} lines)
              </button>
            </div>

            {parsed.length > 0 && (
              <div style={{ background: '#1e293b', borderRadius: 10, padding: 20, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ margin: 0, color: '#93c5fd', fontSize: 14 }}>Step 2 — Preview ({parsed.length} rows)</h3>
                  <button onClick={handleBulkUpsert} disabled={loading}
                    style={{ padding: '8px 22px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    {loading ? '⏳ Uploading…' : `🚀 Upload All ${parsed.length} Vehicles`}
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#0f172a' }}>
                        {['#', 'Vehicle No', 'Size', 'Fuel', 'Driver', 'Salary', 'Status'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #334155' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((row, i) => {
                        const inDb = dbVehicles.find(d => d.vehicle_no === row.vehicle_no);
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? '#0f172a' : 'transparent' }}>
                            <td style={{ padding: '6px 10px', color: '#475569' }}>{row.sl || i + 1}</td>
                            <td style={{ padding: '6px 10px', color: '#f1f5f9', fontWeight: 700 }}>{row.vehicle_no}</td>
                            <td style={{ padding: '6px 10px', color: '#a5f3fc' }}>{row.vehicle_size}</td>
                            <td style={{ padding: '6px 10px', color: row.fuel_type === 'DIESEL' ? '#fbbf24' : '#6ee7b7' }}>{row.fuel_type}</td>
                            <td style={{ padding: '6px 10px', color: row.driver_name ? '#e2e8f0' : '#475569' }}>{row.driver_name || '—'}</td>
                            <td style={{ padding: '6px 10px', color: '#a3e635' }}>{row.salary ? `₹${parseInt(row.salary).toLocaleString('en-IN')}` : '—'}</td>
                            <td style={{ padding: '6px 10px' }}>
                              {inDb
                                ? <span style={{ color: '#fbbf24', fontSize: 11 }}>🔄 UPDATE</span>
                                : <span style={{ color: '#4ade80', fontSize: 11 }}>➕ NEW</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result && (
              <div style={{ background: result.success ? '#14532d' : '#7f1d1d', borderRadius: 10, padding: 16, fontSize: 13 }}>
                {result.success
                  ? <><span style={{ color: '#4ade80', fontWeight: 700 }}>✅ Done!</span>
                      &ensp;Inserted: <b style={{ color: '#4ade80' }}>{result.inserted}</b>
                      &ensp;Updated: <b style={{ color: '#fbbf24' }}>{result.updated}</b>
                      &ensp;Skipped: <b style={{ color: '#94a3b8' }}>{result.skipped}</b></>
                  : <span style={{ color: '#fca5a5' }}>❌ Error: {result.error}</span>}
              </div>
            )}
          </div>
        )}

        {/* ── REVIEW TAB ── */}
        {tab === 'review' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: '#93c5fd', fontSize: 14 }}>
                {dbLoading ? '⏳ Loading…' : `${dbVehicles.length} vehicles in DB`}
              </h3>
              <button onClick={loadDB} style={{ padding: '5px 14px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                🔄 Refresh
              </button>
            </div>
            {saveMsg && <div style={{ background: '#1e293b', borderRadius: 6, padding: '8px 14px', marginBottom: 12, color: '#4ade80', fontSize: 13 }}>{saveMsg}</div>}
            {editRow && (
              <div style={{ background: '#1e293b', borderRadius: 10, padding: 18, marginBottom: 16, border: '1px solid #3b82f6' }}>
                <h4 style={{ margin: '0 0 12px', color: '#93c5fd' }}>Edit: {editRow.vehicle_no}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                  {[
                    ['driver_name', 'Driver Name', 'text'],
                    ['fuel_type', 'Fuel Type', 'text'],
                    ['vehicle_size', 'Size Category', 'text'],
                    ['kmpl', 'KMPL', 'number'],
                  ].map(([field, label, type]) => (
                    <div key={field}>
                      <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>{label}</label>
                      <input type={type} value={editRow[field] || ''} onChange={e => setEditRow(r => ({ ...r, [field]: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 5, fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={saveEdit} style={{ padding: '7px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>💾 Save</button>
                  <button onClick={() => setEditRow(null)} style={{ padding: '7px 14px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#0f172a', position: 'sticky', top: 0 }}>
                    {['#', 'Vehicle No', 'Driver', 'Size', 'Fuel', 'KMPL', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #334155', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dbVehicles.map((v, i) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? '#0f172a' : 'transparent' }}>
                      <td style={{ padding: '6px 10px', color: '#475569' }}>{i + 1}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: '#f1f5f9' }}>{v.vehicle_no}</td>
                      <td style={{ padding: '6px 10px', color: v.driver_name ? '#e2e8f0' : '#475569' }}>{v.driver_name || <span style={{ color: '#ef4444' }}>⚠ No driver</span>}</td>
                      <td style={{ padding: '6px 10px', color: '#a5f3fc', fontSize: 11 }}>{SIZE_DISPLAY[v.vehicle_size] || v.vehicle_size || '?'}</td>
                      <td style={{ padding: '6px 10px', color: v.fuel_type === 'DIESEL' ? '#fbbf24' : '#6ee7b7' }}>{v.fuel_type || '?'}</td>
                      <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{v.kmpl || '—'}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <button onClick={() => { setEditRow({ ...v }); setSaveMsg(''); }}
                          style={{ padding: '3px 10px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                          ✏️ Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* ── MUNSHIS TAB ── */}
        {tab === 'munshis' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: '#93c5fd', fontSize: 14 }}>
                {munshiLoading ? '⏳ Loading…' : `${munshis.length} Munshis in DB`}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setAddMunshi({ name: '', area: '', region: '', phone: '', email: '', approval_limit: 0 }); setMunshiMsg(''); }}
                  style={{ padding: '5px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                  ➕ Add New
                </button>
                <button onClick={loadMunshis} style={{ padding: '5px 14px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                  🔄 Refresh
                </button>
              </div>
            </div>
            {munshiMsg && <div style={{ background: '#1e293b', borderRadius: 6, padding: '8px 14px', marginBottom: 12, color: munshiMsg.startsWith('✅') ? '#4ade80' : '#f87171', fontSize: 13 }}>{munshiMsg}</div>}

            {/* Add Munshi Form */}
            {addMunshi && (
              <div style={{ background: '#1e293b', borderRadius: 10, padding: 18, marginBottom: 16, border: '1px solid #16a34a' }}>
                <h4 style={{ margin: '0 0 12px', color: '#4ade80' }}>➕ New Munshi</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[['name','Name','text'],['area','Area','text'],['region','Region','text'],['phone','Phone','text'],['email','Email','text'],['approval_limit','Approval Limit','number']].map(([f,l,t]) => (
                    <div key={f}>
                      <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>{l}</label>
                      <input type={t} value={addMunshi[f] || ''} onChange={e => setAddMunshi(r => ({ ...r, [f]: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 5, fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={createMunshi} style={{ padding: '7px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>💾 Save</button>
                  <button onClick={() => setAddMunshi(null)} style={{ padding: '7px 14px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Edit Munshi Form */}
            {editMunshi && (
              <div style={{ background: '#1e293b', borderRadius: 10, padding: 18, marginBottom: 16, border: '1px solid #3b82f6' }}>
                <h4 style={{ margin: '0 0 12px', color: '#93c5fd' }}>Edit: {editMunshi.name} ({editMunshi.id})</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[['name','Name','text'],['area','Area','text'],['region','Region','text'],['phone','Phone','text'],['email','Email','text'],['approval_limit','Approval Limit','number']].map(([f,l,t]) => (
                    <div key={f}>
                      <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>{l}</label>
                      <input type={t} value={editMunshi[f] || ''} onChange={e => setEditMunshi(r => ({ ...r, [f]: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 5, fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={saveMunshi} style={{ padding: '7px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>💾 Save</button>
                  <button onClick={() => setEditMunshi(null)} style={{ padding: '7px 14px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#0f172a' }}>
                    {['#', 'ID', 'Name', 'Area', 'Region', 'Phone', 'Approval Limit', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #334155', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {munshis.map((m, i) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? '#0f172a' : 'transparent' }}>
                      <td style={{ padding: '6px 10px', color: '#475569' }}>{i + 1}</td>
                      <td style={{ padding: '6px 10px', color: '#38bdf8', fontWeight: 700 }}>{m.id}</td>
                      <td style={{ padding: '6px 10px', color: '#f1f5f9', fontWeight: 600 }}>{m.name}</td>
                      <td style={{ padding: '6px 10px', color: '#a5f3fc' }}>{m.area || '—'}</td>
                      <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{m.region || '—'}</td>
                      <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{m.phone || '—'}</td>
                      <td style={{ padding: '6px 10px', color: '#a3e635' }}>₹{(m.approval_limit || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <span style={{ color: m.status === 'active' ? '#4ade80' : '#ef4444', fontSize: 11 }}>{m.status || 'active'}</span>
                      </td>
                      <td style={{ padding: '6px 10px', display: 'flex', gap: 6 }}>
                        <button onClick={() => { setEditMunshi({ ...m }); setMunshiMsg(''); }}
                          style={{ padding: '3px 10px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>✏️ Edit</button>
                        <button onClick={() => deleteMunshi(m.id)}
                          style={{ padding: '3px 10px', background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── DRIVERS TAB ── */}
        {tab === 'drivers' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: '#93c5fd', fontSize: 14 }}>
                {driverLoading ? '⏳ Loading…' : `${drivers.length} Drivers in DB`}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setAddDriver({ name: '', license_number: '', phone: '', email: '', status: 'active' }); setDriverMsg(''); }}
                  style={{ padding: '5px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                  ➕ Add New
                </button>
                <button onClick={loadDrivers} style={{ padding: '5px 14px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                  🔄 Refresh
                </button>
              </div>
            </div>
            {driverMsg && <div style={{ background: '#1e293b', borderRadius: 6, padding: '8px 14px', marginBottom: 12, color: driverMsg.startsWith('✅') ? '#4ade80' : '#f87171', fontSize: 13 }}>{driverMsg}</div>}

            {/* Add Driver Form */}
            {addDriver && (
              <div style={{ background: '#1e293b', borderRadius: 10, padding: 18, marginBottom: 16, border: '1px solid #16a34a' }}>
                <h4 style={{ margin: '0 0 12px', color: '#4ade80' }}>➕ New Driver</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[['name','Name','text'],['license_number','License No','text'],['phone','Phone','text'],['email','Email','text'],['status','Status','text']].map(([f,l,t]) => (
                    <div key={f}>
                      <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>{l}</label>
                      <input type={t} value={addDriver[f] || ''} onChange={e => setAddDriver(r => ({ ...r, [f]: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 5, fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={createDriver} style={{ padding: '7px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>💾 Save</button>
                  <button onClick={() => setAddDriver(null)} style={{ padding: '7px 14px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {/* Edit Driver Form */}
            {editDriver && (
              <div style={{ background: '#1e293b', borderRadius: 10, padding: 18, marginBottom: 16, border: '1px solid #3b82f6' }}>
                <h4 style={{ margin: '0 0 12px', color: '#93c5fd' }}>Edit: {editDriver.name} ({editDriver.id})</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[['name','Name','text'],['license_number','License No','text'],['phone','Phone','text'],['email','Email','text'],['status','Status','text']].map(([f,l,t]) => (
                    <div key={f}>
                      <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>{l}</label>
                      <input type={t} value={editDriver[f] || ''} onChange={e => setEditDriver(r => ({ ...r, [f]: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 5, fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={saveDriver} style={{ padding: '7px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>💾 Save</button>
                  <button onClick={() => setEditDriver(null)} style={{ padding: '7px 14px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#0f172a' }}>
                    {['#', 'ID', 'Name', 'License No', 'Phone', 'Email', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #334155', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d, i) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? '#0f172a' : 'transparent' }}>
                      <td style={{ padding: '6px 10px', color: '#475569' }}>{i + 1}</td>
                      <td style={{ padding: '6px 10px', color: '#38bdf8', fontWeight: 700 }}>{d.id}</td>
                      <td style={{ padding: '6px 10px', color: '#f1f5f9', fontWeight: 600 }}>{d.name}</td>
                      <td style={{ padding: '6px 10px', color: '#a5f3fc' }}>{d.license_number || '—'}</td>
                      <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{d.phone || '—'}</td>
                      <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{d.email || '—'}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <span style={{ color: d.status === 'active' ? '#4ade80' : '#ef4444', fontSize: 11 }}>{d.status || 'active'}</span>
                      </td>
                      <td style={{ padding: '6px 10px', display: 'flex', gap: 6 }}>
                        <button onClick={() => { setEditDriver({ ...d }); setDriverMsg(''); }}
                          style={{ padding: '3px 10px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>✏️ Edit</button>
                        <button onClick={() => deleteDriver(d.id)}
                          style={{ padding: '3px 10px', background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── POIs TAB ── */}
        {tab === 'pois' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ margin: 0, color: '#93c5fd', fontSize: 14 }}>
                {poiLoading ? '⏳ Loading…' : `${pois.length} POIs for ${clientId}`}
              </h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  value={poiSearch} onChange={e => setPoiSearch(e.target.value)}
                  placeholder="Search name / city / state…"
                  style={{ padding: '5px 10px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, fontSize: 12, width: 200 }}
                />
                <button onClick={loadPOIs} style={{ padding: '5px 14px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                  🔄 Refresh
                </button>
              </div>
            </div>
            {poiMsg && <div style={{ background: '#1e293b', borderRadius: 6, padding: '8px 14px', marginBottom: 12, color: poiMsg.startsWith('✅') ? '#4ade80' : '#f87171', fontSize: 13 }}>{poiMsg}</div>}

            {/* Edit POI Form */}
            {editPoi && (
              <div style={{ background: '#1e293b', borderRadius: 10, padding: 18, marginBottom: 16, border: '1px solid #3b82f6' }}>
                <h4 style={{ margin: '0 0 12px', color: '#93c5fd' }}>Edit POI #{editPoi.id}: {editPoi.poi_name}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[
                    ['poi_name','POI Name','text'],['city','City','text'],['state','State','text'],
                    ['address','Address','text'],['pin_code','Pin Code','text'],['radius_meters','Radius (m)','number'],
                    ['latitude','Latitude','number'],['longitude','Longitude','number'],
                  ].map(([f,l,t]) => (
                    <div key={f}>
                      <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>{l}</label>
                      <input type={t} value={editPoi[f] || ''} onChange={e => setEditPoi(r => ({ ...r, [f]: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 5, fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Type</label>
                    <select value={editPoi.type || 'other'} onChange={e => setEditPoi(r => ({ ...r, type: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 5, fontSize: 13, boxSizing: 'border-box' }}>
                      <option value="primary">primary — main hub / factory</option>
                      <option value="warehouse">warehouse — owned depot</option>
                      <option value="secondary">distributor — regional distributor</option>
                      <option value="tertiary">dealer — end dealer / retailer</option>
                      <option value="other">other — unclassified</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={savePoi} style={{ padding: '7px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>💾 Save</button>
                  <button onClick={() => setEditPoi(null)} style={{ padding: '7px 14px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#0f172a' }}>
                    {['#', 'ID', 'Name', 'City', 'State', 'Type', 'Radius', 'Lat/Lng', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #334155', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pois
                    .filter(p => !poiSearch || [p.poi_name, p.city, p.state, p.type].some(v => v && v.toLowerCase().includes(poiSearch.toLowerCase())))
                    .map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? '#0f172a' : 'transparent' }}>
                      <td style={{ padding: '6px 10px', color: '#475569' }}>{i + 1}</td>
                      <td style={{ padding: '6px 10px', color: '#38bdf8' }}>{p.id}</td>
                      <td style={{ padding: '6px 10px', color: '#f1f5f9', fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.poi_name}</td>
                      <td style={{ padding: '6px 10px', color: '#a5f3fc' }}>{p.city || '—'}</td>
                      <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{p.state || '—'}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background:
                          p.type === 'primary' ? '#1e3a5f' : p.type === 'secondary' ? '#3b1f5e' : p.type === 'tertiary' ? '#1a3a2a' : '#2d2210',
                          color: p.type === 'primary' ? '#60a5fa' : p.type === 'secondary' ? '#c084fc' : p.type === 'tertiary' ? '#4ade80' : '#fbbf24' }}>
                          {p.type === 'primary' ? 'Hub' : p.type === 'secondary' ? 'Distributor' : p.type === 'tertiary' ? 'Dealer' : 'Other'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{p.radius_meters || 1500}m</td>
                      <td style={{ padding: '6px 10px', color: '#475569', fontSize: 11 }}>{Number(p.latitude).toFixed(4)}, {Number(p.longitude).toFixed(4)}</td>
                      <td style={{ padding: '6px 10px', display: 'flex', gap: 6 }}>
                        <button onClick={() => { setEditPoi({ ...p }); setPoiMsg(''); }}
                          style={{ padding: '3px 10px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>✏️ Edit</button>
                        <button onClick={() => deletePoi(p.id)}
                          style={{ padding: '3px 10px', background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* ── ASSIGN MUNSHI TAB ── */}
        {tab === 'assign' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: '#93c5fd', fontSize: 14 }}>
                {assignLoading ? '⏳ Loading…' : `${assignVehicles.length} vehicles — select munshi and click Assign`}
              </h3>
              <button onClick={loadAssignData} style={{ padding: '5px 14px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>🔄 Refresh</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#0f172a', position: 'sticky', top: 0 }}>
                    {['#', 'Vehicle No', 'Current Munshi', 'Assign Munshi', ''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', borderBottom: '1px solid #334155', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignVehicles.map((v, i) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? '#0f172a' : 'transparent' }}>
                      <td style={{ padding: '6px 10px', color: '#475569' }}>{i + 1}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: '#f1f5f9' }}>{v.vehicle_no}</td>
                      <td style={{ padding: '6px 10px', color: v.munshi_name ? '#fbbf24' : '#475569' }}>
                        {v.munshi_name || <span style={{ color: '#ef4444' }}>⚠ None</span>}
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <select
                          value={assignSelected[v.id] || ''}
                          onChange={e => setAssignSelected(p => ({ ...p, [v.id]: e.target.value }))}
                          style={{ padding: '5px 8px', background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 5, fontSize: 12, minWidth: 160 }}
                        >
                          <option value=''>— Unassign —</option>
                          {assignMunshis.map(m => (
                            <option key={m.id} value={String(m.id)}>{m.name}{m.area ? ` (${m.area})` : ''}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => assignMunshi(v.id)}
                          style={{ padding: '4px 14px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >Assign</button>
                        {assignMsg[v.id] && <span style={{ fontSize: 14 }}>{assignMsg[v.id]}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── EWB MUNSHI ASSIGN TAB ── */}
        {tab === 'ewb-munshi' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, color: '#f59e0b', fontSize: 15 }}>🧑‍💼 POI → Munshi Mapping for E-Way Bills</h3>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>
                  Each row is a unique “from” POI found in your EWBs. Assign a munshi per POI, then click “Re-assign All EWBs”.
                </p>
              </div>
              <button onClick={loadEwbPoiSummary} disabled={ewbPoiLoading}
                style={{ padding: '6px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                {ewbPoiLoading ? '⏳' : '🔄'} Refresh
              </button>
            </div>

            {/* POI → Munshi mapping table */}
            {ewbPoiLoading ? (
              <div style={{ color: '#64748b', padding: 24, textAlign: 'center' }}>Loading…</div>
            ) : ewbPois.length === 0 ? (
              <div style={{ color: '#64748b', padding: 30, textAlign: 'center', background: '#1e293b', borderRadius: 10 }}>No EWB bills with matched from-POI found.</div>
            ) : (
              <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #334155', fontSize: 11 }}>From POI</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #334155', fontSize: 11 }}>Bills</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #334155', fontSize: 11 }}>Assign Munshi</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #334155', fontSize: 11 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ewbPois.map((poi, i) => (
                      <tr key={poi.poi_id} style={{ background: i % 2 === 0 ? '#0f172a' : '#111827', borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{poi.poi_name}</div>
                          <div style={{ color: '#475569', fontSize: 11 }}>POI #{poi.poi_id}</div>
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                          <span style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '2px 10px', fontSize: 12, color: '#94a3b8' }}>
                            {poi.bill_count}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <select
                            value={ewbPoiSel[poi.poi_id] || ''}
                            onChange={e => setEwbPoiSel(p => ({ ...p, [poi.poi_id]: e.target.value }))}
                            style={{ background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 6, padding: '5px 10px', fontSize: 12, width: 200, cursor: 'pointer' }}
                          >
                            <option value=''>— Unassigned —</option>
                            {ewbMunshis.map(m => (
                              <option key={m.id} value={m.id}>{m.name} ({m.area})</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <button
                            onClick={() => savePoiMunshi(poi)}
                            disabled={ewbSaveMsg[poi.poi_id] === '⏳'}
                            style={{ padding: '5px 14px', background: '#1d4ed8', border: 'none', borderRadius: 5, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Save
                          </button>
                          {ewbSaveMsg[poi.poi_id] && (
                            <span style={{ marginLeft: 8, fontSize: 13 }}>{ewbSaveMsg[poi.poi_id]}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Re-assign all EWBs */}
            <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>🔄 Re-assign Munshis on EWB Bills</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Fills bills that have no munshi yet. Use “Overwrite” to update ALL bills (including previously assigned ones).</div>
              </div>
              <button onClick={() => reassignAllMunshis(false)} disabled={ewbReassigning}
                style={{ padding: '8px 18px', background: '#16a34a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {ewbReassigning ? '⏳ Working…' : '➕ Fill Missing'}
              </button>
              <button onClick={() => reassignAllMunshis(true)} disabled={ewbReassigning}
                style={{ padding: '8px 18px', background: '#7c3aed', border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {ewbReassigning ? '⏳ Working…' : '♻️ Overwrite All'}
              </button>
            </div>
            {ewbReassignMsg && (
              <div style={{ marginTop: 10, padding: '8px 14px', borderRadius: 7,
                background: ewbReassignMsg.startsWith('✅') ? '#14532d' : '#7f1d1d',
                color: ewbReassignMsg.startsWith('✅') ? '#4ade80' : '#fca5a5', fontSize: 13 }}>
                {ewbReassignMsg}
              </div>
            )}

            {/* Auto-create secondary POIs from unmatched trade names */}
            <div style={{ background: '#1e293b', borderRadius: 10, padding: 16, marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>📍 Auto-create Distributor POIs from Unmatched Bills</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Scans bills with no from/to POI match and creates new <strong style={{color:'#94a3b8'}}>distributor</strong> POIs
                  from their trade name + city. Then re-runs POI matching on all bills.
                  Use <em>Dry Run</em> to preview first.
                </div>
              </div>
              <button onClick={() => autoCreatePois(true)} disabled={ewbAutoPoiLoading}
                style={{ padding: '8px 16px', background: '#334155', border: '1px solid #475569', borderRadius: 7, color: '#94a3b8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {ewbAutoPoiLoading ? '⏳' : '🔍'} Dry Run
              </button>
              <button onClick={() => autoCreatePois(false)} disabled={ewbAutoPoiLoading}
                style={{ padding: '8px 18px', background: '#0369a1', border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {ewbAutoPoiLoading ? '⏳ Working…' : '📍 Create & Re-match'}
              </button>
            </div>
            {ewbAutoPoiMsg && (
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 7, whiteSpace: 'pre-line',
                background: ewbAutoPoiMsg.startsWith('✅') ? '#14532d' : ewbAutoPoiMsg.startsWith('🔍') ? '#1e3a5f' : '#7f1d1d',
                color: ewbAutoPoiMsg.startsWith('✅') ? '#4ade80' : ewbAutoPoiMsg.startsWith('🔍') ? '#93c5fd' : '#fca5a5', fontSize: 12 }}>
                {ewbAutoPoiMsg}
              </div>
            )}
          </div>
        )}

        {/* ── DELIVERED EWBs TAB ── */}
        {tab === 'delivered' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <h3 style={{ margin: 0, color: '#4ade80', fontSize: 15 }}>📦 Delivered E-Way Bills — {deliveredTotal} total</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={bulkDeliverHistorical} disabled={bulkDelivering}
                  style={{ padding: '7px 18px', background: bulkDelivering ? '#374151' : '#7c3aed', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                  {bulkDelivering ? '⏳ Processing…' : '🗂️ Mark All Old Bills Delivered'}
                </button>
                <button onClick={loadDelivered} disabled={deliveredLoading}
                  style={{ padding: '6px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                  {deliveredLoading ? '⏳ Loading…' : '🔄 Refresh'}
                </button>
              </div>
            </div>
            {bulkDeliverMsg && (
              <div style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 7,
                background: bulkDeliverMsg.startsWith('✅') ? '#14532d' : '#7f1d1d',
                color: bulkDeliverMsg.startsWith('✅') ? '#4ade80' : '#fca5a5', fontSize: 13 }}>
                {bulkDeliverMsg}
              </div>
            )}

            {deliveredLoading ? (
              <div style={{ color: '#64748b', padding: 30, textAlign: 'center' }}>Loading…</div>
            ) : deliveredBills.length === 0 ? (
              <div style={{ color: '#64748b', padding: 40, textAlign: 'center', background: '#1e293b', borderRadius: 10 }}>
                No delivered bills found. Mark bills as delivered in the E-Way Bill Hub.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                      {['EWB No', 'Doc No', 'Doc Date', 'Vehicle', 'From', 'To', 'Value', 'Delivered At', 'Munshi'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #334155', fontWeight: 700, fontSize: 10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deliveredBills.map((b, i) => (
                      <tr key={b.id} style={{ background: i % 2 === 0 ? '#0f172a' : '#111827', borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '7px 10px', color: '#38bdf8', fontFamily: 'monospace' }}>
                          {b.ewb_no && b.ewb_no.endsWith('000000')
                            ? <span title='Truncated EWB'><span style={{ color: '#f87171' }}>⚠</span> {b.ewb_no}</span>
                            : b.ewb_no || '—'}
                        </td>
                        <td style={{ padding: '7px 10px', color: '#94a3b8' }}>{b.doc_no || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#94a3b8' }}>{b.doc_date || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#fbbf24', fontWeight: 700 }}>{b.vehicle_no || <span style={{ color: '#475569' }}>No vehicle</span>}</td>
                        <td style={{ padding: '7px 10px', color: '#e2e8f0' }}>{b.from_poi_name || b.from_place || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#e2e8f0' }}>{b.to_poi_name || b.to_place || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#4ade80' }}>{b.total_value ? '₹' + Number(b.total_value).toLocaleString('en-IN') : '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#a78bfa', fontFamily: 'monospace' }}>
                          {b.delivered_at
                            ? <span title={b.delivered_at}>✅ {b.delivered_at.slice(0, 10)}</span>
                            : <span style={{ color: '#475569' }}>—</span>}
                        </td>
                        <td style={{ padding: '7px 10px', color: '#94a3b8' }}>{b.munshi_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TRUCK FREQUENCY TAB ── */}
        {tab === 'truck-freq' && (
          <div>

            {/* ── AUTO-ASSIGN EWB VEHICLES ── */}
            <div style={{ background: '#1e293b', borderRadius: 12, padding: '18px 22px', marginBottom: 22,
              border: '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 20 }}>🔗</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9' }}>Auto-Assign Vehicles to EWBs</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Uses GPS geofence + doc date to match trucks to eway bills</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                  {autoAssignResult && (
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      ✅ <strong style={{ color: '#4ade80' }}>{autoAssignResult.assigned}</strong> assigned
                      &nbsp;·&nbsp;
                      ⚠️ <strong style={{ color: '#fbbf24' }}>{autoAssignResult.conflicts}</strong> conflicts
                      &nbsp;·&nbsp;
                      ⏩ <strong style={{ color: '#94a3b8' }}>{autoAssignResult.skipped}</strong> no GPS
                    </span>
                  )}
                  <button
                    disabled={autoAssignLoading}
                    onClick={async () => {
                      setAutoAssignLoading(true); setAutoAssignResult(null); setAutoAssignShowAll(false);
                      try {
                        const r = await fetch(`${API}/eway-bills-hub/auto-assign-vehicles`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ client_id: clientId, overwrite: false }),
                        });
                        const d = await r.json();
                        setAutoAssignResult(d);
                      } catch(e) { setAutoAssignResult({ error: e.message }); }
                      setAutoAssignLoading(false);
                    }}
                    style={{ padding: '8px 18px', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: 13,
                      background: autoAssignLoading ? '#334155' : '#7c3aed', color: '#fff', cursor: autoAssignLoading ? 'default' : 'pointer' }}>
                    {autoAssignLoading ? '⏳ Matching…' : '🚀 Run Auto-Assign'}
                  </button>
                  <a href={`${API}/eway-bills-hub/export-vehicle-data?client_id=${encodeURIComponent(clientId)}&status=all`}
                    download
                    style={{ padding: '8px 16px', borderRadius: 8, fontWeight: 800, fontSize: 13,
                      background: '#0f172a', color: '#38bdf8', textDecoration: 'none', border: '1px solid #1e293b', cursor: 'pointer' }}>
                    ⬇️ Download All
                  </a>
                  <a href={`${API}/eway-bills-hub/export-vehicle-data?client_id=${encodeURIComponent(clientId)}&status=assigned`}
                    download
                    style={{ padding: '8px 16px', borderRadius: 8, fontWeight: 800, fontSize: 13,
                      background: '#0f172a', color: '#4ade80', textDecoration: 'none', border: '1px solid #1e293b', cursor: 'pointer' }}>
                    ⬇️ Assigned Only
                  </a>
                </div>
              </div>

              {autoAssignResult && !autoAssignResult.error && autoAssignResult.details && (
                <div>
                  {/* Summary stats row */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    {[['Total EWBs', autoAssignResult.total, '#64748b'],
                      ['Assigned', autoAssignResult.assigned, '#4ade80'],
                      ['🎯 Both POIs', autoAssignResult.details?.filter(d => d.match_type === 'both').length || 0, '#4ade80'],
                      ['📍 From Only', autoAssignResult.details?.filter(d => d.match_type === 'from_only').length || 0, '#38bdf8'],
                      ['Conflicts', autoAssignResult.conflicts, '#fbbf24'],
                      ['No GPS', autoAssignResult.skipped, '#f87171']]
                      .map(([lbl, val, color]) => (
                      <div key={lbl} style={{ background: '#0f172a', padding: '8px 14px', borderRadius: 8, minWidth: 100, textAlign: 'center' }}>
                        <div style={{ fontWeight: 800, fontSize: 20, color }}>{val}</div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{lbl}</div>
                      </div>
                    ))}
                  </div>

                  {/* Results table */}
                  <div style={{ overflowX: 'auto', maxHeight: 340, overflowY: 'auto', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: '#0f172a', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, position: 'sticky', top: 0 }}>
                          {['EWB No', 'Date', 'From POI', 'To POI', 'Vehicle', 'Size', 'Munshi', 'F-Pings', 'T-Pings', 'Match', 'Status'].map(h => (
                            <th key={h} style={{ padding: '7px 10px', textAlign: 'left', borderBottom: '1px solid #1e293b', fontSize: 10, fontWeight: 700 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(autoAssignShowAll ? autoAssignResult.details : autoAssignResult.details.slice(0, 30)).map((row, i) => {
                          const SIZE_MAP = {
                            'category_1_32ft_34ft': '🚛 32ft/34ft',
                            'category_2_22ft_24ft': '🚚 22ft/24ft',
                            'category_3_small':     '🛻 Small',
                          };
                          const MATCH_STYLE = {
                            both:      { bg: '#16a34a33', color: '#4ade80',  label: '🎯 Both' },
                            from_only: { bg: '#0ea5e933', color: '#38bdf8',  label: '📍 From' },
                            to_only:   { bg: '#a78bfa33', color: '#a78bfa',  label: '🏁 To' },
                          };
                          const ms = MATCH_STYLE[row.match_type] || {};
                          return (
                            <tr key={i} style={{ background: i % 2 === 0 ? '#0f172a' : '#111827', borderBottom: '1px solid #1e293b' }}>
                              <td style={{ padding: '6px 10px', color: '#38bdf8', fontFamily: 'monospace' }}>{row.ewb_no}</td>
                              <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{row.doc_date}</td>
                              <td style={{ padding: '6px 10px', color: '#e2e8f0', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.from_poi || row.poi}</td>
                              <td style={{ padding: '6px 10px', color: '#94a3b8', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.to_poi || '—'}</td>
                              <td style={{ padding: '6px 10px', color: row.vehicle ? '#fbbf24' : '#475569', fontWeight: 700, fontFamily: 'monospace' }}>{row.vehicle || '—'}</td>
                              <td style={{ padding: '6px 10px', color: '#a78bfa' }}>{row.vehicle_size ? (SIZE_MAP[row.vehicle_size] || row.vehicle_size) : '—'}</td>
                              <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{row.munshi_name || '—'}</td>
                              <td style={{ padding: '6px 10px', color: '#38bdf8', textAlign: 'right' }}>{row.from_pings ?? row.ping_count ?? '—'}</td>
                              <td style={{ padding: '6px 10px', color: '#a78bfa', textAlign: 'right' }}>{row.to_pings ?? '—'}</td>
                              <td style={{ padding: '6px 10px' }}>
                                {ms.label ? (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                                    background: ms.bg, color: ms.color }}>{ms.label}</span>
                                ) : '—'}
                              </td>
                              <td style={{ padding: '6px 10px' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                                  background: row.status === 'assigned' ? '#16a34a22' : '#dc262622',
                                  color: row.status === 'assigned' ? '#4ade80' : '#f87171' }}>
                                  {row.status === 'assigned' ? '✅ Assigned' : '⏩ No GPS'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {autoAssignResult.details.length > 30 && (
                    <button onClick={() => setAutoAssignShowAll(p => !p)}
                      style={{ marginTop: 8, fontSize: 11, background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer' }}>
                      {autoAssignShowAll ? '▲ Show less' : `▼ Show all ${autoAssignResult.details.length} rows`}
                    </button>
                  )}
                </div>
              )}
              {autoAssignResult?.error && (
                <div style={{ color: '#f87171', fontSize: 12 }}>❌ {autoAssignResult.error}</div>
              )}
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>Data source:</span>
              {[['gps', '📡 GPS Geofence'], ['ewb', '📄 EWB Records']].map(([val, lbl]) => (
                <button key={val} onClick={() => { setVehFreqMode(val); loadVehFreq(vehFreqPoiType, val, vehFreqDays); }}
                  style={{ padding: '5px 14px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    background: vehFreqMode === val ? '#7c3aed' : '#1e293b', color: vehFreqMode === val ? '#fff' : '#94a3b8' }}>
                  {lbl}
                </button>
              ))}
              {vehFreqMode === 'gps' && (
                <>
                  <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>Last</span>
                  {[30, 60, 90, 180].map(d => (
                    <button key={d} onClick={() => { setVehFreqDays(d); loadVehFreq(vehFreqPoiType, vehFreqMode, d); }}
                      style={{ padding: '4px 10px', borderRadius: 5, border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                        background: vehFreqDays === d ? '#0369a1' : '#1e293b', color: vehFreqDays === d ? '#fff' : '#64748b' }}>
                      {d}d
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Filter bar */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>POI type:</span>
              {[['hub','🏭 Hub'],['secondary','🔄 Distributor'],['tertiary','📦 Dealer'],['all','🌐 All']].map(([val, lbl]) => (
                <button key={val} onClick={() => { setVehFreqPoiType(val); loadVehFreq(val, vehFreqMode, vehFreqDays); }}
                  style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    background: vehFreqPoiType === val ? '#3b82f6' : '#1e293b', color: vehFreqPoiType === val ? '#fff' : '#94a3b8' }}>
                  {lbl}
                </button>
              ))}
              <button onClick={() => loadVehFreq()} disabled={vehFreqLoading}
                style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', background: '#0f172a', color: '#38bdf8' }}>
                {vehFreqLoading ? '⏳ Loading…' : '🔄 Refresh'}
              </button>
            </div>

            {/* Meta info */}
            {!vehFreqLoading && vehFreqMeta.days_scanned && (
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
                📡 GPS scan: last <strong style={{ color: '#94a3b8' }}>{vehFreqMeta.days_scanned} days</strong>
                &nbsp;·&nbsp;
                <strong style={{ color: '#94a3b8' }}>{vehFreqMeta.poi_count}</strong> POIs with GPS hits
              </div>
            )}

            {vehFreqLoading && (
              <div style={{ color: '#94a3b8', padding: 30, textAlign: 'center', background: '#1e293b', borderRadius: 10 }}>
                ⏳ {vehFreqMode === 'gps' ? 'Computing geofence visits from GPS data…' : 'Loading EWB frequency…'}
              </div>
            )}

            {!vehFreqLoading && vehFreq.length === 0 && (
              <div style={{ color: '#64748b', padding: 24, textAlign: 'center', background: '#1e293b', borderRadius: 10 }}>
                {vehFreqMode === 'gps'
                  ? '📡 No GPS pings found inside any POI geofence. Check that POIs have coordinates.'
                  : '📄 No EWB data with vehicle numbers found.'}
              </div>
            )}

            {!vehFreqLoading && vehFreq.map(hub => {
              const maxCount = hub.vehicles.length ? hub.vehicles[0].visit_count : 1;
              return (
                <div key={hub.poi_id} style={{ background: '#1e293b', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
                  {/* Hub header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>
                      {hub.poi_type === 'primary' || hub.poi_type === 'warehouse' ? '🏭'
                        : hub.poi_type === 'secondary' ? '🔄' : hub.poi_type === 'tertiary' ? '📦' : '📍'}
                    </span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#e2e8f0' }}>{hub.poi_name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {hub.city && <span>{hub.city}  </span>}
                        {hub.radius && vehFreqMode === 'gps' && <span style={{ color: '#475569' }}>· {hub.radius}m radius</span>}
                      </div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, padding: '2px 10px',
                      borderRadius: 10, background: '#0f172a', color: '#38bdf8' }}>
                      {hub.vehicles.length} truck{hub.vehicles.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Vehicle rows */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                    {hub.vehicles.map((v, idx) => {
                      const pct = Math.round((v.visit_count / maxCount) * 100);
                      const rankColor = idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#cd7f32' : '#475569';
                      const isSelected = (vehFreqSel[hub.poi_id] || new Set()).has(v.vehicle_no);
                      const SIZE_MAP = {
                        'category_1_32ft_34ft': { label: '32ft / 34ft', color: '#f97316', icon: '🚛' },
                        'category_2_22ft_24ft': { label: '22ft / 24ft', color: '#a78bfa', icon: '🚚' },
                        'category_3_small':     { label: 'Small',        color: '#34d399', icon: '🛻' },
                      };
                      const sizeInfo = SIZE_MAP[v.vehicle_size] || (v.vehicle_size ? { label: v.vehicle_size, color: '#64748b', icon: '🚗' } : null);
                      return (
                        <div key={v.vehicle_no}
                          onClick={() => toggleVehSel(hub.poi_id, v.vehicle_no)}
                          style={{ background: isSelected ? '#1e3a5f' : '#0f172a', borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
                            border: `1px solid ${isSelected ? '#3b82f6' : idx === 0 ? '#fbbf2440' : '#1e293b'}`,
                            transition: 'all 0.15s ease' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                            {/* Checkbox */}
                            <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isSelected ? '#3b82f6' : '#334155'}`,
                              background: isSelected ? '#3b82f6' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {isSelected && <span style={{ fontSize: 10, color: '#fff', fontWeight: 900 }}>✓</span>}
                            </div>
                            <span style={{ fontWeight: 800, fontSize: 13, color: rankColor, minWidth: 22 }}>#{idx + 1}</span>
                            <span style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0', flex: 1 }}>{v.vehicle_no}</span>
                            <span style={{ fontWeight: 800, fontSize: 16, color: '#38bdf8' }}>{v.visit_count}</span>
                            <span style={{ fontSize: 10, color: '#64748b' }}>{vehFreqMode === 'gps' ? 'days' : 'trips'}</span>
                          </div>
                          <div style={{ background: '#1e293b', borderRadius: 4, height: 5, overflow: 'hidden', marginBottom: 5 }}>
                            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4,
                              background: idx === 0 ? '#fbbf24' : idx < 3 ? '#3b82f6' : '#334155',
                              transition: 'width 0.4s ease' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {sizeInfo && (
                              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 5,
                                background: `${sizeInfo.color}18`, color: sizeInfo.color, border: `1px solid ${sizeInfo.color}55`,
                                letterSpacing: 0.3 }}>
                                {sizeInfo.icon} {sizeInfo.label}
                              </span>
                            )}
                            {v.munshi_name && (
                              <span style={{ fontSize: 10, color: '#94a3b8' }}>👤 {v.munshi_name}</span>
                            )}
                            {v.last_date && (
                              <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>Last: {v.last_date}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Assign bar */}
                  {(vehFreqSel[hub.poi_id] || new Set()).size > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      background: '#0f172a', borderRadius: 8, border: '1px solid #3b82f6' }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', flex: 1 }}>
                        <strong style={{ color: '#38bdf8' }}>{(vehFreqSel[hub.poi_id] || new Set()).size}</strong> truck{(vehFreqSel[hub.poi_id] || new Set()).size > 1 ? 's' : ''} selected
                      </span>
                      {vehFreqAssignMsg[hub.poi_id] && (
                        <span style={{ fontSize: 11, color: vehFreqAssignMsg[hub.poi_id].startsWith('✅') ? '#4ade80' : '#f87171' }}>
                          {vehFreqAssignMsg[hub.poi_id]}
                        </span>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); assignSelectedVehicles(hub); }}
                        style={{ padding: '6px 16px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 12,
                          background: '#3b82f6', color: '#fff', cursor: 'pointer' }}>
                        📌 Assign to POI
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setVehFreqSel(p => ({ ...p, [hub.poi_id]: new Set() })); }}
                        style={{ padding: '6px 10px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 11,
                          background: '#1e293b', color: '#94a3b8', cursor: 'pointer' }}>
                        ✕ Clear
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── DELIVERY POINTS TAB ── */}
        {tab === 'deliveries' && (
          <div>
            {/* Filter bar */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>Status:</span>
              {[['all','🌐 All'],['pending','⏳ Pending'],['delivered','✅ Delivered']].map(([val, lbl]) => (
                <button key={val} onClick={() => { setDelivStatus(val); loadDelivPois(val, delivPoiType); }}
                  style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    background: delivStatus === val ? '#3b82f6' : '#1e293b', color: delivStatus === val ? '#fff' : '#94a3b8' }}>
                  {lbl}
                </button>
              ))}
              <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginLeft: 12 }}>Type:</span>
              {[['all','All'],['primary','Hub'],['secondary','Distributor'],['tertiary','Dealer'],['other','Other']].map(([val, lbl]) => (
                <button key={val} onClick={() => { setDelivPoiType(val); loadDelivPois(delivStatus, val); }}
                  style={{ padding: '5px 12px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                    background: delivPoiType === val ? '#7c3aed' : '#1e293b', color: delivPoiType === val ? '#fff' : '#94a3b8' }}>
                  {lbl}
                </button>
              ))}
              <button onClick={() => loadDelivPois()} disabled={delivLoading}
                style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', background: '#0f172a', color: '#38bdf8' }}>
                {delivLoading ? '⏳ Loading…' : '🔄 Refresh'}
              </button>
              <button onClick={() => bulkConfirmDelivered('2026-03-21')}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', background: '#16a34a', color: '#fff' }}>
                ✅ Mark All Delivered (21 Mar)
              </button>
              {delivConfirmMsg && (
                <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 700 }}>{delivConfirmMsg}</span>
              )}
            </div>

            {delivLoading && (
              <div style={{ color: '#94a3b8', padding: 30, textAlign: 'center', background: '#1e293b', borderRadius: 10 }}>
                ⏳ Loading deliveries…
              </div>
            )}

            {!delivLoading && delivPois.length === 0 && (
              <div style={{ color: '#64748b', padding: 24, textAlign: 'center', background: '#1e293b', borderRadius: 10 }}>
                No delivery data found for selected filters.
              </div>
            )}

            {!delivLoading && delivPois.map(poi => {
              const isOpen = !!delivExpanded[poi.poi_id];
              const typeIcon = poi.poi_type === 'primary' ? '🏭' : poi.poi_type === 'secondary' ? '🔄' : poi.poi_type === 'tertiary' ? '📦' : '📍';
              const pct = poi.total ? Math.round((poi.delivered / poi.total) * 100) : 0;
              return (
                <div key={poi.poi_id} style={{ background: '#1e293b', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
                  {/* POI header row — click to expand */}
                  <div onClick={() => setDelivExpanded(p => ({ ...p, [poi.poi_id]: !p[poi.poi_id] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', cursor: 'pointer' }}>
                    <span style={{ fontSize: 18 }}>{typeIcon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {poi.poi_name}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{poi.city}</div>
                    </div>
                    {/* Progress bar */}
                    <div style={{ width: 120, flexShrink: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 3 }}>
                        <span style={{ color: '#4ade80' }}>✅ {poi.delivered}</span>
                        <span style={{ color: '#fbbf24' }}>⏳ {poi.pending}</span>
                        <span style={{ color: '#94a3b8' }}>/{poi.total}</span>
                      </div>
                      <div style={{ background: '#0f172a', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#4ade80', borderRadius: 4, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 16, color: '#475569', marginLeft: 8 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded bills table */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid #0f172a', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: '#0f172a', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                            {['EWB No','Date','From','Vehicle','Size','Munshi','Value','Delivered'].map(h => (
                              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 10, borderBottom: '1px solid #1e293b' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {poi.bills.map((b, i) => {
                            const SIZE_MAP = {
                              'category_1_32ft_34ft': '🚛 32ft',
                              'category_2_22ft_24ft': '🚚 22ft',
                              'category_3_small':     '🛻 Small',
                            };
                            return (
                              <tr key={b.id} style={{ background: i % 2 === 0 ? '#0f172a' : '#111827', borderBottom: '1px solid #1e293b' }}>
                                <td style={{ padding: '6px 10px', color: '#38bdf8', fontFamily: 'monospace' }}>{b.ewb_no}</td>
                                <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{b.doc_date}</td>
                                <td style={{ padding: '6px 10px', color: '#e2e8f0', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.from_poi_name || '—'}</td>
                                <td style={{ padding: '6px 10px', color: b.vehicle_no ? '#fbbf24' : '#475569', fontWeight: 700, fontFamily: 'monospace' }}>{b.vehicle_no || '—'}</td>
                                <td style={{ padding: '6px 10px', color: '#a78bfa' }}>{b.vehicle_size ? (SIZE_MAP[b.vehicle_size] || b.vehicle_size) : '—'}</td>
                                <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{b.munshi_name || '—'}</td>
                                <td style={{ padding: '6px 10px', color: '#4ade80' }}>{b.total_value ? '₹' + Number(b.total_value).toLocaleString('en-IN') : '—'}</td>
                                <td style={{ padding: '6px 10px' }}>
                                  {b.delivered_at
                                    ? <span style={{ color: '#4ade80', fontSize: 10 }}>✅ {b.delivered_at.slice(0, 10)}</span>
                                    : <span style={{ color: '#475569', fontSize: 10 }}>⏳ Pending</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── EXPENSE TAB ── */}
        {tab === 'expense' && (
          <div>
            {/* Controls */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>Group by:</span>
              {[['vehicle','🚛 Vehicle'],['munshi','🧑‍💼 Munshi'],['date','📅 Date']].map(([val, lbl]) => (
                <button key={val} onClick={() => { setExpGroupBy(val); loadExpenseSummary(val, expDateFrom, expDateTo); }}
                  style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    background: expGroupBy === val ? '#7c3aed' : '#1e293b', color: expGroupBy === val ? '#fff' : '#94a3b8' }}>
                  {lbl}
                </button>
              ))}
              <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginLeft: 8 }}>From:</span>
              <input type="date" value={expDateFrom} onChange={e => setExpDateFrom(e.target.value)}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 12 }} />
              <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>To:</span>
              <input type="date" value={expDateTo} onChange={e => setExpDateTo(e.target.value)}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#e2e8f0', fontSize: 12 }} />
              <button onClick={() => loadExpenseSummary()} disabled={expLoading}
                style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', background: '#0f172a', color: '#38bdf8' }}>
                {expLoading ? '⏳' : '🔄 Load'}
              </button>
              <button onClick={async () => {
                setKmLoading(true); setKmResult(null);
                try {
                  const r = await fetch(`${API}/eway-bills-hub/calculate-km-expense`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ client_id: clientId, overwrite: true }),
                  });
                  const d = await r.json();
                  setKmResult(d);
                  loadExpenseSummary();
                  loadRouteKm();
                } catch(e) { setKmResult({ error: e.message }); }
                setKmLoading(false);
              }} disabled={kmLoading}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 12,
                  cursor: kmLoading ? 'default' : 'pointer', background: kmLoading ? '#334155' : '#0e7490', color: '#fff' }}>
                {kmLoading ? '⏳ Calculating…' : '📐 Calculate KM & Expense'}
              </button>
              <button onClick={() => loadRouteKm()} disabled={routeLoading}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 12,
                  cursor: routeLoading ? 'default' : 'pointer', background: routeLoading ? '#334155' : '#1e3a5f', color: '#38bdf8' }}>
                {routeLoading ? '⏳' : '🛣️ Route Wise'}
              </button>
              <button onClick={() => buildLedger(false)} disabled={ledgerLoading}
                style={{ padding: '6px 16px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 12,
                  cursor: ledgerLoading ? 'default' : 'pointer', background: ledgerLoading ? '#334155' : '#14532d', color: '#4ade80' }}>
                {ledgerLoading ? '⏳' : '🏗️ Build Ledger'}
              </button>
              <a href={`${API}/eway-bills-hub/export-vehicle-data?client_id=${encodeURIComponent(clientId)}&status=assigned`}
                download style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, fontWeight: 700, fontSize: 12,
                  background: '#0f172a', color: '#4ade80', textDecoration: 'none', border: '1px solid #1e293b' }}>
                ⬇️ Export CSV
              </a>
            </div>

            {/* KM Calculation Results */}
            {kmResult && !kmResult.error && (
              <div style={{ background: '#0c1a2e', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid #0e7490' }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: 13 }}>📐 KM Calculation Results</span>
                  {[
                    ['EWBs Updated', kmResult.updated, '#4ade80'],
                    ['Total KM', (kmResult.totals?.total_km || 0).toLocaleString('en-IN') + ' km', '#38bdf8'],
                    ['Est. Trip Expense', '₹' + (kmResult.totals?.trip_expense || 0).toLocaleString('en-IN'), '#e879f9'],
                    ['Est. Fuel Cost', '₹' + (kmResult.totals?.fuel_cost || 0).toLocaleString('en-IN'), '#fbbf24'],
                  ].map(([lbl, val, color]) => (
                    <div key={lbl} style={{ background: '#0f172a', padding: '6px 12px', borderRadius: 8, textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color }}>{val}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{lbl}</div>
                    </div>
                  ))}
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#0f172a', color: '#64748b', fontSize: 10, fontWeight: 700, position: 'sticky', top: 0 }}>
                        {['Vehicle','Size','Bills','Total KM','Rate/KM','Est. Trip Exp','Est. Fuel','Fuel Type'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: h.includes('KM') || h.includes('Exp') || h.includes('Fuel') ? 'right' : 'left', borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(kmResult.vehicle_summary || []).map((v, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#0f172a' : '#111827', borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '6px 10px', color: '#fbbf24', fontFamily: 'monospace', fontWeight: 700 }}>{v.vehicle_no}</td>
                          <td style={{ padding: '6px 10px', color: '#a78bfa' }}>{v.vehicle_size || '—'}</td>
                          <td style={{ padding: '6px 10px', color: '#64748b', textAlign: 'right' }}>{v.bill_count}</td>
                          <td style={{ padding: '6px 10px', color: '#38bdf8', textAlign: 'right', fontWeight: 700 }}>{v.total_km.toLocaleString('en-IN')} km</td>
                          <td style={{ padding: '6px 10px', color: '#94a3b8', textAlign: 'right' }}>
                            {v.vehicle_size === '32ft/34ft' ? '₹18' : v.vehicle_size === '22ft/24ft' ? '₹15' : '₹12'}
                          </td>
                          <td style={{ padding: '6px 10px', color: '#e879f9', textAlign: 'right', fontWeight: 700 }}>₹{v.trip_expense.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '6px 10px', color: '#fbbf24', textAlign: 'right' }}>₹{v.fuel_cost.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '6px 10px', color: '#64748b', fontSize: 10, textTransform: 'capitalize' }}>{v.fuel_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Ledger build message */}
            {ledgerMsg && (
              <div style={{ background: '#0f2d1a', border: '1px solid #166534', borderRadius: 8, padding: '8px 16px', marginBottom: 12,
                color: ledgerMsg.startsWith('❌') ? '#f87171' : '#4ade80', fontWeight: 700, fontSize: 12 }}>
                🏗️ {ledgerMsg}
              </div>
            )}

            {/* Route-wise KM table */}
            {routeRows.length > 0 && (
              <div style={{ background: '#0c1a2e', borderRadius: 10, padding: 14, marginBottom: 16, border: '1px solid #1e3a5f' }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: 13 }}>🛣️ Route-wise KM & Expense</span>
                  {[
                    ['Routes', routeRows.length, '#64748b'],
                    ['Total Bills', routeTotals.bill_count || 0, '#4ade80'],
                    ['Total KM', (routeTotals.total_km || 0).toLocaleString('en-IN') + ' km', '#38bdf8'],
                    ['Est. Trip Exp', '₹' + (routeTotals.trip_expense || 0).toLocaleString('en-IN'), '#e879f9'],
                    ['Est. Fuel', '₹' + (routeTotals.fuel_cost || 0).toLocaleString('en-IN'), '#fbbf24'],
                  ].map(([lbl, val, color]) => (
                    <div key={lbl} style={{ background: '#0f172a', padding: '6px 12px', borderRadius: 8, textAlign: 'center', minWidth: 80 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color }}>{val}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{lbl}</div>
                    </div>
                  ))}
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#0f172a', color: '#64748b', fontSize: 10, fontWeight: 700, position: 'sticky', top: 0 }}>
                        {['Route (From → To)','Bills','Avg KM','Total KM','Est. Trip Exp','Est. Fuel','Vehicles',''].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: ['Bills','Avg KM','Total KM','Est. Trip Exp','Est. Fuel','Vehicles'].includes(h) ? 'right' : 'left', borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {routeRows.map((rt, i) => (
                        <React.Fragment key={i}>
                          <tr onClick={() => setRouteExpanded(p => ({ ...p, [rt.route]: !p[rt.route] }))}
                            style={{ background: i % 2 === 0 ? '#0f172a' : '#111827', borderBottom: '1px solid #1e293b', cursor: 'pointer' }}>
                            <td style={{ padding: '6px 10px', color: '#e2e8f0', fontWeight: 600, minWidth: 200 }}>{rt.route}</td>
                            <td style={{ padding: '6px 10px', color: '#64748b', textAlign: 'right' }}>{rt.bill_count}</td>
                            <td style={{ padding: '6px 10px', color: '#94a3b8', textAlign: 'right' }}>{rt.avg_km} km</td>
                            <td style={{ padding: '6px 10px', color: '#38bdf8', textAlign: 'right', fontWeight: 700 }}>{rt.total_km.toLocaleString('en-IN')} km</td>
                            <td style={{ padding: '6px 10px', color: '#e879f9', textAlign: 'right', fontWeight: 700 }}>₹{rt.trip_expense.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '6px 10px', color: '#fbbf24', textAlign: 'right' }}>₹{rt.fuel_cost.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '6px 10px', color: '#94a3b8', textAlign: 'right' }}>{rt.vehicle_count}</td>
                            <td style={{ padding: '6px 10px', color: '#475569', fontSize: 10 }}>{routeExpanded[rt.route] ? '▲' : '▼'}</td>
                          </tr>
                          {routeExpanded[rt.route] && (
                            <tr>
                              <td colSpan={8} style={{ padding: '6px 16px 10px', background: '#0a1628', fontSize: 11, color: '#64748b' }}>
                                <span style={{ color: '#94a3b8', marginRight: 6 }}>Vehicles:</span>
                                {rt.vehicles.map(v => (
                                  <span key={v} style={{ background: '#1e293b', color: '#fbbf24', padding: '2px 8px', borderRadius: 4, margin: '2px 3px', fontFamily: 'monospace', fontWeight: 700, display: 'inline-block' }}>{v}</span>
                                ))}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Totals bar */}
            {!expLoading && expTotals.bill_count > 0 && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                {[
                  ['Bills', expTotals.bill_count, '#64748b'],
                  ['EWB Count', expTotals.bill_count, '#4ade80'],
                  ['Unloading', '₹' + Number(expTotals.unloading || 0).toLocaleString('en-IN'), '#f97316'],
                  ['Fuel', '₹' + Number(expTotals.fuel || 0).toLocaleString('en-IN'), '#fbbf24'],
                  ['DA', '₹' + Number(expTotals.da || 0).toLocaleString('en-IN'), '#38bdf8'],
                  ['Driver Debit', '₹' + Number(expTotals.driver_debit || 0).toLocaleString('en-IN'), '#f87171'],
                  ['Other', '₹' + Number(expTotals.other || 0).toLocaleString('en-IN'), '#94a3b8'],
                  ['Total Expense', '₹' + Number(expTotals.total_expense || 0).toLocaleString('en-IN'), '#e879f9'],
                ].map(([lbl, val, color]) => (
                  <div key={lbl} style={{ background: '#0f172a', padding: '7px 14px', borderRadius: 8, textAlign: 'center', minWidth: 90 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color }}>{val}</div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{lbl}</div>
                  </div>
                ))}
              </div>
            )}

            {expLoading && (
              <div style={{ color: '#94a3b8', padding: 30, textAlign: 'center', background: '#1e293b', borderRadius: 10 }}>⏳ Loading…</div>
            )}

            {/* Summary table */}
            {!expLoading && expRows.length > 0 && (
              <div style={{ overflowX: 'auto', borderRadius: 10, marginBottom: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#0f172a', color: '#64748b', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>
                      {[expGroupBy === 'vehicle' ? 'Vehicle' : expGroupBy === 'munshi' ? 'Munshi' : 'Date',
                        expGroupBy === 'vehicle' ? 'Size' : 'Vehicles',
                        expGroupBy !== 'munshi' ? 'Munshi' : '',
                        'Bills', 'Cargo Value', 'Unloading', 'Fuel', 'DA', 'Driver Debit', 'Other', 'Total Expense', ''].filter(Boolean).map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expRows.map((row, i) => {
                      const hasExp = row.total_expense > 0;
                      const lines = expLines.filter(l =>
                        expGroupBy === 'vehicle' ? row.vehicles.includes(l.vehicle_number)
                        : expGroupBy === 'munshi' ? (l.munshi_name === row.group_key || l.jc_munshi_name === row.group_key)
                        : l.expense_date === row.group_key
                      );
                      return (
                        <React.Fragment key={i}>
                          <tr onClick={() => setExpExpanded(p => ({ ...p, [row.group_key]: !p[row.group_key] }))}
                            style={{ background: i % 2 === 0 ? '#0f172a' : '#111827', borderBottom: '1px solid #1e293b', cursor: lines.length ? 'pointer' : 'default' }}>
                            <td style={{ padding: '7px 10px', color: '#fbbf24', fontWeight: 700, fontFamily: 'monospace' }}>{row.group_key}</td>
                            <td style={{ padding: '7px 10px', color: '#a78bfa', fontSize: 11 }}>
                              {expGroupBy === 'vehicle' ? (row.vehicle_size || '—') : row.vehicles.join(', ') || '—'}
                            </td>
                            {expGroupBy !== 'munshi' && (
                              <td style={{ padding: '7px 10px', color: '#94a3b8', fontSize: 11 }}>{row.munshis.join(', ') || '—'}</td>
                            )}
                            <td style={{ padding: '7px 10px', color: '#64748b', textAlign: 'right' }}>{row.bill_count}</td>
                            <td style={{ padding: '7px 10px', color: '#4ade80', textAlign: 'right', fontWeight: 700 }}>
                              ₹{Number(row.cargo_value).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '7px 10px', color: row.unloading ? '#f97316' : '#334155', textAlign: 'right' }}>
                              {row.unloading ? '₹' + row.unloading.toLocaleString('en-IN') : '—'}
                            </td>
                            <td style={{ padding: '7px 10px', color: row.fuel ? '#fbbf24' : '#334155', textAlign: 'right' }}>
                              {row.fuel ? '₹' + row.fuel.toLocaleString('en-IN') : '—'}
                            </td>
                            <td style={{ padding: '7px 10px', color: row.da ? '#38bdf8' : '#334155', textAlign: 'right' }}>
                              {row.da ? '₹' + row.da.toLocaleString('en-IN') : '—'}
                            </td>
                            <td style={{ padding: '7px 10px', color: row.driver_debit ? '#f87171' : '#334155', textAlign: 'right' }}>
                              {row.driver_debit ? '₹' + row.driver_debit.toLocaleString('en-IN') : '—'}
                            </td>
                            <td style={{ padding: '7px 10px', color: row.other ? '#94a3b8' : '#334155', textAlign: 'right' }}>
                              {row.other ? '₹' + row.other.toLocaleString('en-IN') : '—'}
                            </td>
                            <td style={{ padding: '7px 10px', color: hasExp ? '#e879f9' : '#334155', fontWeight: 700, textAlign: 'right' }}>
                              {hasExp ? '₹' + row.total_expense.toLocaleString('en-IN') : '—'}
                            </td>
                            <td style={{ padding: '7px 10px', color: '#475569', fontSize: 10 }}>
                              {lines.length ? (expExpanded[row.group_key] ? '▲' : '▼') : ''}
                            </td>
                          </tr>
                          {expExpanded[row.group_key] && lines.length > 0 && (
                            <tr>
                              <td colSpan={expGroupBy !== 'munshi' ? 12 : 11} style={{ padding: 0, background: '#0c1222' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                  <thead>
                                    <tr style={{ background: '#1e293b', color: '#64748b', fontSize: 10 }}>
                                      {['Date','Type','Vehicle','Amount','Desc'].map(h => (
                                        <th key={h} style={{ padding: '5px 12px', textAlign: 'left' }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {lines.map((l, li) => (
                                      <tr key={li} style={{ borderBottom: '1px solid #1e293b' }}>
                                        <td style={{ padding: '5px 12px', color: '#64748b' }}>{l.expense_date}</td>
                                        <td style={{ padding: '5px 12px' }}>
                                          <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                            background: l.expense_type === 'unloading' ? '#f9731622' : l.expense_type === 'fuel' ? '#fbbf2422' : l.expense_type === 'da' ? '#38bdf822' : '#94a3b822',
                                            color: l.expense_type === 'unloading' ? '#f97316' : l.expense_type === 'fuel' ? '#fbbf24' : l.expense_type === 'da' ? '#38bdf8' : '#94a3b8' }}>
                                            {l.expense_type}
                                          </span>
                                        </td>
                                        <td style={{ padding: '5px 12px', color: '#fbbf24', fontFamily: 'monospace' }}>{l.vehicle_number}</td>
                                        <td style={{ padding: '5px 12px', color: '#4ade80', fontWeight: 700 }}>₹{l.total_amount?.toLocaleString('en-IN')}</td>
                                        <td style={{ padding: '5px 12px', color: '#94a3b8', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.description}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!expLoading && expRows.length === 0 && (
              <div style={{ color: '#64748b', padding: 24, textAlign: 'center', background: '#1e293b', borderRadius: 10 }}>
                No expense data found. Run auto-assign first to link vehicles to EWBs.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
