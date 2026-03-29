import { useState, useEffect, useCallback, useRef } from 'react';

const API = '/api';

function num(v) { return parseFloat(v) || 0; }
function fmt(v) {
  const n = num(v);
  if (n === 0) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}


// ─── PIN Login Screen ─────────────────────────────────────────────────────────
function PinLogin({ onLogin }) {
  const [pin, setPin]       = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleLogin() {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API}/munshis/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, client_id: 'CLIENT_001' }),
      });
      const data = await res.json();
      if (data.success && data.munshi) {
        onLogin(data.munshi);
      } else {
        setError('❌ Incorrect PIN. Try again.');
        setPin('');
        inputRef.current?.focus();
      }
    } catch (e) {
      setError('Network error. Please try again.');
    } finally { setLoading(false); }
  }

  function handleKey(e) { if (e.key === 'Enter') handleLogin(); }

  // PIN pad buttons
  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>👨‍💼</div>
        <div style={{ fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: '0.06em' }}>MUNSHI PORTAL</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>Atul Logistics — Enter your PIN</div>
      </div>

      {/* PIN display */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: '50%',
            background: i < pin.length ? '#3b82f6' : '#1e293b',
            border: `2px solid ${i < pin.length ? '#3b82f6' : '#334155'}`,
            transition: 'all 0.15s',
          }} />
        ))}
      </div>

      {/* Hidden input for keyboard support */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        value={pin}
        onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setPin(v); setError(''); }}
        onKeyDown={handleKey}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
      />

      {/* PIN pad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 10, marginBottom: 20 }}>
        {digits.map((d, i) => (
          <button
            key={i}
            onClick={() => {
              if (d === '⌫') { setPin(p => p.slice(0,-1)); setError(''); }
              else if (d !== '') { setPin(p => (p.length < 6 ? p + d : p)); setError(''); }
            }}
            style={{
              height: 72, borderRadius: 14,
              background: d === '' ? 'transparent' : d === '⌫' ? '#1e293b' : '#1e293b',
              border: d === '' ? 'none' : '1px solid #334155',
              color: d === '⌫' ? '#f87171' : '#f1f5f9',
              fontSize: d === '⌫' ? 22 : 24, fontWeight: 700,
              cursor: d === '' ? 'default' : 'pointer',
              transition: 'background 0.1s',
              visibility: d === '' ? 'hidden' : 'visible',
            }}
            onMouseDown={e => { if (d !== '') e.currentTarget.style.background = '#334155'; }}
            onMouseUp={e => { e.currentTarget.style.background = '#1e293b'; }}
          >{d}</button>
        ))}
      </div>

      {error && (
        <div style={{ color: '#f87171', fontSize: 13, fontWeight: 600, marginBottom: 14, textAlign: 'center' }}>{error}</div>
      )}

      <button
        onClick={handleLogin}
        disabled={loading || pin.length < 4}
        style={{
          width: '100%', maxWidth: 240, padding: '16px',
          background: pin.length >= 4 ? 'linear-gradient(135deg, #1d4ed8, #2563eb)' : '#1e293b',
          border: 'none', borderRadius: 14, color: '#fff',
          fontSize: 16, fontWeight: 800, cursor: pin.length >= 4 ? 'pointer' : 'not-allowed',
          boxShadow: pin.length >= 4 ? '0 4px 20px #2563eb55' : 'none',
          transition: 'all 0.2s',
        }}
      >
        {loading ? '⏳ Checking...' : '🔓 Login'}
      </button>
    </div>
  );
}

// ─── Routing Tab ────────────────────────────────────────────────────────────
const ROUTING_SIZE_PALETTE = [
  { bg: '#2563eb', border: '#1d4ed8' },
  { bg: '#7c3aed', border: '#6d28d9' },
  { bg: '#0891b2', border: '#0e7490' },
  { bg: '#059669', border: '#047857' },
  { bg: '#d97706', border: '#b45309' },
  { bg: '#dc2626', border: '#b91c1c' },
  { bg: '#db2777', border: '#be185d' },
  { bg: '#65a30d', border: '#4d7c0f' },
];
const _rscc = {}; let _rscIdx = 0;
function routingSizeColor(size) {
  if (!size) return ROUTING_SIZE_PALETTE[0];
  if (!_rscc[size]) { _rscc[size] = ROUTING_SIZE_PALETTE[_rscIdx % ROUTING_SIZE_PALETTE.length]; _rscIdx++; }
  return _rscc[size];
}

function RoutingTab({ munshi, vehicles, pois, onGoToTrip }) {
  const [routeVehicles, setRouteVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPois, setExpandedPois] = useState(new Set());
  const [activePoi, setActivePoi] = useState(null);
  const [activeVehicle, setActiveVehicle] = useState('');
  const [activeEwb, setActiveEwb] = useState('');
  const [poiEwbs, setPoiEwbs] = useState([]);
  const [ewbLoading, setEwbLoading] = useState(false);

  const myPoiIds = (() => { try { return JSON.parse(munshi.primary_poi_ids || '[]').map(String); } catch { return []; } })();
  const myPois = pois.filter(p => myPoiIds.includes(String(p.id)));
  const myPoiNames = new Set(myPois.map(p => p.poi_name));

  const fetchRoute = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/eway-bills-hub/vehicle-movement');
      const data = await res.json();
      setRouteVehicles(data.vehicles || []);
    } catch { setRouteVehicles([]); }
    setLoading(false);
  };

  useEffect(() => {
    fetchRoute();
    const t = setInterval(fetchRoute, 30000);
    return () => clearInterval(t);
  }, []);

  const fetchPoiEwbs = async (poiId) => {
    if (!poiId) { setPoiEwbs([]); return; }
    setEwbLoading(true);
    try {
      const res = await fetch(`${API}/munshi-trips/ewb-search?clientId=CLIENT_001&poi_ids=${poiId}`);
      const data = await res.json();
      setPoiEwbs(Array.isArray(data) ? data : []);
    } catch { setPoiEwbs([]); }
    setEwbLoading(false);
  };

  // Group vehicles
  const inTransit = [], noGps = [], groups = {};
  routeVehicles.forEach(v => {
    if (v.load_status === 'in_transit_loaded' || v.load_status === 'in_transit_empty') { inTransit.push(v); return; }
    if (!v.current_poi_name) { noGps.push(v); return; }
    if (!groups[v.current_poi_name]) groups[v.current_poi_name] = { loading: [], unloading: [], parked: [], poi_type: v.current_poi_type, poi_obj: v.current_poi };
    const g = groups[v.current_poi_name];
    if (v.load_status === 'unloading_at_delivery') g.unloading.push(v);
    else if (v.load_status === 'empty_at_delivery') g.parked.push(v);
    else g.loading.push(v);
  });

  const myGroupEntries = Object.entries(groups).filter(([n]) => myPoiNames.has(n));
  const otherGroupEntries = Object.entries(groups)
    .filter(([n]) => !myPoiNames.has(n))
    .sort((a, b) => (b[1].loading.length + b[1].unloading.length + b[1].parked.length) - (a[1].loading.length + a[1].unloading.length + a[1].parked.length));

  const totalAt = g => g.loading.length + g.unloading.length + g.parked.length;
  const poiTypeIcon = t => ({ primary: '🏭', secondary: '🏪', tertiary: '🏬' }[t] || '📍');

  const handlePoiClick = (poiName, g) => {
    if (activePoi?.name === poiName) { setActivePoi(null); setActiveVehicle(''); setActiveEwb(''); setPoiEwbs([]); return; }
    const poiObj = g.poi_obj || pois.find(p => p.poi_name === poiName);
    setActivePoi({ name: poiName, id: poiObj?.id || null });
    setActiveVehicle(''); setActiveEwb('');
    fetchPoiEwbs(poiObj?.id);
  };

  const handleVehicleChipClick = (v, poiName, g) => {
    const poiObj = g.poi_obj || pois.find(p => p.poi_name === poiName);
    if (activePoi?.name !== poiName) {
      setActivePoi({ name: poiName, id: poiObj?.id || null });
      fetchPoiEwbs(poiObj?.id);
      setActiveEwb('');
    }
    setActiveVehicle(prev => prev === v.vehicle_no ? '' : v.vehicle_no);
  };

  const renderChip = (v, poiName, g) => {
    const sc = routingSizeColor(v.vehicle_size);
    const isActive = activeVehicle === v.vehicle_no && activePoi?.name === poiName;
    return (
      <div key={v.vehicle_no}
        title={`${v.vehicle_no}${v.vehicle_size ? ' · ' + v.vehicle_size : ''}${v.active_ewbs?.length ? ' · ' + v.active_ewbs.length + ' EWB' : ''}`}
        onClick={() => handleVehicleChipClick(v, poiName, g)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: isActive ? '#2563eb' : sc.bg,
          border: `2px solid ${isActive ? '#93c5fd' : sc.border}`,
          color: '#fff', borderRadius: 7, padding: '4px 10px',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          userSelect: 'none', boxShadow: isActive ? '0 0 0 3px rgba(147,197,253,0.4)' : undefined,
        }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
        {v.vehicle_no}
        {(v.active_ewbs?.length || 0) > 0 && (
          <span style={{ background: '#fff', color: isActive ? '#2563eb' : sc.bg, borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 800, lineHeight: '16px' }}>{v.active_ewbs.length}</span>
        )}
      </div>
    );
  };

  const renderActionPanel = (poiName, g) => {
    if (activePoi?.name !== poiName) return null;
    const waitingVehicles = [...g.loading, ...g.parked];
    return (
      <div style={{ margin: '0 8px 10px', background: '#0f172a', border: '1px solid #2563eb', borderRadius: 10, padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.08em' }}>📍 {poiName}</span>
          <button onClick={() => { setActivePoi(null); setActiveVehicle(''); setActiveEwb(''); }}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>✕</button>
        </div>

        {waitingVehicles.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>At POI ({waitingVehicles.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {waitingVehicles.map(v => (
                <button key={v.vehicle_no} onClick={() => setActiveVehicle(prev => prev === v.vehicle_no ? '' : v.vehicle_no)}
                  style={{ background: activeVehicle === v.vehicle_no ? '#2563eb' : '#1e293b', border: `1.5px solid ${activeVehicle === v.vehicle_no ? '#3b82f6' : '#334155'}`, color: activeVehicle === v.vehicle_no ? '#fff' : '#94a3b8', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700 }}>
                  {v.vehicle_no}{(v.active_ewbs?.length || 0) > 0 && <span style={{ marginLeft: 4, fontSize: 10, color: '#fbbf24' }}>[{v.active_ewbs.length}]</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {inTransit.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>On Road ({inTransit.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {inTransit.slice(0, 10).map(v => (
                <button key={v.vehicle_no} onClick={() => setActiveVehicle(prev => prev === v.vehicle_no ? '' : v.vehicle_no)}
                  style={{ background: activeVehicle === v.vehicle_no ? '#0891b2' : '#1e293b', border: `1.5px solid ${activeVehicle === v.vehicle_no ? '#0ea5e9' : '#334155'}`, color: activeVehicle === v.vehicle_no ? '#fff' : '#64748b', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'monospace', fontWeight: 700 }}>
                  {v.vehicle_no}{(v.active_ewbs?.length || 0) > 0 && <span style={{ marginLeft: 4, fontSize: 10, color: '#fbbf24' }}>[{v.active_ewbs.length}]</span>}
                </button>
              ))}
              {inTransit.length > 10 && <span style={{ fontSize: 11, color: '#475569', padding: '5px 4px' }}>+{inTransit.length - 10} more</span>}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Other Vehicle</div>
          <select value={activeVehicle} onChange={e => setActiveVehicle(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9', fontSize: 12, boxSizing: 'border-box' }}>
            <option value="">— Choose vehicle —</option>
            {vehicles.map(v => <option key={v.vehicle_no} value={v.vehicle_no}>{v.vehicle_no}{v.driver_name ? ` · ${v.driver_name}` : ''}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            Live EWB {ewbLoading ? '(loading…)' : poiEwbs.length > 0 ? `(${poiEwbs.length})` : ''}
          </div>
          <select value={activeEwb} onChange={e => setActiveEwb(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9', fontSize: 12, boxSizing: 'border-box' }}>
            <option value="">— No EWB / manual —</option>
            {poiEwbs.map(e => (
              <option key={e.id || e.ewb_no} value={e.ewb_no}>
                {e.ewb_no}{e.from_place ? ` · ${e.from_place}→${e.to_place || ''}` : ''}{e.movement_type ? ` [${e.movement_type.replace(/_/g, ' ')}]` : ''}
              </option>
            ))}
          </select>
        </div>

        <button disabled={!activeVehicle}
          onClick={() => {
            onGoToTrip({ vehicle_no: activeVehicle, from_poi_id: String(activePoi.id || ''), from_poi_name: activePoi.name, ewb_no: activeEwb });
            setActivePoi(null); setActiveVehicle(''); setActiveEwb('');
          }}
          style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: 13, cursor: activeVehicle ? 'pointer' : 'not-allowed', background: activeVehicle ? '#2563eb' : '#1e293b', color: activeVehicle ? '#fff' : '#475569' }}>
          {activeVehicle ? `➕ Create Trip for ${activeVehicle}` : '← Select a vehicle first'}
        </button>
      </div>
    );
  };

  const renderPoiBlock = (poiName, g, isMine) => {
    const total = totalAt(g);
    const hasLoadUnload = g.loading.length > 0 || g.unloading.length > 0;
    const inlineParked = !hasLoadUnload && g.parked.length > 0;
    const separateParked = hasLoadUnload && g.parked.length > 0;
    const isActive = activePoi?.name === poiName;
    return (
      <div key={poiName} style={{ borderRadius: 10, border: `1px solid ${isActive ? '#2563eb' : isMine ? '#3b82f6' : '#334155'}`, overflow: 'hidden', boxShadow: isActive ? '0 0 0 2px rgba(59,130,246,0.3)' : '0 1px 3px rgba(0,0,0,0.2)', background: '#1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: isMine ? 'rgba(30,58,138,0.3)' : '#1e293b', borderBottom: separateParked ? '1px solid #334155' : 'none' }}>
          <button onClick={() => handlePoiClick(poiName, g)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRight: '1px solid #334155', width: 180, minWidth: 180, flexShrink: 0, background: isActive ? '#1e3a8a' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ fontSize: 13, flexShrink: 0 }}>{poiTypeIcon(g.poi_type)}</span>
            <span style={{ fontWeight: 800, fontSize: 12, color: isMine ? '#60a5fa' : '#94a3b8', lineHeight: 1.3, wordBreak: 'break-word' }}>{poiName}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: isMine ? '#2563eb' : '#475569', border: `1.5px solid ${isMine ? '#1d4ed8' : '#334155'}`, padding: '1px 6px', borderRadius: 7, flexShrink: 0, marginLeft: 2, whiteSpace: 'nowrap' }}>{total}</span>
          </button>
          {g.loading.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRight: g.unloading.length > 0 ? '1px solid #334155' : 'none', background: 'rgba(251,191,36,0.08)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#92400e', background: '#fde68a', border: '1.5px solid #f59e0b', borderRadius: 7, padding: '3px 9px', whiteSpace: 'nowrap' }}>📦 LOAD</span>
              {g.loading.map(v => renderChip(v, poiName, g))}
            </div>
          )}
          {g.unloading.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: 'rgba(59,130,246,0.08)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#60a5fa', background: '#1e3a8a', border: '1.5px solid #3b82f6', borderRadius: 7, padding: '3px 9px', whiteSpace: 'nowrap' }}>🔽 UNLOD</span>
              {g.unloading.map(v => renderChip(v, poiName, g))}
            </div>
          )}
          {inlineParked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: 'rgba(71,85,105,0.2)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', background: '#334155', border: '1.5px solid #475569', borderRadius: 7, padding: '3px 9px', whiteSpace: 'nowrap' }}>🅿 PARK</span>
              {g.parked.map(v => renderChip(v, poiName, g))}
            </div>
          )}
        </div>
        {separateParked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', background: 'rgba(71,85,105,0.15)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', background: '#334155', border: '1.5px solid #475569', borderRadius: 7, padding: '3px 9px', whiteSpace: 'nowrap' }}>🅿 PARK</span>
            {g.parked.map(v => renderChip(v, poiName, g))}
          </div>
        )}
        {renderActionPanel(poiName, g)}
      </div>
    );
  };

  const stats = {
    loading:   routeVehicles.filter(v => v.load_status === 'empty_at_loading').length,
    transit:   inTransit.length,
    unloading: routeVehicles.filter(v => v.load_status === 'unloading_at_delivery').length,
    parked:    routeVehicles.filter(v => v.load_status === 'empty_at_delivery').length,
  };

  return (
    <div style={{ padding: '12px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {[['📦 Load', stats.loading, '#fffbeb', '#92400e', '#fde68a'], ['🚛 Transit', stats.transit, '#f0fdf4', '#166534', '#86efac'], ['🔽 Unlod', stats.unloading, '#eff6ff', '#1d4ed8', '#93c5fd'], ['🅿 Park', stats.parked, '#f9fafb', '#4b5563', '#d1d5db']].map(([label, val, bg, color, border]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, background: bg, border: `1px solid ${border}`, color, borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>
            {label} <span style={{ fontWeight: 800, fontSize: 13 }}>{val}</span>
          </div>
        ))}
        <button onClick={fetchRoute} style={{ marginLeft: 'auto', background: '#1e293b', border: '1px solid #334155', color: '#64748b', borderRadius: 7, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>🔄</button>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading vehicle positions…</div>}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {myGroupEntries.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: '#60a5fa', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>📋 My POIs — click POI or vehicle to dispatch</div>
              {myGroupEntries.map(([name, g]) => renderPoiBlock(name, g, true))}
            </>
          )}

          {inTransit.length > 0 && (
            <div style={{ background: '#1e293b', borderRadius: 10, border: '1px solid #22c55e', overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: 'rgba(34,197,94,0.08)', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: '#86efac', flex: 1 }}>🚛 In Transit ({inTransit.length})</span>
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {inTransit.map(v => { const sc = routingSizeColor(v.vehicle_size); return (
                  <div key={v.vehicle_no} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: sc.bg, border: `1.5px solid ${sc.border}`, color: '#fff', borderRadius: 7, padding: '4px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
                    {v.vehicle_no}
                    {(v.active_ewbs?.length || 0) > 0 && <span style={{ background: '#fff', color: sc.bg, borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 800 }}>{v.active_ewbs.length}</span>}
                  </div>
                ); })}
              </div>
            </div>
          )}

          {otherGroupEntries.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Other POIs ({otherGroupEntries.length}) — click ▼ to expand</div>
              {otherGroupEntries.map(([name, g]) => {
                const isExpanded = expandedPois.has(name);
                const total = totalAt(g);
                return (
                  <div key={name} style={{ background: '#1e293b', borderRadius: 8, border: '1px solid #334155', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer' }}
                      onClick={() => setExpandedPois(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; })}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', flex: 1 }}>{name}</span>
                      <span style={{ background: '#334155', color: '#94a3b8', borderRadius: 8, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{total}</span>
                      <span style={{ color: '#475569', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                    {isExpanded && renderPoiBlock(name, g, false)}
                  </div>
                );
              })}
            </>
          )}

          {routeVehicles.length === 0 && <Empty msg="No vehicle data" sub="GPS positions auto-refresh every 30s" />}
        </div>
      )}
    </div>
  );
}

// ─── Munshi Deliver Modal ─────────────────────────────────────────────────────
function MunshiDeliverModal({ ewb, munshi, onClose, onDone }) {
  const [exp, setExp] = useState({ km: '', toll: '', exp_munshi: '', exp_cash_fuel: '', exp_unloading: '', exp_other: '' });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const sE = (k, v) => setExp(e => ({ ...e, [k]: v }));

  const iS = { width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 12, background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', boxSizing: 'border-box' };
  const lS = { fontSize: 11, color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: 3 };

  const handleSave = async () => {
    setSaving(true); setErr('');
    try {
      // 1. Mark EWB delivered
      if (ewb.id) {
        const pr = await fetch(`/api/eway-bills-hub/${ewb.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'delivered', munshi_id: String(munshi.id), munshi_name: munshi.name }),
        });
        const pd = await pr.json();
        if (pd.error) throw new Error(pd.error);
      }
      // 2. Create munshi trip with expenses
      await fetch('/api/munshi-trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_no: ewb.vehicle_no || '',
          ewb_no: ewb.ewb_no,
          from_poi_name: ewb.from_poi_name || '',
          to_poi_name: ewb.to_poi_name || ewb.to_place || '',
          trip_date: new Date().toISOString().slice(0, 10),
          munshi_id: String(munshi.id),
          munshi_name: munshi.name,
          km: parseFloat(exp.km) || 0,
          toll: parseFloat(exp.toll) || 0,
          exp_munshi: parseFloat(exp.exp_munshi) || 0,
          exp_cash_fuel: parseFloat(exp.exp_cash_fuel) || 0,
          exp_unloading: parseFloat(exp.exp_unloading) || 0,
          exp_other: parseFloat(exp.exp_other) || 0,
          notes,
          status: 'open',
        }),
      });
      setDone(true);
      setTimeout(() => onDone && onDone(ewb.ewb_no), 1200);
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1e293b', borderRadius: 12, padding: 24, width: 460, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid #334155', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#f1f5f9' }}>✅ Mark Delivered — {ewb.ewb_no}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ background: '#0f172a', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 11, color: '#94a3b8' }}>
          <b style={{ color: '#60a5fa' }}>{ewb.vehicle_no || '—'}</b> &nbsp;→&nbsp; <b style={{ color: '#a3e635' }}>{ewb.to_poi_name || ewb.to_place || '—'}</b>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          {[['km','KM'],['toll','Toll (₹)'],['exp_munshi','Munshi Exp (₹)'],['exp_cash_fuel','Cash Fuel (₹)'],['exp_unloading','Unloading (₹)'],['exp_other','Other (₹)']].map(([k, lbl]) => (
            <div key={k} style={{ marginBottom: 10 }}>
              <label style={lS}>{lbl}</label>
              <input type="number" min="0" step="0.01" placeholder="0" value={exp[k]} onChange={e => sE(k, e.target.value)} style={iS} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lS}>Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="optional" style={iS} />
        </div>
        {err && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 8 }}>❌ {err}</div>}
        {done && <div style={{ color: '#4ade80', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>✅ Delivered & trip saved!</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || done}
            style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: done ? '#166534' : '#16a34a', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            {saving ? '⏳ Saving…' : done ? '✅ Done' : '✅ Save & Deliver'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Trips Tab ────────────────────────────────────────────────────────────────
function TripsTab({ munshi, vehicles, pois, tripPrefill, onPrefillDone }) {
  // Left panel state
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  // Right panel state
  const [ewbs,     setEwbs]     = useState([]);   // eway bills for selected vehicle
  const [poiEwbs,  setPoiEwbs]  = useState([]);   // all EWBs issued from munshi's POI(s)
  const [trips,    setTrips]    = useState([]);   // saved munshi_trips
  const [loadingR, setLoadingR] = useState(false);
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form, setForm] = useState(blankForm(munshi));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]     = useState('');
  const [ewbFilter, setEwbFilter] = useState('all'); // 'all'|'dealer'|'return'|'inbound'
  const [deliverEwb, setDeliverEwb] = useState(null); // EWB open in MunshiDeliverModal
  const [formEwbs,      setFormEwbs]      = useState([]);   // real EWBs for the vehicle selected in form
  const [ewbManual,     setEwbManual]     = useState(false); // user chose to type EWB manually
  const [ewbManualInput, setEwbManualInput] = useState(''); // text buffer for manual EWB entry

  const MOV_CFG = {
    primary_to_secondary: { label: 'Hub→Dist',   badge: '#1d4ed8' },
    primary_to_tertiary:  { label: 'Hub→Dealer',  badge: '#7c3aed' },
    secondary_to_dealer:  { label: 'Dist→Dealer', badge: '#166534' },
    dealer_transfer:      { label: 'Dealer Xfer', badge: '#b45309' },
    dealer_return:        { label: '↩ Return',    badge: '#92400e' },
    inward_return:        { label: '↩ Inward',    badge: '#78350f' },
  };

  const PROCESS_STEPS = [
    { key: 'loading',        label: '📦 Loading',        color: '#f59e0b' },
    { key: 'dispatched',     label: '🚛 Dispatched',     color: '#0ea5e9' },
    { key: 'in_transit',     label: '🛣️ In Transit',     color: '#8b5cf6' },
    { key: 'at_destination', label: '📍 At Destination', color: '#f97316' },
    { key: 'unloading',      label: '🏭 Unloading',      color: '#ec4899' },
    { key: 'delivered',      label: '✅ Delivered',      color: '#4ade80' },
  ];

  // Parse munshi's POI IDs
  const myPoiIds = (() => {
    try { return JSON.parse(munshi.primary_poi_ids || '[]').map(String); } catch { return []; }
  })();

  // My vehicles: own + common + POI-overlap vehicles
  const myVehicles = vehicles.filter(v => {
    if ((v.munshi_id && String(v.munshi_id) === String(munshi.id)) ||
        (v.munshi_name || '').toLowerCase() === (munshi.name || '').toLowerCase()) return true;
    if ((v.munshi_name || '').toLowerCase() === 'common' || (!v.munshi_id && !v.munshi_name)) return true;
    if (myPoiIds.length > 0) {
      const vPois = (() => { try { return JSON.parse(v.primary_poi_ids || '[]').map(String); } catch { return []; } })();
      if (vPois.some(p => myPoiIds.includes(p))) return true;
    }
    return false;
  });

  // Fetch all EWBs issued from munshi's registered POI(s) on mount
  useEffect(() => {
    if (myPoiIds.length === 0) return;
    fetch(`${API}/munshi-trips/ewb-search?clientId=CLIENT_001&poi_ids=${myPoiIds.join(',')}`)
      .then(r => r.json())
      .then(d => setPoiEwbs(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Apply prefill from RoutingTab
  useEffect(() => {
    if (!tripPrefill) return;
    const v = vehicles.find(x => x.vehicle_no === tripPrefill.vehicle_no);
    setSelectedVehicle(v || null);
    setForm(f => ({
      ...f,
      vehicle_no:    tripPrefill.vehicle_no,
      driver_name:   v?.driver_name || '',
      from_poi_id:   tripPrefill.from_poi_id,
      from_poi_name: tripPrefill.from_poi_name,
      ewb_nos:       tripPrefill.ewb_no ? [tripPrefill.ewb_no] : [],
      ewb_no:        tripPrefill.ewb_no || '',
      ewb_is_temp:   0,
    }));
    setEwbManual(false);
    setEwbManualInput('');
    setEditId(null);
    setShowForm(true);
    setMsg('');
    if (onPrefillDone) onPrefillDone();
  }, [tripPrefill]);

  // Whenever form vehicle changes, load real EWBs for the dropdown:
  // Merge EWBs by vehicle_no + munshi's POI outbound EWBs (vehicle may not be assigned yet)
  useEffect(() => {
    if (!form.vehicle_no) { setFormEwbs([]); setEwbManual(false); return; }
    const vno = encodeURIComponent(form.vehicle_no);
    const byVehicle = fetch(`${API}/munshi-trips/ewb-search?clientId=CLIENT_001&vehicle_no=${vno}`)
      .then(r => r.json()).catch(() => []);
    const byPoi = myPoiIds.length > 0
      ? fetch(`${API}/munshi-trips/ewb-search?clientId=CLIENT_001&poi_ids=${myPoiIds.join(',')}`)
          .then(r => r.json()).catch(() => [])
      : Promise.resolve([]);
    Promise.all([byVehicle, byPoi]).then(([vData, pData]) => {
      const vList = Array.isArray(vData) ? vData : [];
      const pList = Array.isArray(pData) ? pData.filter(e => e.direction === 'outbound') : [];
      // Merge, deduplicate by ewb_no, filter out delivered/cancelled
      const seen = new Set();
      const merged = [...vList, ...pList].filter(e => {
        if (e.status === 'delivered' || e.status === 'cancelled') return false;
        if (seen.has(e.ewb_no)) return false;
        seen.add(e.ewb_no);
        return true;
      });
      setFormEwbs(merged);
    });
  }, [form.vehicle_no]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load right panel when vehicle selected
  useEffect(() => {
    if (!selectedVehicle) { setEwbs([]); setTrips([]); return; }
    setLoadingR(true);
    const vno = encodeURIComponent(selectedVehicle.vehicle_no);
    Promise.all([
      fetch(`${API}/munshi-trips/ewb-search?clientId=CLIENT_001&vehicle_no=${vno}`).then(r => r.json()).catch(() => []),
      fetch(`${API}/munshi-trips?clientId=CLIENT_001&vehicle_no=${vno}`).then(r => r.json()).catch(() => []),
    ]).then(([ewbData, tripData]) => {
      setEwbs(Array.isArray(ewbData) ? ewbData : []);
      setTrips(Array.isArray(tripData) ? tripData : []);
    }).finally(() => setLoadingR(false));
  }, [selectedVehicle]);

  function blankForm(m) {
    return {
      vehicle_no: '',
      driver_name: '',
      from_poi_id: '', from_poi_name: '',
      to_poi_id:   '', to_poi_name:   '',
      ewb_nos: [],
      ewb_no: '', ewb_is_temp: 0,
      trip_date: new Date().toISOString().slice(0, 10),
      km: '', toll: '',
      exp_admin:            '', // admin only field shown but disabled
      exp_munshi:           '',
      exp_pump_consignment: '',
      exp_cash_fuel:        '',
      exp_unloading:        '',
      exp_driver_debit:     '', // admin only
      exp_other:            '',
      approved_by:          '', // admin only
      notes: '',
      munshi_id:   m?.id   || '',
      munshi_name: m?.name || '',
      status: 'open',
      process_step: 'loading',
    };
  }

  function openNew(ewb, vehicle) {
    // For POI-sourced EWBs, vehicle comes from the EWB record itself
    const ewbVehicle = ewb?.vehicle_no ? vehicles.find(v => v.vehicle_no === ewb.vehicle_no) : null;
    const v          = ewbVehicle || vehicle || selectedVehicle;
    setForm({
      ...blankForm(munshi),
      vehicle_no:    v?.vehicle_no  || ewb?.vehicle_no || '',
      driver_name:   v?.driver_name || '',
      ewb_nos:       ewb?.ewb_no ? [ewb.ewb_no] : [],
      ewb_no:        ewb?.ewb_no || '',
      ewb_is_temp:   0,
      to_poi_name:   ewb?.to_poi_name || ewb?.to_place || '',
      from_poi_name: ewb?.from_poi_name || '',
    });
    setEwbManual(false);
    setEwbManualInput('');
    setEditId(null);
    setShowForm(true);
    setMsg('');
  }

  function openEdit(trip) {
    setForm({
      vehicle_no:           trip.vehicle_no || '',
      driver_name:          trip.driver_name || '',
      from_poi_id:          trip.from_poi_id || '',
      from_poi_name:        trip.from_poi_name || '',
      to_poi_id:            trip.to_poi_id || '',
      to_poi_name:          trip.to_poi_name || '',
      ewb_nos:              (() => { try { const a=JSON.parse(trip.ewb_nos||'[]'); return a.length>0?a:(trip.ewb_no?[trip.ewb_no]:[]); } catch{return trip.ewb_no?[trip.ewb_no]:[];} })(),
      ewb_no:               trip.ewb_no || '',
      ewb_is_temp:          trip.ewb_is_temp || 0,
      trip_date:            trip.trip_date || '',
      km:                   trip.km || '',
      toll:                 trip.toll || '',
      exp_admin:            trip.exp_admin || '',
      exp_munshi:           trip.exp_munshi || '',
      exp_pump_consignment: trip.exp_pump_consignment || '',
      exp_cash_fuel:        trip.exp_cash_fuel || '',
      exp_unloading:        trip.exp_unloading || '',
      exp_driver_debit:     trip.exp_driver_debit || '',
      exp_other:            trip.exp_other || '',
      approved_by:          trip.approved_by || '',
      notes:                trip.notes || '',
      munshi_id:            trip.munshi_id || munshi.id || '',
      munshi_name:          trip.munshi_name || munshi.name || '',
      status:               trip.status || 'open',
      process_step:         trip.process_step || 'loading',
    });
    setEditId(trip.id);
    setShowForm(true);
    setMsg('');
  }

  async function saveTrip() {
    if (!form.vehicle_no) { setMsg('❌ Vehicle is required'); return; }
    setSaving(true); setMsg('');
    try {
      const url    = editId ? `${API}/munshi-trips/${editId}` : `${API}/munshi-trips`;
      const method = editId ? 'PUT' : 'POST';
      // Derive primary ewb_no from ewb_nos array for backward compat
      const ewb_nos = Array.isArray(form.ewb_nos) ? form.ewb_nos : [];
      const ewb_no  = ewb_nos[0] || form.ewb_no || '';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ewb_nos, ewb_no, client_id: 'CLIENT_001' }),
      });
      const d = await res.json();
      if (d.error) { setMsg('❌ ' + d.error); return; }
      setMsg('✅ Saved!');
      setShowForm(false);
      // Refresh trips list
      const tripData = await fetch(`${API}/munshi-trips?clientId=CLIENT_001&vehicle_no=${encodeURIComponent(form.vehicle_no)}`).then(r => r.json()).catch(() => []);
      setTrips(Array.isArray(tripData) ? tripData : []);
      // Auto-select vehicle if none was selected (e.g. opened from POI EWB card)
      if (!selectedVehicle && form.vehicle_no) {
        const v = vehicles.find(x => x.vehicle_no === form.vehicle_no);
        if (v) setSelectedVehicle(v);
      }
    } catch (e) { setMsg('❌ ' + e.message); }
    finally { setSaving(false); }
  }

  async function closeEwb(ewbId) {
    try {
      await fetch(`${API}/ewaybills/${ewbId}/close`, { method: 'PUT' });
      setPoiEwbs(prev => prev.filter(e => e.id !== ewbId));
      setEwbs(prev => prev.filter(e => e.id !== ewbId));
    } catch {}
  }

  function Field({ label, name, type = 'text', disabled = false, hint }) {
    return (
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: disabled ? '#475569' : '#94a3b8', fontWeight: 700, display: 'block', marginBottom: 3 }}>
          {label}{disabled && ' 🔒'}
        </label>
        <input
          type={type}
          value={form[name] ?? ''}
          disabled={disabled}
          onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
          style={{
            width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 12, boxSizing: 'border-box',
            background: disabled ? '#0f172a' : '#1e293b',
            border: `1px solid ${disabled ? '#1e293b' : '#334155'}`,
            color: disabled ? '#475569' : '#f1f5f9',
          }}
        />
        {hint && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{hint}</div>}
      </div>
    );
  }

  function PoiSelect({ label, nameId, nameName }) {
    return (
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: 3 }}>{label}</label>
        <select
          value={form[nameId] || ''}
          onChange={e => {
            const p = pois.find(x => String(x.id) === e.target.value);
            setForm(f => ({ ...f, [nameId]: e.target.value, [nameName]: p?.poi_name || '' }));
          }}
          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 12, background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', boxSizing: 'border-box' }}
        >
          <option value="">— Select POI —</option>
          {pois.map(p => <option key={p.id} value={p.id}>{p.poi_name} ({p.city || '?'})</option>)}
        </select>
        {form[nameName] && <div style={{ fontSize: 10, color: '#4ade80', marginTop: 2 }}>📍 {form[nameName]}</div>}
      </div>
    );
  }

  const filteredPoiEwbs = ewbFilter === 'all' ? poiEwbs
    : ewbFilter === 'dealer'  ? poiEwbs.filter(e => ['primary_to_tertiary','secondary_to_dealer','dealer_transfer'].includes(e.movement_type))
    : ewbFilter === 'return'  ? poiEwbs.filter(e => ['dealer_return','inward_return'].includes(e.movement_type))
    : ewbFilter === 'inbound' ? poiEwbs.filter(e => e.direction === 'inbound')
    : poiEwbs;

  return (
    <>
    <div style={{ display: 'flex', height: 'calc(100vh - 110px)', overflow: 'hidden' }}>

      {/* ── LEFT: Vehicle List ── */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid #1e293b', overflowY: 'auto', background: '#0f172a', padding: '8px 0' }}>
        <div style={{ padding: '4px 10px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {selectedVehicle ? '🚛 Selected' : `Vehicles (${myVehicles.length})`}
          </span>
          {selectedVehicle && (
            <button onClick={() => { setSelectedVehicle(null); setShowForm(false); }}
              style={{ fontSize: 10, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontWeight: 700 }}>← All</button>
          )}
        </div>
        {myVehicles.length === 0 && <div style={{ fontSize: 11, color: '#334155', padding: '8px 10px' }}>No vehicles</div>}
        {myVehicles.filter(v => !selectedVehicle || v.vehicle_no === selectedVehicle.vehicle_no).map(v => {
          const sel = selectedVehicle?.vehicle_no === v.vehicle_no;
          const isDirect = (v.munshi_id && String(v.munshi_id) === String(munshi.id)) ||
                           (v.munshi_name || '').toLowerCase() === (munshi.name || '').toLowerCase();
          const isCommon = !isDirect && ((v.munshi_name || '').toLowerCase() === 'common' || (!v.munshi_id && !v.munshi_name));
          const isPoi    = !isDirect && !isCommon;
          return (
            <button
              key={v.vehicle_no}
              onClick={() => { setSelectedVehicle(v); setShowForm(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 10px', border: 'none',
                background: sel ? '#1e3a8a' : 'transparent',
                borderLeft: sel ? '3px solid #3b82f6' : '3px solid transparent',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 900, color: sel ? '#60a5fa' : '#94a3b8', fontFamily: 'monospace', lineHeight: 1.3 }}>{v.vehicle_no}</div>
              {isDirect  && <div style={{ fontSize: 9, color: '#4ade80', marginTop: 2 }}>✅ mine</div>}
              {isCommon  && <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>🔄 common</div>}
              {isPoi     && <div style={{ fontSize: 9, color: '#0ea5e9', marginTop: 2 }}>📍 poi</div>}
              {v.driver_name && <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{v.driver_name.split(' ')[0]}</div>}
            </button>
          );
        })}
      </div>

      {/* ── RIGHT: Eway Bills + Trips ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px', background: '#0f172a' }}>

        {/* POI-sourced EWBs — with type filter + direction + close */}
        {poiEwbs.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, color: '#0ea5e9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>📍 My POI E-Way Bills ({poiEwbs.length})</div>
              {[['all','All'],['dealer','Dealer'],['return','Returns'],['inbound','Inbound']].map(([f,lbl]) => (
                <button key={f} onClick={() => setEwbFilter(f)}
                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, border: 'none', background: ewbFilter === f ? '#0284c7' : '#1e293b', color: ewbFilter === f ? '#fff' : '#64748b', cursor: 'pointer', fontWeight: ewbFilter === f ? 700 : 400 }}
                >{lbl}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
              {filteredPoiEwbs.map(ewb => {
                const mc   = MOV_CFG[ewb.movement_type] || {};
                const isIn = ewb.direction === 'inbound';
                return (
                    <div key={ewb.id + (ewb.direction||'')} style={{ background: ewb.status === 'at_destination' ? '#0d2e1f' : '#0c1a30', border: ewb.status === 'at_destination' ? '1px solid #14532d' : isIn ? '1px solid #713f12' : '1px solid #0e4163', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => { openNew(ewb, null); setShowForm(true); }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: ewb.status === 'at_destination' ? '#4ade80' : '#60a5fa', fontWeight: 700 }}>{ewb.ewb_no}</span>
                        {ewb.status === 'at_destination' && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: '#14532d', color: '#4ade80', fontWeight: 800 }}>📍 ARRIVED</span>}
                        {ewb.vehicle_no && <span style={{ fontSize: 10, color: '#a3e635', fontFamily: 'monospace', background: '#14532d33', padding: '1px 6px', borderRadius: 4 }}>{ewb.vehicle_no}</span>}
                        {mc.label && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: (mc.badge||'#64748b')+'22', color: mc.badge||'#64748b', fontWeight: 700 }}>{mc.label}</span>}
                        {isIn && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: '#78350f55', color: '#fbbf24', fontWeight: 700 }}>⬅ Inbound</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{isIn ? `← ${ewb.from_poi_name||ewb.from_place||'?'}` : `→ ${ewb.to_poi_name||ewb.to_place||'?'}`}</div>
                      {ewb.total_value > 0 && <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>₹{Number(ewb.total_value).toLocaleString('en-IN')}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => { openNew(ewb, null); setShowForm(true); }}
                        style={{ fontSize: 10, color: '#fff', background: '#0284c7', border: 'none', borderRadius: 6, padding: '4px 8px', fontWeight: 700, cursor: 'pointer' }}>Use →</button>
                      <button onClick={() => setDeliverEwb(ewb)}
                        style={{ fontSize: 10, color: '#fff', background: ewb.status === 'at_destination' ? '#16a34a' : '#166534', border: 'none', borderRadius: 6, padding: '4px 8px', fontWeight: 700, cursor: 'pointer' }}>✅ Deliver</button>
                      <button onClick={() => closeEwb(ewb.id)}
                        style={{ fontSize: 10, color: '#f87171', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: '4px 8px', fontWeight: 700, cursor: 'pointer' }}>🔒 Close</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TRIP FORM — shown regardless of selectedVehicle (fixes POI EWB click bug) */}
        {showForm && (
          <div style={{ background: '#1e293b', borderRadius: 10, padding: '14px 14px', marginBottom: 14, border: '1px solid #334155' }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#f1f5f9', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span>{editId ? '✏️ Edit Trip' : '➕ New Trip'}</span>
            </div>
            {/* Process Step Selector */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>📋 Process Step</div>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                {PROCESS_STEPS.map(s => {
                  const active = form.process_step === s.key;
                  return (
                    <button key={s.key} onClick={() => setForm(f => ({ ...f, process_step: s.key }))}
                      style={{ whiteSpace: 'nowrap', padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                        background: active ? s.color : '#0f172a',
                        color: active ? '#0f172a' : '#475569',
                        border: active ? `2px solid ${s.color}` : '1px solid #334155',
                      }}>{s.label}</button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: 3 }}>Vehicle No</label>
                <select
                  value={form.vehicle_no}
                  onChange={e => {
                    const v = vehicles.find(x => x.vehicle_no === e.target.value);
                    setForm(f => ({ ...f, vehicle_no: e.target.value, driver_name: v?.driver_name || f.driver_name }));
                  }}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 12, background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', boxSizing: 'border-box' }}
                >
                  <option value="">— Select Vehicle —</option>
                  {vehicles.filter(v => v.vehicle_no).map(v => (
                    <option key={v.vehicle_no} value={v.vehicle_no}>{v.vehicle_no}{v.driver_name ? ` · ${v.driver_name}` : ''}</option>
                  ))}
                </select>
              </div>
              <Field label="Driver Name" name="driver_name" />
              {/* Multi-EWB selector */}
              <div style={{ marginBottom: 10, gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: 3 }}>
                  EWB Numbers {form.ewb_nos.length > 0 && <span style={{ color: '#4ade80' }}>({form.ewb_nos.length} selected)</span>}
                </label>
                {/* Selected EWB chips */}
                {form.ewb_nos.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {form.ewb_nos.map(n => (
                      <span key={n} style={{ background: '#1d4ed8', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {n}
                        <button onClick={() => setForm(f => ({ ...f, ewb_nos: f.ewb_nos.filter(x => x !== n) }))}
                          style={{ background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                {/* EWB list (checkboxes) or manual input */}
                {formEwbs.length > 0 && !ewbManual ? (
                  <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #334155', borderRadius: 6, background: '#0f172a' }}>
                    {formEwbs.map(e => {
                      const checked = form.ewb_nos.includes(e.ewb_no);
                      return (
                        <label key={e.id || e.ewb_no} style={{ display: 'flex', alignItems: 'flex-start', padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #1e293b', gap: 8, background: checked ? '#0d2e1f' : 'transparent' }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => setForm(f => ({
                              ...f,
                              ewb_nos: checked ? f.ewb_nos.filter(x => x !== e.ewb_no) : [...f.ewb_nos, e.ewb_no],
                            }))}
                            style={{ marginTop: 1 }}
                          />
                          <div>
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: checked ? '#4ade80' : '#60a5fa', fontWeight: 700 }}>{e.ewb_no}</span>
                            {(e.to_poi_name || e.to_place) && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 6 }}>→ {e.to_poi_name || e.to_place}</span>}
                            {e.movement_type && <span style={{ fontSize: 9, color: '#475569', marginLeft: 4 }}>[{e.movement_type.replace(/_/g,' ')}]</span>}
                          </div>
                        </label>
                      );
                    })}
                    <div onClick={() => { setEwbManual(true); }} style={{ padding: '6px 10px', fontSize: 10, color: '#475569', cursor: 'pointer' }}>⌨️ Enter manually…</div>
                  </div>
                ) : ewbManual ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      value={ewbManualInput}
                      onChange={e => setEwbManualInput(e.target.value)}
                      onKeyDown={e => {
                        if ((e.key === 'Enter' || e.key === ',') && ewbManualInput.trim()) {
                          e.preventDefault();
                          const val = ewbManualInput.trim().replace(/,/g,'');
                          if (val && !form.ewb_nos.includes(val))
                            setForm(f => ({ ...f, ewb_nos: [...f.ewb_nos, val] }));
                          setEwbManualInput('');
                        }
                      }}
                      placeholder="Type EWB number, press Enter to add"
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 6, fontSize: 12, background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', boxSizing: 'border-box' }}
                    />
                    <button onClick={() => { setEwbManual(false); setEwbManualInput(''); }}
                      style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#94a3b8', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>✕ Cancel</button>
                  </div>
                ) : (
                  /* No EWBs available — optional manual entry */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                    <span style={{ fontSize: 11, color: '#475569' }}>No active EWBs for this vehicle</span>
                    <button onClick={() => setEwbManual(true)}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #334155', background: '#0f172a', color: '#60a5fa', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>⌨️ Add manually</button>
                  </div>
                )}
              </div>
              <Field label="Trip Date" name="trip_date" type="date" />
              <PoiSelect label="From POI" nameId="from_poi_id" nameName="from_poi_name" />
              <PoiSelect label="To POI" nameId="to_poi_id" nameName="to_poi_name" />
              <Field label="KM" name="km" type="number" />
              <Field label="Toll (₹)" name="toll" type="number" />
            </div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, margin: '10px 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em', borderTop: '1px solid #334155', paddingTop: 10 }}>💰 Expenses</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
              <Field label="Admin Expense (₹)" name="exp_admin" type="number" disabled hint="Set by admin" />
              <Field label="Munshi Expense (₹)" name="exp_munshi" type="number" />
              <Field label="Pump Fuel – Consignment (₹)" name="exp_pump_consignment" type="number" hint="Petrol pump assigned by owner" />
              <Field label="Cash Fuel – Other (₹)" name="exp_cash_fuel" type="number" hint="Fuel paid at other pump" />
              <Field label="Unloading Charges (₹)" name="exp_unloading" type="number" />
              <Field label="Driver Debit (₹)" name="exp_driver_debit" type="number" disabled hint="Set by admin" />
              <div style={{ gridColumn: '1/-1' }}><Field label="Other Expense (₹)" name="exp_other" type="number" /></div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: 3 }}>Munshi Name 🔒</label>
              <input readOnly value={form.munshi_name} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 12, background: '#0f172a', border: '1px solid #1e293b', color: '#475569', boxSizing: 'border-box' }} />
            </div>
            <Field label="Notes" name="notes" />
            {msg && <div style={{ fontSize: 12, marginBottom: 8, color: msg.startsWith('✅') ? '#4ade80' : '#f87171', fontWeight: 700 }}>{msg}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveTrip} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{saving ? '⏳...' : '💾 Save'}</button>
            </div>
          </div>
        )}

        {/* No vehicle selected */}
        {!selectedVehicle && !showForm && (
          <div style={{ textAlign: 'center', padding: poiEwbs.length > 0 ? '20px' : '60px 20px', color: '#334155', borderTop: poiEwbs.length > 0 ? '1px solid #1e293b' : 'none' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>👈</div>
            <div style={{ fontWeight: 700, color: '#475569', fontSize: 13 }}>Select a vehicle for trip history</div>
          </div>
        )}

        {/* Vehicle-specific content */}
        {selectedVehicle && !showForm && (
          loadingR ? <Spinner /> : (
            <>
              {/* Vehicle header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16, color: '#60a5fa', fontFamily: 'monospace' }}>{selectedVehicle.vehicle_no}</div>
                  {selectedVehicle.driver_name && <div style={{ fontSize: 11, color: '#a3e635' }}>👤 {selectedVehicle.driver_name}</div>}
                </div>
                <button onClick={() => openNew(null, selectedVehicle)}
                  style={{ background: '#1d4ed8', border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ New Trip</button>
              </div>

              {/* Vehicle-specific active EWBs */}
              {ewbs.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>📄 Active E-Way Bills</div>
                  {ewbs.map(ewb => (
                    <div key={ewb.id}
                      style={{ background: ewb.status === 'at_destination' ? '#0d2e1f' : '#0c1a30', border: `1px solid ${ewb.status === 'at_destination' ? '#14532d' : '#1e3a8a'}`, borderRadius: 8, padding: '10px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
                    >
                      <div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={() => openNew(ewb, selectedVehicle)}>
                        {ewb.status === 'at_destination' && (
                          <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 800, marginBottom: 3 }}>📍 VEHICLE ARRIVED AT DESTINATION</div>
                        )}
                        <div style={{ fontFamily: 'monospace', fontSize: 12, color: ewb.status === 'at_destination' ? '#4ade80' : '#60a5fa', fontWeight: 700 }}>{ewb.ewb_no}</div>
                        <div style={{ fontSize: 11, color: '#a3e635', marginTop: 2 }}>→ {ewb.to_poi_name || ewb.to_place || 'Unknown destination'}</div>
                        {ewb.total_value > 0 && <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>₹{Number(ewb.total_value).toLocaleString('en-IN')}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                        <button onClick={() => openNew(ewb, selectedVehicle)}
                          style={{ fontSize: 10, color: '#fff', background: '#1d4ed8', border: 'none', borderRadius: 6, padding: '4px 8px', fontWeight: 700, cursor: 'pointer' }}>Use →</button>
                        <button onClick={(ev) => { ev.stopPropagation(); setDeliverEwb(ewb); }}
                          style={{ fontSize: 10, color: '#fff', background: ewb.status === 'at_destination' ? '#16a34a' : '#166534', border: 'none', borderRadius: 6, padding: '4px 8px', fontWeight: 700, cursor: 'pointer' }}>✅ Deliver</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Saved Trips */}
              {trips.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>🚛 Saved Trips ({trips.length})</div>
                  {trips.map(trip => {
                    const total = [trip.exp_admin, trip.exp_munshi, trip.exp_pump_consignment, trip.exp_cash_fuel, trip.exp_unloading, trip.exp_driver_debit, trip.exp_other].reduce((s, v) => s + (parseFloat(v) || 0), 0);
                    return (
                      <div key={trip.id} onClick={() => openEdit(trip)}
                        style={{ background: '#1e293b', borderRadius: 8, padding: '10px 12px', marginBottom: 8, border: '1px solid #334155', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>{trip.trip_no}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                            <span style={{ fontSize: 10, color: '#64748b' }}>{trip.trip_date}</span>
                            {(() => {
                              const ps = PROCESS_STEPS.find(s => s.key === (trip.process_step || 'loading'));
                              return ps ? <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: ps.color + '22', color: ps.color, fontWeight: 800, border: `1px solid ${ps.color}55` }}>{ps.label}</span> : null;
                            })()}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#a3e635' }}>{trip.from_poi_name || '?'} → {trip.to_poi_name || '?'}</div>
                        {(() => {
                          const ewbList = (() => { try { const a=JSON.parse(trip.ewb_nos||'[]'); return a.length>0?a:(trip.ewb_no?[trip.ewb_no]:[]); } catch{return trip.ewb_no?[trip.ewb_no]:[];} })();
                          return ewbList.length > 0 ? (
                            <div style={{ marginTop: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {ewbList.map(n => <span key={n} style={{ fontSize: 10, color: trip.ewb_is_temp ? '#fbbf24' : '#64748b', background: '#0f172a', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>📄 {n}</span>)}
                            </div>
                          ) : null;
                        })()}
                        {total > 0 && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4, fontWeight: 700 }}>Total Exp: ₹{total.toLocaleString('en-IN')}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
              {trips.length === 0 && <Empty msg="No trips for this vehicle yet" sub="Click + New Trip or tap an E-Way Bill above" />}
            </>
          )
        )}
      </div>
    </div>
    {deliverEwb && (
      <MunshiDeliverModal ewb={deliverEwb} munshi={munshi} onClose={() => setDeliverEwb(null)}
        onDone={(ewbNo) => {
          setDeliverEwb(null);
          setEwbs(prev => prev.filter(e => e.ewb_no !== ewbNo));
          setPoiEwbs(prev => prev.filter(e => e.ewb_no !== ewbNo));
        }} />
    )}
    </>
  );
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────
function ExpensesTab({ munshi, vehicles }) {
  const [allTrips, setAllTrips] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [vFilter,  setVFilter]  = useState('');

  useEffect(() => {
    if (!munshi) return;
    setLoading(true);
    fetch(`${API}/munshi-trips?clientId=CLIENT_001&munshiId=${encodeURIComponent(munshi.id)}`)
      .then(r => r.json())
      .then(d => setAllTrips(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [munshi]);

  if (loading) return <Spinner />;

  const filtered = vFilter ? allTrips.filter(t => t.vehicle_no === vFilter) : allTrips;
  const sum = k => filtered.reduce((s, t) => s + (parseFloat(t[k]) || 0), 0);
  const tots = {
    munshi: sum('exp_munshi'), pump: sum('exp_pump_consignment'),
    cash: sum('exp_cash_fuel'), unload: sum('exp_unloading'),
    toll: sum('toll'), other: sum('exp_other'),
  };
  tots.total = tots.munshi + tots.pump + tots.cash + tots.unload + tots.toll + tots.other;

  const byVehicle = {};
  filtered.forEach(t => {
    if (!byVehicle[t.vehicle_no]) byVehicle[t.vehicle_no] = { trips:0, munshi:0, pump:0, cash:0, unload:0, toll:0, other:0 };
    const b = byVehicle[t.vehicle_no];
    b.trips++;
    b.munshi += parseFloat(t.exp_munshi)||0;   b.pump   += parseFloat(t.exp_pump_consignment)||0;
    b.cash   += parseFloat(t.exp_cash_fuel)||0; b.unload += parseFloat(t.exp_unloading)||0;
    b.toll   += parseFloat(t.toll)||0;          b.other  += parseFloat(t.exp_other)||0;
  });
  const vList = Object.entries(byVehicle).sort((a, b) => {
    const totA = a[1].munshi+a[1].pump+a[1].cash+a[1].unload+a[1].toll+a[1].other;
    const totB = b[1].munshi+b[1].pump+b[1].cash+b[1].unload+b[1].toll+b[1].other;
    return totB - totA;
  });

  const fmtN = n => n > 0 ? '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—';

  return (
    <div style={{ padding: '16px 20px' }}>
      <select value={vFilter} onChange={e => setVFilter(e.target.value)}
        style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid #334155', background:'#1e293b', color:'#f1f5f9', fontSize:12, marginBottom:16, boxSizing:'border-box' }}>
        <option value="">All Vehicles ({allTrips.length} trips)</option>
        {Object.keys(byVehicle).map(vno => (
          <option key={vno} value={vno}>{vno} ({byVehicle[vno].trips} trips)</option>
        ))}
      </select>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:14 }}>
        {[
          ['Munshi Exp',  tots.munshi,  '#f59e0b'],
          ['Pump Fuel',   tots.pump,    '#ef4444'],
          ['Cash Fuel',   tots.cash,    '#f97316'],
          ['Unloading',   tots.unload,  '#8b5cf6'],
          ['Toll',        tots.toll,    '#0ea5e9'],
          ['Other',       tots.other,   '#64748b'],
        ].map(([lbl, val, clr]) => (
          <div key={lbl} style={{ background:'#1e293b', border:'1px solid #334155', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:10, color:'#64748b', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>{lbl}</div>
            <div style={{ fontWeight:900, fontSize:18, color:clr }}>{fmtN(val)}</div>
          </div>
        ))}
      </div>

      <div style={{ background:'linear-gradient(135deg,#1e3a8a,#1d4ed8)', borderRadius:12, padding:'14px 18px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:13, color:'#93c5fd', fontWeight:700 }}>TOTAL EXPENSES</div>
        <div style={{ fontSize:22, fontWeight:900, color:'#fff' }}>{fmtN(tots.total)}</div>
      </div>

      {!vFilter && vList.length > 0 && (
        <div>
          <div style={{ fontSize:11, color:'#64748b', fontWeight:800, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.08em' }}>Per Vehicle</div>
          {vList.map(([vno, d]) => {
            const tot = d.munshi + d.pump + d.cash + d.unload + d.toll + d.other;
            return (
              <div key={vno} style={{ background:'#1e293b', borderRadius:8, padding:'10px 14px', marginBottom:8, border:'1px solid #334155' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontFamily:'monospace', fontSize:13, color:'#60a5fa', fontWeight:900 }}>{vno}</span>
                  <span style={{ fontSize:11, color:'#64748b' }}>{d.trips} trip{d.trips !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', fontSize:11 }}>
                  {d.munshi > 0  && <span style={{ color:'#f59e0b' }}>Munshi {fmtN(d.munshi)}</span>}
                  {d.pump > 0    && <span style={{ color:'#ef4444' }}>Pump {fmtN(d.pump)}</span>}
                  {d.cash > 0    && <span style={{ color:'#f97316' }}>Cash {fmtN(d.cash)}</span>}
                  {d.unload > 0  && <span style={{ color:'#8b5cf6' }}>Unload {fmtN(d.unload)}</span>}
                  {d.toll > 0    && <span style={{ color:'#0ea5e9' }}>Toll {fmtN(d.toll)}</span>}
                  {d.other > 0   && <span style={{ color:'#64748b' }}>Other {fmtN(d.other)}</span>}
                </div>
                <div style={{ marginTop:6, fontSize:12, fontWeight:700, color:'#f59e0b' }}>Total: {fmtN(tot)}</div>
              </div>
            );
          })}
        </div>
      )}

      {allTrips.length === 0 && <Empty msg="No trips recorded yet" sub="Create trips from the Trips tab" />}
    </div>
  );
}

// ─── Vehicles Tab ─────────────────────────────────────────────────────────────
function VehiclesTab({ munshi, vehicles }) {
  const myVehicles = vehicles.filter(v =>
    // Vehicles specifically assigned to this munshi
    (v.munshi_id && String(v.munshi_id) === String(munshi.id)) ||
    (v.munshi_name || '').toLowerCase() === (munshi.name || '').toLowerCase() ||
    // Vehicles assigned as Common (visible to all munshis)
    (v.munshi_name || '').toLowerCase() === 'common' ||
    (!v.munshi_id && !v.munshi_name)
  );

  const commonVehicles = myVehicles.filter(v =>
    (v.munshi_name || '').toLowerCase() === 'common' || (!v.munshi_id && !v.munshi_name)
  );
  const myOwnVehicles = myVehicles.filter(v =>
    (v.munshi_name || '').toLowerCase() !== 'common' && (v.munshi_id || v.munshi_name)
  );

  const STATUS_COLORS = {
    'Active':       { dot: '#22c55e', label: '● Active' },
    'Slow (Moving)':{ dot: '#f59e0b', label: '● Moving' },
    'Stopped':      { dot: '#3b82f6', label: '● Stopped' },
    'Offline':      { dot: '#475569', label: '● Offline' },
  };

  if (!myVehicles.length) return (
    <div style={{ padding: '16px 20px' }}>
      <Empty msg="No vehicles assigned to you yet" sub="Admin can assign vehicles via Vehicles tab" />
    </div>
  );

  return (
    <div style={{ padding: '16px 20px' }}>
      {myOwnVehicles.length > 0 && (
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 700 }}>📋 Your Vehicles ({myOwnVehicles.length})</div>
      )}
      {myOwnVehicles.map(v => renderVehicleCard(v, STATUS_COLORS))}

      {commonVehicles.length > 0 && (
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, marginTop: myOwnVehicles.length ? 16 : 0, fontWeight: 700 }}>🔄 Common Vehicles ({commonVehicles.length})</div>
      )}
      {commonVehicles.map(v => renderVehicleCard(v, STATUS_COLORS))}
    </div>
  );

  function renderVehicleCard(v, STATUS_COLORS) {
    const statusKey = Object.keys(STATUS_COLORS).find(k => (v.status || '').includes(k)) || 'Offline';
    const sc = STATUS_COLORS[statusKey] || STATUS_COLORS.Offline;
    return (
      <div key={v.vehicle_no} style={{ background: '#1e293b', borderRadius: 12, padding: '14px 16px', marginBottom: 10, border: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 17, color: '#60a5fa' }}>{v.vehicle_no}</div>
          <div style={{ fontSize: 12, color: sc.dot, fontWeight: 600 }}>{sc.label}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', fontSize: 12 }}>
          <Kv label="Size"   val={fmtSize(v.vehicle_size)} />
          <Kv label="Fuel"   val={v.fuel_type || '—'} color={v.fuel_type === 'Diesel' ? '#f59e0b' : v.fuel_type === 'CNG' ? '#4ade80' : '#94a3b8'} />
          <Kv label="Driver" val={v.driver_name || '—'} color="#a3e635" />
          <Kv label="KMPL"   val={v.kmpl ? `${v.kmpl} km/L` : '—'} />
        </div>
      </div>
    );
  }
}

function fmtSize(s) {
  if (!s) return '—';
  if (s.includes('32ft') || s.includes('category_1')) return '32/34 FT';
  if (s.includes('22ft') || s.includes('category_2')) return '22/24 FT';
  if (s.includes('small') || s.includes('category_3')) return 'Small';
  return s;
}

// ─── Ledger Tab ───────────────────────────────────────────────────────────────
function LedgerTab({ munshi }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!munshi) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API}/ledger/munshi?munshiId=${encodeURIComponent(munshi.id)}`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [munshi]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;

  const totAdv  = entries.reduce((s,e) => s + num(e.advance_given),    0);
  const totFuel = entries.reduce((s,e) => s + num(e.fuel_cost),         0);
  const totToll = entries.reduce((s,e) => s + num(e.toll_charges),      0);
  const totUnl  = entries.reduce((s,e) => s + num(e.unloading_charges), 0);
  const totSet  = entries.reduce((s,e) => s + num(e.settlement),        0);

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatBox label="Advance"   val={fmt(totAdv)}  color="#f59e0b" />
        <StatBox label="Fuel"      val={fmt(totFuel)} color="#ef4444" />
        <StatBox label="Toll"      val={fmt(totToll)} color="#8b5cf6" />
        <StatBox label="Unload"    val={fmt(totUnl)}  color="#0ea5e9" />
        <StatBox label="Settlement" val={fmt(Math.abs(totSet))}
          color={totSet >= 0 ? '#ef4444' : '#22c55e'}
          sub={totSet >= 0 ? 'To Pay' : 'To Receive'} />
      </div>

      {entries.length === 0 ? (
        <Empty msg="No ledger entries yet" />
      ) : entries.map((e, i) => (
        <div key={e.id || i} style={{ background: '#1e293b', borderRadius: 10, padding: '12px 14px', marginBottom: 8, border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', fontFamily: 'monospace' }}>{e.trip_id || 'Entry'}</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{fmtDate(e.trip_date)}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
            {num(e.advance_given) > 0     && <Pill label="Adv"    val={fmt(e.advance_given)}    color="#f59e0b" />}
            {num(e.fuel_cost) > 0         && <Pill label="Fuel"   val={fmt(e.fuel_cost)}         color="#ef4444" />}
            {num(e.toll_charges) > 0      && <Pill label="Toll"   val={fmt(e.toll_charges)}      color="#8b5cf6" />}
            {num(e.unloading_charges) > 0 && <Pill label="Unload" val={fmt(e.unloading_charges)} color="#0ea5e9" />}
            {num(e.settlement) !== 0      && <Pill label="Settled" val={fmt(e.settlement)}       color="#22c55e" />}
          </div>
          {e.vehicle_number && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>🚛 {e.vehicle_number}</div>}
          {e.notes && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>📝 {e.notes}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── Micro helpers ────────────────────────────────────────────────────────────
function StatBox({ label, val, color, sub }) {
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 20, color: color || '#f1f5f9' }}>{val}</div>
      {sub && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function Kv({ label, val, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 1, fontWeight: 600 }}>{label}</div>
      <div style={{ fontWeight: 700, color: color || '#cbd5e1', fontSize: 13 }}>{val || '—'}</div>
    </div>
  );
}
function Pill({ label, val, color }) {
  return (
    <span style={{ background: color + '22', color, borderRadius: 8, padding: '2px 8px', fontWeight: 700, fontSize: 11 }}>
      {label}: {val}
    </span>
  );
}
function Spinner() {
  return <div style={{ padding: 50, textAlign: 'center', color: '#475569' }}>⏳ Loading…</div>;
}
function Empty({ msg, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '50px 20px', color: '#475569' }}>
      <div style={{ fontSize: 42, marginBottom: 10 }}>📋</div>
      <div style={{ color: '#64748b', fontWeight: 600 }}>{msg}</div>
      {sub && <div style={{ fontSize: 12, marginTop: 6, color: '#475569' }}>{sub}</div>}
    </div>
  );
}

// ─── Reports Tab (driver issues visible to munshi) ───────────────────────────
function ReportsTab({ munshi, vehicles }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState('open'); // 'open' | 'all'

  const myVehicleNos = new Set(vehicles.filter(v =>
    (v.munshi_id && String(v.munshi_id) === String(munshi.id)) ||
    (v.munshi_name || '').toLowerCase() === (munshi.name || '').toLowerCase() ||
    (v.munshi_name || '').toLowerCase() === 'common' ||
    (!v.munshi_id && !v.munshi_name)
  ).map(v => v.vehicle_no));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/driver/reports`);
      const data = await res.json();
      const all  = Array.isArray(data) ? data : [];
      setReports(all.filter(r => myVehicleNos.has(r.vehicle_no)));
    } catch { setReports([]); }
    setLoading(false);
  }, [munshi.id, vehicles.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;

  const openCount = reports.filter(r => r.status !== 'resolved').length;
  const filtered  = filter === 'open' ? reports.filter(r => r.status !== 'resolved') : reports;

  return (
    <div style={{ padding: '16px 20px', maxWidth: 520, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        {[['open', `Open (${openCount})`], ['all', `All (${reports.length})`]].map(([f, lbl]) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ fontSize: 11, padding: '4px 12px', borderRadius: 10, border: 'none', background: filter === f ? '#dc2626' : '#1e293b', color: filter === f ? '#fff' : '#64748b', cursor: 'pointer', fontWeight: filter === f ? 700 : 400 }}>
            {lbl}
          </button>
        ))}
        <button onClick={load} style={{ marginLeft: 'auto', background: '#1e293b', border: '1px solid #334155', color: '#64748b', borderRadius: 7, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>🔄</button>
      </div>

      {filtered.length === 0 ? (
        <Empty msg={filter === 'open' ? 'No open issues — all clear! ✅' : 'No reports filed yet'} sub="Driver reports will appear here" />
      ) : filtered.map((r, i) => (
        <div key={r.id || i} style={{ background: '#1e293b', borderRadius: 10, padding: '12px 14px', marginBottom: 10, border: `1px solid ${r.admin_reply ? '#334155' : '#7f1d1d'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#f87171' }}>{r.issue_type}</span>
              {r.vehicle_no && <span style={{ fontSize: 11, color: '#60a5fa', marginLeft: 8, fontFamily: 'monospace' }}>🚛 {r.vehicle_no}</span>}
            </div>
            <span style={{ fontSize: 10, color: r.admin_reply ? '#4ade80' : '#f59e0b', fontWeight: 700, background: r.admin_reply ? '#14532d' : '#78350f', padding: '2px 7px', borderRadius: 10 }}>
              {r.admin_reply ? '✅ Replied' : '⏳ Open'}
            </span>
          </div>
          {r.driver_name && <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>👤 {r.driver_name}</div>}
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, marginBottom: r.admin_reply ? 8 : 0 }}>{r.description}</div>
          {r.admin_reply && (
            <div style={{ background: '#0f172a', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#4ade80', borderLeft: '3px solid #16a34a' }}>
              📋 Admin: {r.admin_reply}
            </div>
          )}
          <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>
            {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main MunshiPortal ────────────────────────────────────────────────────────
const SESSION_KEY = 'munshiPortal_session';
const TABS = [
  { key: 'trips',    label: '🚛 Trips'    },
  { key: 'routing',  label: '🗺️ Routing'  },
  { key: 'expenses', label: '💰 Expenses' },
  { key: 'vehicles', label: '🚗 Vehicles' },
  { key: 'ledger',   label: '📒 Ledger'   },
  { key: 'reports',  label: '🚨 Issues'   },
];

export default function MunshiPortal() {
  const [munshi,   setMunshi]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; }
    catch { return null; }
  });
  const [vehicles, setVehicles] = useState([]);
  const [pois,     setPois]     = useState([]);
  const [tab,      setTab]      = useState('trips');
  const [tripPrefill, setTripPrefill] = useState(null);
  const intervalRef = useRef(null);

  function handleLogin(m) {
    setMunshi(m);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(m));
    setTab('trips');
  }
  function handleLogout() {
    setMunshi(null);
    sessionStorage.removeItem(SESSION_KEY);
  }

  // Load vehicles
  useEffect(() => {
    if (!munshi) return;
    fetch(`${API}/vehicles-master?clientId=CLIENT_001`)
      .then(r => r.json())
      .then(d => setVehicles(Array.isArray(d) ? d : (d.vehicles || [])))
      .catch(() => {});
    fetch(`${API}/pois?clientId=CLIENT_001`)
      .then(r => r.json())
      .then(d => setPois(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [munshi]);

  if (!munshi) return <PinLogin onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', maxWidth: ['trips','routing'].includes(tab) ? '100%' : 520, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', padding: '14px 20px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', letterSpacing: '0.05em' }}>👨‍💼 MUNSHI PORTAL</div>
          <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 2 }}>
            {munshi.name}{munshi.area ? ` · ${munshi.area}` : ''}
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
        >🔒 Logout</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', background: '#1e293b', borderBottom: '2px solid #334155', position: 'sticky', top: 58, zIndex: 40 }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1, padding: '12px 4px',
              background: 'transparent', border: 'none',
              borderBottom: tab === key ? '3px solid #3b82f6' : '3px solid transparent',
              color: tab === key ? '#60a5fa' : '#64748b',
              fontWeight: tab === key ? 800 : 500,
              fontSize: 12, cursor: 'pointer',
            }}
          >{label}</button>
        ))}
      </div>

      {/* Content */}
      {tab === 'trips'    && <TripsTab    munshi={munshi} vehicles={vehicles} pois={pois} tripPrefill={tripPrefill} onPrefillDone={() => setTripPrefill(null)} />}
      {tab === 'routing'  && <RoutingTab  munshi={munshi} vehicles={vehicles} pois={pois} onGoToTrip={p => { setTripPrefill(p); setTab('trips'); }} />}
      {tab === 'expenses' && <ExpensesTab munshi={munshi} vehicles={vehicles} />}
      {tab === 'vehicles' && <VehiclesTab munshi={munshi} vehicles={vehicles} />}
      {tab === 'ledger'   && <LedgerTab   munshi={munshi} />}
      {tab === 'reports'  && <ReportsTab  munshi={munshi} vehicles={vehicles} />}
    </div>
  );
}
