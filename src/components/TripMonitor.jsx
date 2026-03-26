import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../utils/apiBase.js';

const API = `${API_BASE}/api`;

// ── Change this PIN to restrict admin access ──────────────────────────────
const ADMIN_PIN  = 'ATLOG';
const MUNSHI_PIN = 'MUNSHI';  // Change this to set munshi login PIN

// ── Status config ─────────────────────────────────────────────────────────
const STATUS_CFG = {
  started:    { label: 'Dispatched', color: '#2563eb', bg: '#dbeafe', next: 'in_transit', nextLabel: '🚀 En Route'  },
  in_transit: { label: 'En Route',   color: '#d97706', bg: '#fef3c7', next: 'unloading',  nextLabel: '📦 Unloading' },
  unloading:  { label: 'Unloading',  color: '#7c3aed', bg: '#ede9fe', next: 'completed',  nextLabel: '✅ Complete'  },
  completed:  { label: 'Completed',  color: '#16a34a', bg: '#dcfce7', next: null,          nextLabel: null           },
  cancelled:  { label: 'Cancelled',  color: '#dc2626', bg: '#fee2e2', next: null,          nextLabel: null           },
};

// Stop status colours
const STOP_STATUS_CFG = {
  pending:    { label: '⏳ Pending',    bg: '#f1f5f9', color: '#64748b' },
  arrived:    { label: '📍 Arrived',    bg: '#dbeafe', color: '#1d4ed8' },
  unloading:  { label: '📦 Unloading',  bg: '#ede9fe', color: '#7c3aed' },
  departed:   { label: '✅ Departed',   bg: '#dcfce7', color: '#16a34a' },
  skipped:    { label: '⏭ Skipped',    bg: '#fef9c3', color: '#92400e' },
};

function parseMeta(notes) {
  if (!notes) return {};
  try { return typeof notes === 'string' ? JSON.parse(notes) : notes; }
  catch { return {}; }
}

function num(v) { return parseFloat(v) || 0; }

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

// Trip is fully frozen (completed / cancelled / return_pending) — only admin can unlock edit
function rowFrozen(status) {
  return status === 'completed' || status === 'cancelled' || status === 'return_pending';
}

// ── Stop Status Panel ─────────────────────────────────────────────────────
function StopStatusPanel({ jobCardNumber }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/trip-dispatches/${jobCardNumber}/stops`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [jobCardNumber]);

  if (loading) return <div style={{ padding: '6px 12px', fontSize: 11, color: '#94a3b8' }}>Loading stop status…</div>;
  if (!data || !data.stops || data.stops.length === 0) return (
    <div style={{ padding: '6px 12px', fontSize: 11, color: '#94a3b8' }}>No stop data. Stops are recorded when the trip is dispatched with POI coordinates.</div>
  );

  const veh = data.vehicle || {};
  return (
    <div style={{ padding: '8px 12px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
      {veh.speed != null && (
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
          🚗 {veh.vehicle_no} — {veh.speed > 2 ? `Moving @ ${veh.speed.toFixed(0)} km/h` : 'Stopped'} · GPS: {veh.gps_time ? new Date(veh.gps_time).toLocaleTimeString('en-IN') : '?'}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {data.stops.map((s, i) => {
          const cfg = STOP_STATUS_CFG[s.stop_status] || STOP_STATUS_CFG.pending;
          const typeIcon = s.stop_type === 'from' ? '🏭' : s.stop_type === 'to' ? '🏁' : '📍';
          return (
            <div key={s.id || i} title={
              s.arrived_at ? `Arrived: ${new Date(s.arrived_at).toLocaleTimeString('en-IN')}` +
              (s.departed_at ? `\nDeparted: ${new Date(s.departed_at).toLocaleTimeString('en-IN')}` : '') +
              (s.dwell_minutes != null ? `\nDwell: ${s.dwell_minutes} min` : '') : ''
            } style={{ background: cfg.bg, color: cfg.color, borderRadius: 8, padding: '4px 9px', fontSize: 11, fontWeight: 600, border: `1px solid ${cfg.color}33`, display: 'flex', flexDirection: 'column', minWidth: 120 }}>
              <span style={{ fontSize: 10, fontWeight: 700 }}>{typeIcon} {s.poi_name.split(',')[0]}</span>
              <span style={{ fontSize: 10, marginTop: 2 }}>{cfg.label}</span>
              {s.dwell_minutes != null && s.stop_status === 'departed' && (
                <span style={{ fontSize: 9, opacity: 0.8 }}>⏱ {s.dwell_minutes} min</span>
              )}
              {s.dist_km != null && s.stop_status === 'pending' && (
                <span style={{ fontSize: 9, opacity: 0.8 }}>📏 {s.dist_km} km away</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Extend Route Modal ─────────────────────────────────────────────────────
const TOLL_RATES = {
  expressway: { category_1_32ft_34ft: 7,   category_2_22ft_24ft: 4, category_3_small: 3 },
  highway:    { category_1_32ft_34ft: 5.5, category_2_22ft_24ft: 4, category_3_small: 3 },
  local:      { category_1_32ft_34ft: 0,   category_2_22ft_24ft: 0, category_3_small: 0 },
};

function detectRouteMode(meta) {
  const hw = meta.highway_name || '';
  if (/expressway/i.test(hw)) return 'expressway';
  if (meta.is_highway_route)  return 'highway';
  return 'local';
}

function ExtendRouteModal({ trip, meta, onClose, onExtended }) {
  const [pois,        setPois]        = useState([]);
  const [cities,      setCities]      = useState([]);
  const [selCity,     setSelCity]     = useState('');
  const [selPOIs,     setSelPOIs]     = useState([]); // [{poi_id, poi_name, lat, lon, radius, type, seq}]
  const [toPOI,       setToPOI]       = useState(null);
  const [extraKm,     setExtraKm]     = useState('');
  const [kmCalcing,   setKmCalcing]   = useState(false);
  const [kmSource,    setKmSource]    = useState(''); // 'osrm' | 'manual' | ''
  const [saving,      setSaving]      = useState(false);
  const [poiSearch,   setPoiSearch]   = useState('');

  const routeMode    = detectRouteMode(meta);
  const vehicleSize  = meta.vehicle_size || 'category_1_32ft_34ft';
  const tollRate     = TOLL_RATES[routeMode]?.[vehicleSize] ?? 0;
  const extraToll    = tollRate > 0 && parseFloat(extraKm) > 0
    ? Math.round(parseFloat(extraKm) * tollRate) : 0;

  const ROUTE_BADGE = {
    expressway: { bg: '#f5f3ff', color: '#5b21b6', text: '🚀 Expressway', border: '#7c3aed' },
    highway:    { bg: '#fffbeb', color: '#92400e', text: '🛣️ Highway',    border: '#f59e0b' },
    local:      { bg: '#eff6ff', color: '#1d4ed8', text: '🏙️ Local',      border: '#2563eb' },
  };
  const badge = ROUTE_BADGE[routeMode];

  useEffect(() => {
    fetch(`${API}/pois?clientId=CLIENT_001`)
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : [];
        setPois(arr);
        setCities([...new Set(arr.map(p => p.city).filter(Boolean))].sort());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API}/pois?clientId=CLIENT_001`)
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : [];
        setPois(arr);
        setCities([...new Set(arr.map(p => p.city).filter(Boolean))].sort());
      })
      .catch(() => {});
  }, []);

  const filteredPois = selCity
    ? pois.filter(p => p.city === selCity && (poiSearch ? p.poi_name.toLowerCase().includes(poiSearch.toLowerCase()) : true))
    : [];

  // Auto-calc extra KM via OSRM when new stops/TO are selected
  useEffect(() => {
    const newPoints = [...selPOIs, ...(toPOI ? [{ lat: toPOI.latitude, lon: toPOI.longitude }] : [])];
    if (newPoints.length === 0) { setKmSource(''); return; }

    // Starting point = original trip TO (or last existing waypoint if partial)
    // Try to find it in the loaded POIs list, else use meta coordinates if available
    const existingWps = (() => { try { return JSON.parse(meta.waypoints || '[]'); } catch { return []; } })();
    const lastStopName = existingWps.length > 0 ? existingWps[existingWps.length - 1] : meta.to_location;
    const originPOI = lastStopName ? pois.find(p => p.poi_name === lastStopName) : null;
    if (!originPOI) return; // can't calc without a known start

    const allPts = [
      [originPOI.longitude, originPOI.latitude],
      ...newPoints.map(p => [p.lon, p.lat]),
    ];
    const coordStr = allPts.map(c => `${c[0]},${c[1]}`).join(';');
    setKmCalcing(true);
    fetch(`https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=false`)
      .then(r => r.json())
      .then(d => {
        if (d.code === 'Ok' && d.routes?.[0]) {
          const km = (d.routes[0].distance / 1000).toFixed(1);
          setExtraKm(km);
          setKmSource('osrm');
        }
      })
      .catch(() => {})
      .finally(() => setKmCalcing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selPOIs, toPOI, pois]);

  async function save() {
    if (!toPOI && selPOIs.length === 0) return alert('Select at least one stop or the final TO.');
    setSaving(true);
    const existingSeq = 100; // start appended stops at high seq so they sort after existing
    const newStops = selPOIs.map((p, i) => ({ ...p, type: 'waypoint', seq: existingSeq + i }));
    if (toPOI) newStops.push({ poi_id: toPOI.id, poi_name: toPOI.poi_name, lat: toPOI.latitude, lon: toPOI.longitude, radius: toPOI.radius_meters || 1500, type: 'to', seq: existingSeq + selPOIs.length });
    try {
      const res = await fetch(`${API}/trip-dispatches/${trip.job_card_number}/extend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_stop_pois: newStops,
          new_to_location: toPOI ? toPOI.poi_name : '',
          extra_km: parseFloat(extraKm) || 0,
          extra_toll: extraToll,
        }),
      });
      const d = await res.json();
      if (d.success) {
        onExtended?.();
        onClose();
      } else {
        alert('Extend failed: ' + (d.error || 'unknown'));
      }
    } catch (e) {
      alert('Network error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  const inp = { width: '100%', padding: '7px 10px', fontSize: 13, border: '1.5px solid #e2e8f0', borderRadius: 6, boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.22)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 800, color: '#1e293b' }}>🔀 Extend Route</h3>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          {trip.job_card_number} · {meta.from_location || '?'} → <b style={{ color: '#d97706' }}>Add new stops / final destination</b>
        </div>

        {/* City picker */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>City</label>
          <select value={selCity} onChange={e => { setSelCity(e.target.value); setPoiSearch(''); }} style={inp}>
            <option value="">-- Select City --</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* POI search */}
        {selCity && (
          <input type="text" placeholder="Search POI…" value={poiSearch} onChange={e => setPoiSearch(e.target.value)}
            style={{ ...inp, marginBottom: 8 }} />
        )}

        {/* POI list */}
        {filteredPois.length > 0 && (
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 12 }}>
            {filteredPois.map(p => {
              const isWp  = selPOIs.some(s => s.poi_id === p.id && s.type !== 'to');
              const isTo  = toPOI?.id === p.id;
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid #f1f5f9', gap: 6, background: isTo ? '#fef3c7' : isWp ? '#dbeafe' : '#fff' }}>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{p.poi_name} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({p.city})</span></span>
                  <button onClick={() => setSelPOIs(prev => prev.some(s => s.poi_id === p.id) ? prev.filter(s => s.poi_id !== p.id) : [...prev, { poi_id: p.id, poi_name: p.poi_name, lat: p.latitude, lon: p.longitude, radius: p.radius_meters || 1500 }])}
                    style={{ padding: '2px 8px', fontSize: 11, borderRadius: 5, border: '1px solid #3b82f6', background: isWp ? '#3b82f6' : '#eff6ff', color: isWp ? '#fff' : '#3b82f6', cursor: 'pointer', fontWeight: 700 }}>
                    {isWp ? '✓ Stop' : '+ Stop'}
                  </button>
                  <button onClick={() => setToPOI(toPOI?.id === p.id ? null : p)}
                    style={{ padding: '2px 8px', fontSize: 11, borderRadius: 5, border: '1px solid #dc2626', background: isTo ? '#dc2626' : '#fef2f2', color: isTo ? '#fff' : '#dc2626', cursor: 'pointer', fontWeight: 700 }}>
                    {isTo ? '✓ Final TO' : 'Set TO'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected summary */}
        {(selPOIs.length > 0 || toPOI) && (
          <div style={{ background: '#f8fafc', borderRadius: 7, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>
            {selPOIs.length > 0 && <div style={{ color: '#1d4ed8', marginBottom: 3 }}>➕ {selPOIs.length} new stop{selPOIs.length > 1 ? 's' : ''}: {selPOIs.map(s => s.poi_name.split(',')[0]).join(', ')}</div>}
            {toPOI && <div style={{ color: '#dc2626' }}>🏁 Final TO: <b>{toPOI.poi_name}</b></div>}
          </div>
        )}

        {/* Route mode badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Route Type:</span>
          <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, padding: '3px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
            {badge.text}
          </span>
          {tollRate > 0 && (
            <span style={{ fontSize: 11, color: '#64748b' }}>₹{tollRate}/km toll</span>
          )}
        </div>

        {/* Extra KM */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Additional KM</label>
            {kmCalcing && <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>⏳ Calculating…</span>}
            {!kmCalcing && kmSource === 'osrm' && extraKm && (
              <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>🗺 Auto via OSRM</span>
            )}
            {!kmCalcing && kmSource === 'manual' && (
              <span style={{ fontSize: 11, color: '#64748b' }}>✏️ Manual</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="number" min="0" step="0.1" placeholder="0"
              value={extraKm}
              onChange={e => { setExtraKm(e.target.value); setKmSource('manual'); }}
              style={{ ...inp, width: 140, fontWeight: 700, fontSize: 14, border: `1.5px solid ${kmSource === 'osrm' ? '#16a34a' : '#e2e8f0'}` }} />
            {extraToll > 0 && (
              <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                🚧 Toll: ₹{extraToll.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          {kmSource === 'osrm' && extraKm && (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
              Calculated from last stop → new stops. Edit above to override.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={save} disabled={saving || (selPOIs.length === 0 && !toPOI)}
            style={{ flex: 1, padding: '10px 0', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: saving || (selPOIs.length === 0 && !toPOI) ? 0.6 : 1 }}>
            {saving ? '⏳ Saving…' : '🔀 Extend Route'}
          </button>
          <button onClick={onClose} disabled={saving}
            style={{ padding: '10px 18px', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline editable cell ──────────────────────────────────────────────────
function Cell({ value, onChange, locked, type = 'text', align = 'left', placeholder = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');

  function start() {
    if (locked) return;
    setDraft(String(value ?? ''));
    setEditing(true);
  }
  function commit() {
    setEditing(false);
    if (!onChange) return;
    const v = type === 'number'
      ? (draft.trim() === '' ? '' : parseFloat(draft.trim()))
      : draft.trim();
    if (String(v) !== String(value ?? '')) onChange(v);
  }

  const display = (() => {
    if (value === '' || value == null) return null;
    if (type === 'number') {
      const n = parseFloat(value);
      return isNaN(n) || n === 0 ? null : n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    }
    return String(value);
  })();

  if (editing) {
    return (
      <input
        type={type} autoFocus value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        style={{
          width: '100%', padding: '2px 5px', fontSize: 12,
          border: '2px solid #3b82f6', borderRadius: 4, outline: 'none',
          background: '#eff6ff', textAlign: align, boxSizing: 'border-box',
        }}
      />
    );
  }

  return (
    <div
      onClick={start}
      title={locked ? '🔒 Locked' : 'Click to edit'}
      style={{
        minHeight: 22, padding: '2px 5px', borderRadius: 4, textAlign: align,
        fontSize: 12, cursor: locked ? 'default' : 'pointer',
        color: display ? '#1e293b' : '#cbd5e1',
        border: '1px dashed transparent', transition: 'all 0.1s',
      }}
      onMouseEnter={e => { if (!locked) { e.currentTarget.style.borderColor = '#93c5fd'; e.currentTarget.style.background = '#f0f9ff'; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
    >
      {display ?? <span style={{ color: '#cbd5e1', fontSize: 11 }}>{placeholder || '—'}</span>}
    </div>
  );
}

// ── One trip row (1 route = 1 row) ───────────────────────────────────────
function TripRow({ trip, rowNum, isAdmin, isMunshi, onStatusChange, onRowSaved, onRowDeleted, onTripExtended }) {
  const meta = parseMeta(trip.notes);
  const cfg  = STATUS_CFG[trip.status] || STATUS_CFG.started;

  // Fully frozen for non-admin when completed / cancelled
  const frozen = rowFrozen(trip.status) && !isAdmin;
  // Route (FROM/TO) always locked for non-admin — confirmed on dispatch
  const routeLocked = !isAdmin;

  const isPartial = meta.is_partial === true || trip.is_partial === 1;
  const [showStops,  setShowStops]  = useState(false);
  const [showExtend, setShowExtend] = useState(false);

  const routeIdStr = String(trip.route_id || '');
  const fromLabel  = meta.from_location || routeIdStr.split('→')[0]?.trim() || '—';
  const toLabel    = meta.to_location   || routeIdStr.split('→')[1]?.trim() || '—';
  const waypoints  = (() => { try { return JSON.parse(meta.waypoints || '[]'); } catch { return []; } })();

  const [edits, setEdits] = useState({
    vehicle_number:    trip.vehicle_number || '',
    driver_name:       trip.driver_name    || '',
    actual_km:         trip.actual_km_run  != null ? String(trip.actual_km_run) : '',
    fuel_cost:         num(meta.fuel_cost) > 0           ? String(num(meta.fuel_cost))           : '',
    unloading_charges: num(meta.unloading_charges) > 0   ? String(num(meta.unloading_charges))   : '',
    toll_charges:      num(meta.toll_charges) > 0         ? String(num(meta.toll_charges))         : '',
    other_charges:     num(meta.other_charges) > 0        ? String(num(meta.other_charges))        : '',
    driver_debit:      num(meta.driver_debit) > 0         ? String(num(meta.driver_debit))         : '',
    munshi_debit:      num(meta.munshi_debit) > 0         ? String(num(meta.munshi_debit))         : '',
    op_notes:          meta.op_notes || '',
  });
  const [dirty,          setDirty]          = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [advancing,      setAdvancing]      = useState(false);
  const [showEnRouteMdl, setShowEnRouteMdl] = useState(false);
  const [deleting,       setDeleting]       = useState(false);

  // Resync edits when trip data is refreshed (e.g. after route extension recalculates fuel)
  // Only sync if the row has no unsaved edits so we don't overwrite user input
  useEffect(() => {
    if (dirty) return;
    const m = parseMeta(trip.notes);
    setEdits({
      vehicle_number:    trip.vehicle_number || '',
      driver_name:       trip.driver_name    || '',
      actual_km:         trip.actual_km_run  != null ? String(trip.actual_km_run) : '',
      fuel_cost:         num(m.fuel_cost) > 0           ? String(num(m.fuel_cost))           : '',
      unloading_charges: num(m.unloading_charges) > 0   ? String(num(m.unloading_charges))   : '',
      toll_charges:      num(m.toll_charges) > 0         ? String(num(m.toll_charges))         : '',
      other_charges:     num(m.other_charges) > 0        ? String(num(m.other_charges))        : '',
      driver_debit:      num(m.driver_debit) > 0         ? String(num(m.driver_debit))         : '',
      munshi_debit:      num(m.munshi_debit) > 0         ? String(num(m.munshi_debit))         : '',
      op_notes:          m.op_notes || '',
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.notes, trip.vehicle_number, trip.driver_name, trip.actual_km_run]);

  async function deleteRow() {
    const confirmed = window.confirm(
      `⚠️ DELETE this trip?\n\n${trip.job_card_number}\n${meta.from_location || ''} → ${meta.to_location || ''}\nVehicle: ${trip.vehicle_number || '—'}\n\nThis cannot be undone.`
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/trip-dispatches/${trip.job_card_number}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) onRowDeleted?.(trip.id);
      else alert('Delete failed: ' + (d.error || 'unknown'));
    } catch (e) { alert('Network error: ' + e.message); }
    finally { setDeleting(false); }
  }

  function setE(key, val) {
    setEdits(p => {
      const next = { ...p, [key]: val };
      // Auto-recalculate fuel cost when actual KM is entered
      if (key === 'actual_km') {
        const km   = parseFloat(val) || 0;
        const kmpl = parseFloat(meta.kmpl) || 0;
        const rate = parseFloat(meta.fuel_cost_per_liter) || 0;
        if (km > 0 && kmpl > 0 && rate > 0) {
          next.fuel_cost = String(Math.round((km / kmpl) * rate));
        }
      }
      return next;
    });
    setDirty(true);
  }

  const total = num(edits.fuel_cost) + num(edits.unloading_charges) + num(edits.toll_charges) + num(edits.other_charges);

  async function saveRow() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/trip-dispatches/${trip.job_card_number}/patch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...edits }),
      });
      const d = await res.json();
      if (d.success) {
        setDirty(false);
        onRowSaved?.(trip.id, edits, d.total_expense ?? total);
      } else {
        alert('Save failed: ' + (d.error || 'unknown'));
      }
    } catch (e) {
      alert('Network error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function advance() {
    if (!cfg.next) return;
    setAdvancing(true);
    try {
      const body = { status: cfg.next };
      if (cfg.next === 'completed') body.actual_km = parseFloat(edits.actual_km) || null;
      const res = await fetch(`${API}/trip-dispatches/${trip.job_card_number}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success) onStatusChange(trip.id, cfg.next);
      else alert('Failed: ' + (d.error || 'unknown'));
    } catch (e) { alert(e.message); }
    finally { setAdvancing(false); }
  }

  // En Route with optional Driver/Munshi debit + expense pre-fill
  async function advanceToEnRoute(driverDebit, munshiDebit, petrol, unloading, toll, other) {
    setAdvancing(true);
    try {
      const patch = {};
      if (driverDebit > 0)  patch.driver_debit       = driverDebit;
      if (munshiDebit > 0) patch.munshi_debit        = munshiDebit;
      if (petrol > 0)      patch.fuel_cost           = petrol;
      if (unloading > 0)   patch.unloading_charges   = unloading;
      if (toll > 0)        patch.toll_charges        = toll;
      if (other > 0)       patch.other_charges       = other;
      if (Object.keys(patch).length > 0) {
        await fetch(`${API}/trip-dispatches/${trip.job_card_number}/patch`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        setEdits(p => ({
          ...p,
          ...(driverDebit > 0  ? { driver_debit:       String(driverDebit)   } : {}),
          ...(munshiDebit > 0  ? { munshi_debit:        String(munshiDebit)   } : {}),
          ...(petrol > 0       ? { fuel_cost:           String(petrol)        } : {}),
          ...(unloading > 0    ? { unloading_charges:   String(unloading)     } : {}),
          ...(toll > 0         ? { toll_charges:        String(toll)          } : {}),
          ...(other > 0        ? { other_charges:       String(other)         } : {}),
        }));
      }
      const res = await fetch(`${API}/trip-dispatches/${trip.job_card_number}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_transit' }),
      });
      const d = await res.json();
      if (d.success) onStatusChange(trip.id, 'in_transit');
      else alert('Failed: ' + (d.error || 'unknown'));
    } catch (e) { alert('Network error: ' + e.message); }
    finally { setAdvancing(false); }
  }

  const td = { padding: '5px 8px', borderBottom: '1px solid #f0f4f8', verticalAlign: 'middle', whiteSpace: 'nowrap' };

  return (
  <>
    <tr style={{ background: dirty ? '#fefce8' : (rowNum % 2 === 0 ? '#fff' : '#f8fafc') }}>
      {/* # */}
      <td style={{ ...td, textAlign: 'center', color: '#94a3b8', fontSize: 11, width: 28 }}>{rowNum}</td>

      {/* Date */}
      <td style={{ ...td, fontSize: 11, color: '#64748b', width: 74 }}>{fmtDate(trip.job_card_date)}</td>

      {/* Trip ID + Munshi */}
      <td style={{ ...td, width: 148 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#475569', lineHeight: 1.3 }}>{trip.job_card_number}</div>
        {meta.munshi_name && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>👤 {meta.munshi_name}</div>}
      </td>

      {/* Status */}
      <td style={{ ...td, width: 90 }}>
        <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700, display: 'inline-block' }}>
          {cfg.label}
        </span>
        {isPartial && (
          <div style={{ marginTop: 3 }}>
            <span style={{ background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>⏳ Half-Route</span>
          </div>
        )}
      </td>

      {/* Route — locked for non-admin; confirmed on dispatch */}
      <td style={{ ...td, width: 205 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'flex-start', gap: 3 }}>
          <span title={routeLocked ? 'Route locked — admin only' : 'Admin: route editable'} style={{ flexShrink: 0, marginTop: 1 }}>
            {routeLocked ? '🔒' : '🔓'}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 182 }} title={`${fromLabel} → ${toLabel}`}>
            {fromLabel.split(',')[0]} → {toLabel.split(',')[0]}
          </span>
        </div>
        {waypoints.length > 0 && (
          <div style={{ fontSize: 10, color: '#94a3b8', paddingLeft: 17, marginTop: 1 }}>
            via {waypoints.slice(0, 2).join(' → ')}{waypoints.length > 2 ? ` +${waypoints.length - 2}` : ''}
          </div>
        )}
      </td>

      {/* Vehicle No */}
      <td style={{ ...td, width: 94 }}>
        <Cell value={edits.vehicle_number} onChange={v => setE('vehicle_number', v)} locked={frozen} placeholder="VH-0000" />
      </td>

      {/* Size */}
      <td style={{ ...td, width: 68, textAlign: 'center' }}>
        {meta.vehicle_size ? (
          <span style={{
            fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 6px',
            background: meta.vehicle_size === 'category_1_32ft_34ft' ? '#dbeafe' : meta.vehicle_size === 'category_2_22ft_24ft' ? '#fef9c3' : '#f0fdf4',
            color:      meta.vehicle_size === 'category_1_32ft_34ft' ? '#1d4ed8' : meta.vehicle_size === 'category_2_22ft_24ft' ? '#92400e' : '#15803d',
            whiteSpace: 'nowrap',
          }}>
            {meta.vehicle_size === 'category_1_32ft_34ft' ? '32/34 FT' : meta.vehicle_size === 'category_2_22ft_24ft' ? '22/24 FT' : 'Small'}
          </span>
        ) : <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>}
      </td>

      {/* Driver */}
      <td style={{ ...td, width: 124 }}>
        <Cell value={edits.driver_name} onChange={v => setE('driver_name', v)} locked={frozen} placeholder="Driver" />
      </td>

      {/* Driver Advance ₹ — anyone (munshi) can fill this */}
      <td style={{ ...td, width: 90, background: dirty ? '#fef9c3' : '#eff6ff' }}>
        <Cell value={edits.driver_debit} onChange={v => setE('driver_debit', v)} locked={rowFrozen(trip.status) ? !isAdmin : (!isAdmin && !isMunshi)} type="number" align="right" placeholder={isAdmin || isMunshi ? 'Enter ₹' : '🔒'} />
      </td>

      {/* Munshi Advance ₹ */}
      <td style={{ ...td, width: 90 }}>
        <Cell value={edits.munshi_debit} onChange={v => setE('munshi_debit', v)} locked={rowFrozen(trip.status) ? !isAdmin : (!isAdmin && !isMunshi)} type="number" align="right" placeholder={isAdmin || isMunshi ? '₹' : '🔒'} />
      </td>

      {/* Planned KM (read-only from wizard) */}
      <td style={{ ...td, width: 62, textAlign: 'right', fontSize: 12, color: '#64748b' }}>
        {meta.route_km ? parseFloat(meta.route_km).toFixed(0) : '—'}
      </td>

      {/* Actual KM */}
      <td style={{ ...td, width: 72 }}>
        <Cell value={edits.actual_km} onChange={v => setE('actual_km', v)} locked={frozen} type="number" align="right" placeholder="0" />
      </td>

      {/* Petrol ₹ */}
      <td style={{ ...td, width: 82 }}>
        <Cell value={edits.fuel_cost} onChange={v => setE('fuel_cost', v)} locked={frozen} type="number" align="right" placeholder="0" />
      </td>

      {/* Unloading ₹ */}
      <td style={{ ...td, width: 90 }}>
        <Cell value={edits.unloading_charges} onChange={v => setE('unloading_charges', v)} locked={frozen} type="number" align="right" placeholder="0" />
      </td>

      {/* Toll ₹ */}
      <td style={{ ...td, width: 72 }}>
        <Cell value={edits.toll_charges} onChange={v => setE('toll_charges', v)} locked={frozen} type="number" align="right" placeholder="0" />
      </td>

      {/* Other ₹ */}
      <td style={{ ...td, width: 72 }}>
        <Cell value={edits.other_charges} onChange={v => setE('other_charges', v)} locked={frozen} type="number" align="right" placeholder="0" />
      </td>

      {/* Total ₹ — computed live */}
      <td style={{ ...td, width: 90, textAlign: 'right', fontWeight: 700, color: '#0066cc', fontSize: 13 }}>
        {total > 0 ? '₹' + total.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—'}
      </td>

      {/* Op Notes */}
      <td style={{ ...td, minWidth: 120 }}>
        <Cell value={edits.op_notes} onChange={v => setE('op_notes', v)} locked={frozen} placeholder="Notes…" align="left" />
      </td>

      {/* Actions */}
      <td style={{ ...td, minWidth: 155 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          {dirty && (
            <button onClick={saveRow} disabled={saving}
              style={{ padding: '3px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {saving ? '…' : '💾 Save'}
            </button>
          )}
          {!rowFrozen(trip.status) && cfg.next && (
            <button
              onClick={cfg.next === 'in_transit' ? () => setShowEnRouteMdl(true) : advance}
              disabled={advancing}
              style={{ padding: '3px 10px', background: cfg.color, color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {advancing ? '…' : cfg.nextLabel}
            </button>
          )}
          {/* Extend Route — visible for partial or in-transit trips */}
          {!rowFrozen(trip.status) && (isPartial || trip.status === 'in_transit' || trip.status === 'started') && (
            <button onClick={() => setShowExtend(true)}
              title="Add new stops or assign final destination"
              style={{ padding: '3px 10px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              🔀 Extend
            </button>
          )}
          {/* Live Stop Status toggle */}
          {!rowFrozen(trip.status) && (
            <button onClick={() => setShowStops(p => !p)}
              title="Show live loading/unloading status by GPS"
              style={{ padding: '3px 8px', background: showStops ? '#1e3a8a' : '#f1f5f9', color: showStops ? '#fff' : '#374151', border: '1px solid #e2e8f0', borderRadius: 5, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {showStops ? '▲ Stops' : '📡 Stops'}
            </button>
          )}
          {rowFrozen(trip.status) && (
            <span title={isAdmin ? 'Admin: editing unlocked' : 'Locked — admin access required'} style={{ fontSize: 15 }}>
              {isAdmin ? '🔓' : '🔒'}
            </span>
          )}
          {isAdmin && (
            <button onClick={deleteRow} disabled={deleting}
              title="Delete this trip (admin only)"
              style={{ padding: '3px 8px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 2 }}>
              {deleting ? '…' : '🗑️'}
            </button>
          )}
        </div>
      </td>
    </tr>
    {showEnRouteMdl && (
      <EnRouteModal
        trip={trip}
        meta={meta}
        onConfirm={async (driverDebit, munshiDebit, petrol, unloading, toll, other) => {
          setShowEnRouteMdl(false);
          await advanceToEnRoute(driverDebit, munshiDebit, petrol, unloading, toll, other);
        }}
        onClose={() => setShowEnRouteMdl(false)}
      />
    )}
    {/* Live stop status row */}
    {showStops && (
      <tr>
        <td colSpan={99} style={{ padding: 0, borderBottom: '2px solid #1e3a8a' }}>
          <StopStatusPanel jobCardNumber={trip.job_card_number} />
        </td>
      </tr>
    )}
    {/* Extend route modal */}
    {showExtend && (
      <ExtendRouteModal
        trip={trip}
        meta={meta}
        onClose={() => setShowExtend(false)}
        onExtended={() => onTripExtended?.(trip.id)}
      />
    )}
  </>
  );
}

// ── Admin PIN modal ───────────────────────────────────────────────────────
function AdminPinModal({
  onSuccess, onClose,
  pin: correctPin = ADMIN_PIN,
  title       = '🔐 Admin Access',
  description = 'Enter admin PIN to unlock editing of confirmed routes and completed trips.',
}) {
  const [entered, setEntered] = useState('');
  const [err,     setErr]     = useState('');

  function tryPin() {
    if (entered === correctPin) { onSuccess(); }
    else { setErr('Incorrect PIN. Try again.'); setEntered(''); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '28px 32px', minWidth: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 17, color: '#1e293b' }}>{title}</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>{description}</p>
        <input
          type="password" autoFocus value={entered}
          onChange={e => { setEntered(e.target.value); setErr(''); }}
          onKeyDown={e => e.key === 'Enter' && tryPin()}
          placeholder="PIN"
          autoComplete="new-password" name="access-pin"
          style={{ width: '100%', padding: '9px 12px', fontSize: 15, border: '2px solid #e2e8f0', borderRadius: 7, boxSizing: 'border-box', marginBottom: 8 }}
        />
        {err && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={tryPin}
            style={{ flex: 1, padding: 9, background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Unlock
          </button>
          <button onClick={onClose}
            style={{ padding: '9px 16px', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 14, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── En Route confirmation modal (captures Driver Debit + Munshi Debit) ────
function EnRouteModal({ trip, meta, onConfirm, onClose }) {
  const [driverDebit,  setDriverDebit]  = useState('');
  const [munshiDebit,  setMunshiDebit]  = useState('');
  const [busy,         setBusy]         = useState(false);

  async function confirm() {
    setBusy(true);
    await onConfirm(parseFloat(driverDebit) || 0, parseFloat(munshiDebit) || 0, 0, 0, 0, 0);
    setBusy(false);
  }

  const fromLabel = meta.from_location || '—';
  const toLabel   = meta.to_location   || '—';

  const inp = {
    width: '100%', padding: '8px 11px', fontSize: 14,
    border: '1.5px solid #e2e8f0', borderRadius: 7,
    boxSizing: 'border-box', outline: 'none',
  };
  const lbl = { fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', minWidth: 340, maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>🚀</span>
          <h3 style={{ margin: 0, fontSize: 17, color: '#1e293b', fontWeight: 800 }}>Mark Trip En Route</h3>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 18, paddingLeft: 32 }}>
          <b style={{ color: '#1e3a8a' }}>{fromLabel.split(',')[0]}</b> → <b style={{ color: '#1e3a8a' }}>{toLabel.split(',')[0]}</b>
          <br />{trip.job_card_number} · {trip.vehicle_number || '—'} · {trip.driver_name || '—'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={lbl}>💸 Driver Advance (₹)</label>
            <input type="number" min="0" step="1" value={driverDebit} onChange={e => setDriverDebit(e.target.value)} autoComplete="off" placeholder="0" style={inp} />
          </div>
          <div>
            <label style={lbl}>📋 Munshi Advance (₹)</label>
            <input type="number" min="0" step="1" value={munshiDebit} onChange={e => setMunshiDebit(e.target.value)} autoComplete="off" placeholder="0" style={inp} />
          </div>
        </div>

        <div style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', borderRadius: 6, padding: '7px 11px', marginBottom: 18 }}>
          ℹ️ Leave blank if no advance given. Expenses are auto-calculated from KM.
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={confirm} disabled={busy}
            style={{ flex: 1, padding: '10px 0', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? '⏳ Starting…' : '🚀 Confirm En Route'}
          </button>
          <button onClick={onClose} disabled={busy}
            style={{ padding: '10px 16px', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main TripMonitor ──────────────────────────────────────────────────────
// ── Munshi Login modal — pick name + enter PIN ────────────────────────────
function MunshiLoginModal({ munshiList, onSuccess, onClose }) {
  const [selId,  setSelId]  = useState('');
  const [pin,    setPin]    = useState('');
  const [err,    setErr]    = useState('');
  const [busy,   setBusy]   = useState(false);

  async function tryLogin() {
    if (!selId) { setErr('Please select your name.'); return; }
    if (!pin)   { setErr('Please enter your PIN.');   return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch(`${API}/munshis/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ munshi_id: selId, pin }),
      });
      const d = await res.json();
      if (d.success) {
        onSuccess(d.munshi);
      } else {
        setErr(d.error || 'Incorrect PIN. Try again.');
        setPin('');
      }
    } catch (e) {
      setErr('Login failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', minWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, color: '#1e293b' }}>👤 Munshi Login</h3>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#64748b' }}>Select your name and enter your PIN to see your trips.</p>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Your Name</label>
        <select
          value={selId}
          onChange={e => { setSelId(e.target.value); setErr(''); }}
          style={{ width: '100%', padding: '9px 10px', fontSize: 14, border: '2px solid #e2e8f0', borderRadius: 7, boxSizing: 'border-box', marginBottom: 14 }}>
          <option value="">— Select your name —</option>
          {munshiList.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>PIN</label>
        <input
          type="password" autoFocus value={pin}
          onChange={e => { setPin(e.target.value); setErr(''); }}
          onKeyDown={e => e.key === 'Enter' && tryLogin()}
          placeholder="Enter your PIN"
          autoComplete="new-password" name="munshi-pin"
          style={{ width: '100%', padding: '9px 12px', fontSize: 15, border: '2px solid #e2e8f0', borderRadius: 7, boxSizing: 'border-box', marginBottom: 8 }}
        />
        {err && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{err}</div>}

        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
          💡 After login you will only see your assigned trips.
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={tryLogin} disabled={busy}
            style={{ flex: 1, padding: 10, background: '#d97706', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 14, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? '⏳ Checking…' : '🔓 Login'}
          </button>
          <button onClick={onClose}
            style={{ padding: '10px 16px', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 14, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TripMonitor() {
  const [trips,        setTrips]        = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [search,       setSearch]       = useState('');
  const [refreshTs,    setRefreshTs]    = useState(Date.now());
  const [isAdmin,        setIsAdmin]        = useState(false);
  const [isMunshi,       setIsMunshi]       = useState(false);
  const [showPin,        setShowPin]        = useState(false);
  const [showMunshiPin,  setShowMunshiPin]  = useState(false);
  const [munshiFilter,   setMunshiFilter]   = useState('');   // '' = all, 'MUN001' = specific
  const [munshiList,     setMunshiList]     = useState([]);   // [{id, name}]
  const [loggedMunshi,   setLoggedMunshi]   = useState(null); // {id, name} when munshi logged in

  // Load munshi list once for dropdown
  useEffect(() => {
    fetch(`${API}/munshis`)
      .then(r => r.json())
      .then(d => setMunshiList(d.munshis || []))
      .catch(() => {});
  }, []);

  function handleMunshiLogin(munshi) {
    // munshi = {id, name} returned from /api/munshis/login
    setIsMunshi(true);
    setLoggedMunshi(munshi);
    setMunshiFilter(munshi.id);   // auto-lock to their trips
    setShowMunshiPin(false);
    setRefreshTs(Date.now());
  }

  function handleMunshiLogout() {
    setIsMunshi(false);
    setLoggedMunshi(null);
    setMunshiFilter('');
    setRefreshTs(Date.now());
  }

  const loadTrips = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const url = munshiFilter
        ? `${API}/trip-dispatches?munshiId=${encodeURIComponent(munshiFilter)}`
        : `${API}/trip-dispatches`;
      const res = await fetch(url);
      const d = await res.json();
      if (!res.ok) {
        setError('Could not load trips: ' + (d.error || res.statusText));
        return;
      }
      setTrips(d.trips || []);
    } catch (e) {
      setError('Could not load trips: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [munshiFilter]);

  useEffect(() => { loadTrips(); }, [loadTrips, refreshTs, munshiFilter]);

  useEffect(() => {
    // Always auto-refresh so newly dispatched trips appear without manual refresh
    const timer = setInterval(() => setRefreshTs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  function handleStatusChange(id, newStatus) {
    setTrips(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
  }

  function handleRowSaved(id, edits, newTotal) {
    setTrips(prev => prev.map(t => t.id === id ? {
      ...t,
      vehicle_number: edits.vehicle_number,
      driver_name:    edits.driver_name,
      actual_km_run:  parseFloat(edits.actual_km) || null,
      total_expense:  newTotal,
    } : t));
  }

  function handleRowDeleted(id) {
    setTrips(prev => prev.filter(t => t.id !== id));
  }

  const filtered = trips.filter(t => {
    const matchStatus =
      filterStatus === 'all'       ? true :
      filterStatus === 'active'    ? !rowFrozen(t.status) :
      filterStatus === 'completed' ? t.status === 'completed' :
      t.status === filterStatus;
    if (!matchStatus) return false;
    // Local munshi guard (belt-and-suspenders on top of API filter)
    if (munshiFilter) {
      const meta = parseMeta(t.notes);
      if ((meta.munshi_id || t.munshi_id || '') !== munshiFilter) return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const meta = parseMeta(t.notes);
    return (
      (t.job_card_number  || '').toLowerCase().includes(q) ||
      (t.vehicle_number   || '').toLowerCase().includes(q) ||
      (t.driver_name      || '').toLowerCase().includes(q) ||
      (meta.munshi_name   || '').toLowerCase().includes(q) ||
      (meta.from_location || '').toLowerCase().includes(q) ||
      (meta.to_location   || '').toLowerCase().includes(q)
    );
  });

  const counts = {
    active:    trips.filter(t => !rowFrozen(t.status)).length,
    completed: trips.filter(t => t.status === 'completed').length,
    all:       trips.length,
  };

  const TH = ({ children, style = {} }) => (
    <th style={{
      padding: '8px 8px', background: '#1e3a8a', color: '#fff',
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'left',
      position: 'sticky', top: 0, zIndex: 2,
      ...style,
    }}>
      {children}
    </th>
  );

  return (
    <div style={{ padding: '8px 16px' }}>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        {[
          { key: 'active',    label: `🟡 Active (${counts.active})`    },
          { key: 'completed', label: `✅ Done (${counts.completed})`    },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilterStatus(key)}
            style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filterStatus === key ? '#1e3a8a' : '#f1f5f9',
              color:      filterStatus === key ? '#fff' : '#374151',
              border:    `2px solid ${filterStatus === key ? '#1e3a8a' : '#e2e8f0'}`,
            }}>
            {label}
          </button>
        ))}
        {/* All tab — admin only */}
        {isAdmin && (
          <button onClick={() => setFilterStatus('all')}
            style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filterStatus === 'all' ? '#374151' : '#f1f5f9',
              color:      filterStatus === 'all' ? '#fff' : '#374151',
              border:    `2px solid ${filterStatus === 'all' ? '#374151' : '#e2e8f0'}`,
            }}>
            📋 All ({counts.all})
          </button>
        )}

        <input
          type="text" placeholder="Search vehicle, driver, route…"
          value={search} onChange={e => setSearch(e.target.value)}
          autoComplete="off" name="trip-search"
          style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, width: 210 }}
        />

        {/* Munshi filter dropdown — locked when a munshi is logged in */}
        {!loggedMunshi ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <select
              value={munshiFilter}
              onChange={e => { setMunshiFilter(e.target.value); setRefreshTs(Date.now()); }}
              style={{
                padding: '5px 10px', fontSize: 12, borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${munshiFilter ? '#d97706' : '#e2e8f0'}`,
                background: munshiFilter ? '#fef3c7' : '#fff',
                color: munshiFilter ? '#92400e' : '#374151',
                fontWeight: munshiFilter ? 700 : 400,
              }}>
              <option value=''>👤 All Munshi</option>
              {munshiList.map(m => (
                <option key={m.id} value={m.id}>👤 {m.name}</option>
              ))}
            </select>
            {munshiFilter && (
              <button
                onClick={() => { setMunshiFilter(''); setRefreshTs(Date.now()); }}
                title="Clear munshi filter"
                style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid #fbbf24', background: '#fef3c7', color: '#92400e', cursor: 'pointer', fontWeight: 700 }}>
                ✕
              </button>
            )}
          </div>
        ) : null}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {loggedMunshi && !isAdmin && (
            <span style={{ fontSize: 12, color: '#92400e', fontWeight: 700, background: '#fef3c7', borderRadius: 20, padding: '4px 12px', border: '1px solid #fbbf24' }}>
              👤 {loggedMunshi.name} — My Trips Only
            </span>
          )}
          {isAdmin && (
            <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, background: '#dcfce7', borderRadius: 20, padding: '4px 12px' }}>
              🔓 Admin Mode ON
            </span>
          )}
          <button
            onClick={() => loggedMunshi ? handleMunshiLogout() : setShowMunshiPin(true)}
            style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: loggedMunshi ? '#fef3c7' : '#fff',
              color:      loggedMunshi ? '#d97706' : '#374151',
              border:    `1px solid ${loggedMunshi ? '#fbbf24' : '#e2e8f0'}`,
            }}>
            {loggedMunshi ? `🔒 Logout (${loggedMunshi.name})` : '👤 Munshi Login'}
          </button>
          <button
            onClick={() => isAdmin ? setIsAdmin(false) : setShowPin(true)}
            style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: isAdmin ? '#fee2e2' : '#fff',
              color:      isAdmin ? '#dc2626' : '#374151',
              border:    `1px solid ${isAdmin ? '#fca5a5' : '#e2e8f0'}`,
            }}>
            {isAdmin ? '🔒 Lock Admin' : '🔐 Admin Mode'}
          </button>
          <button onClick={() => setRefreshTs(Date.now())}
            style={{ padding: '5px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
            {loading ? '⏳' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* ── Help strip ── */}
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, background: '#f8fafc', borderRadius: 6, padding: '5px 12px', display: 'inline-flex', gap: 20, flexWrap: 'wrap' }}>
        <span>🔒 Route locked after dispatch — Admin Mode to change</span>
        <span>💡 Click any cell to edit (advance, expenses, driver, KM) · Enter to confirm</span>
        <span>💙 Blue col = Driver Advance given</span>
        <span>🟡 Yellow row = unsaved</span>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ padding: '8px 14px', background: '#fee2e2', color: '#dc2626', borderRadius: 8, marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: 14 }}>
          {filterStatus === 'active' ? 'No active trips right now.' : 'No trips found.'}
          <br /><span style={{ fontSize: 12 }}>Use 🚚 Trip Dispatch to create a new trip.</span>
        </div>
      )}

      {/* ── Net Settlement Summary ── */}
      {filtered.length > 0 && (() => {
        const sumDrvAdv  = filtered.reduce((s, t) => s + (num(parseMeta(t.notes).driver_debit)  || 0), 0);
        const sumMnshAdv = filtered.reduce((s, t) => s + (num(parseMeta(t.notes).munshi_debit) || 0), 0);
        const sumAdv     = sumDrvAdv + sumMnshAdv;
        const sumExp     = filtered.reduce((s, t) => s + (parseFloat(t.total_expense) || 0), 0);
        const netSet     = sumAdv - sumExp;
        const pill = (label, val, bg, fg = '#fff') => (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: bg, color: fg, borderRadius: 7, padding: '4px 10px', minWidth: 90, gap: 1 }}>
            <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.85, letterSpacing: 0.4 }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>₹{Math.abs(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        );
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', marginBottom: 8, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>📊 {filtered.length} Trip{filtered.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ width: 1, height: 28, background: '#e2e8f0', margin: '0 2px' }} />
            {pill('Drv Advance', sumDrvAdv, '#1d4ed8')}
            {pill('Mnsh Advance', sumMnshAdv, '#7c3aed')}
            {pill('Total Advance', sumAdv, '#0f172a')}
            <div style={{ width: 1, height: 28, background: '#e2e8f0', margin: '0 2px' }} />
            {pill('Total Expenses', sumExp, '#dc2626')}
            <div style={{ width: 1, height: 28, background: '#e2e8f0', margin: '0 2px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: netSet >= 0 ? '#dcfce7' : '#fef2f2', color: netSet >= 0 ? '#15803d' : '#dc2626', borderRadius: 7, padding: '4px 10px', minWidth: 110, border: `1.5px solid ${netSet >= 0 ? '#86efac' : '#fca5a5'}`, gap: 1 }}>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.4 }}>NET SETTLEMENT</span>
              <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>{netSet >= 0 ? '+' : '-'}₹{Math.abs(netSet).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              <span style={{ fontSize: 8, opacity: 0.75 }}>{netSet >= 0 ? 'Driver Owes Back' : 'Co. Owes Driver'}</span>
            </div>
          </div>
        );
      })()}

      {/* ── Table ── */}
      {filtered.length > 0 && (
        <div style={{ overflowX: 'auto', borderRadius: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', maxHeight: 'calc(100vh - 210px)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1600 }}>
            <thead>
              <tr>
                <TH style={{ width: 28,  textAlign: 'center' }}>#</TH>
                <TH style={{ width: 74                       }}>Date</TH>
                <TH style={{ width: 148                      }}>Trip ID / Munshi</TH>
                <TH style={{ width: 90                       }}>Status</TH>
                <TH style={{ width: 205                      }}>Route 🔒</TH>
                <TH style={{ width: 94                       }}>Vehicle No</TH>
                <TH style={{ width: 68                       }}>Size</TH>
                <TH style={{ width: 124                      }}>Driver</TH>
                <TH style={{ width: 90,  textAlign: 'right', background: '#1d4ed8' }}>Drv Advance ₹</TH>
                <TH style={{ width: 90,  textAlign: 'right' }}>Mnsh Adv ₹</TH>
                <TH style={{ width: 62,  textAlign: 'right' }}>Plan KM</TH>
                <TH style={{ width: 72,  textAlign: 'right' }}>Act KM</TH>
                <TH style={{ width: 82,  textAlign: 'right' }}>Petrol ₹</TH>
                <TH style={{ width: 90,  textAlign: 'right' }}>Unload ₹</TH>
                <TH style={{ width: 72,  textAlign: 'right' }}>Toll ₹</TH>
                <TH style={{ width: 72,  textAlign: 'right' }}>Other ₹</TH>
                <TH style={{ width: 90,  textAlign: 'right' }}>Total ₹</TH>
                <TH style={{ minWidth: 116                   }}>Notes</TH>
                <TH style={{ minWidth: 155                   }}>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {filtered.map((trip, idx) => (
                <TripRow
                  key={trip.id}
                  trip={trip}
                  rowNum={idx + 1}
                  isAdmin={isAdmin}
                  isMunshi={isMunshi}
                  onStatusChange={handleStatusChange}
                  onRowSaved={handleRowSaved}
                  onRowDeleted={handleRowDeleted}
                  onTripExtended={() => setRefreshTs(Date.now())}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Status legend ── */}
      {filtered.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, alignItems: 'center' }}>
          {Object.entries(STATUS_CFG).map(([k, v]) => (
            <span key={k} style={{ background: v.bg, color: v.color, borderRadius: 10, padding: '2px 9px', fontWeight: 700 }}>{v.label}</span>
          ))}
        </div>
      )}

      {/* ── Admin PIN modal ── */}
      {showPin && (
        <AdminPinModal
          onSuccess={() => { setIsAdmin(true); setShowPin(false); setSearch(''); }}
          onClose={() => setShowPin(false)}
        />
      )}

      {/* ── Munshi Login modal ── */}
      {showMunshiPin && (
        <MunshiLoginModal
          munshiList={munshiList}
          onSuccess={handleMunshiLogin}
          onClose={() => setShowMunshiPin(false)}
        />
      )}
    </div>
  );
}
