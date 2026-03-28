import { useState, useEffect, useCallback, useRef } from 'react';

const API = '/api';

const STATUS_CFG = {
  started:    { label: 'Dispatched',    color: '#2563eb', bg: '#dbeafe',  icon: '🔵', btnLabel: '🚀 Start Journey',    btnColor: '#2563eb', next: 'in_transit' },
  in_transit: { label: 'En Route',      color: '#d97706', bg: '#fef3c7',  icon: '🟡', btnLabel: '📦 Mark Unloading',   btnColor: '#d97706', next: 'unloading'  },
  unloading:  { label: 'Unloading',     color: '#7c3aed', bg: '#ede9fe',  icon: '🟣', btnLabel: '✅ Mark Completed',   btnColor: '#16a34a', next: 'completed'  },
  completed:  { label: 'Completed',     color: '#16a34a', bg: '#dcfce7',  icon: '🟢', btnLabel: null, next: null },
  cancelled:  { label: 'Cancelled',     color: '#dc2626', bg: '#fee2e2',  icon: '🔴', btnLabel: null, next: null },
};

function num(v) { return parseFloat(v) || 0; }
function fmt(v) { return '₹' + num(v).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

// ─── Stop item ───────────────────────────────────────────────────────────────
function StopRow({ stop, index, tripActive, onArrived }) {
  const done = stop.stop_status === 'arrived' || stop.stop_status === 'completed';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px',
      background: done ? '#14532d22' : '#0f172a',
      borderRadius: 10, marginBottom: 8,
      border: `1px solid ${done ? '#16a34a55' : '#334155'}`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: done ? '#16a34a' : '#1e3a8a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800, color: '#fff',
      }}>
        {done ? '✓' : index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: done ? '#4ade80' : '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {stop.poi_name || `Stop ${index + 1}`}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          {stop.stop_type || 'delivery'}
          {stop.arrived_at && ` · ${fmtDate(stop.arrived_at)}`}
        </div>
      </div>
      {!done && tripActive && (
        <button onClick={() => onArrived(stop)} style={{
          background: '#1d4ed8', border: 'none', borderRadius: 8,
          padding: '8px 14px', color: '#fff', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}>Arrived</button>
      )}
      {done && <span style={{ color: '#4ade80', fontSize: 18 }}>✓</span>}
    </div>
  );
}

// ─── Trip card ────────────────────────────────────────────────────────────────
function ActiveTripCard({ trip, stops, onStatusUpdate, onStopArrived, updating }) {
  const cfg = STATUS_CFG[trip.status] || STATUS_CFG.started;
  const tripActive = trip.status !== 'completed' && trip.status !== 'cancelled';
  const doneStops = stops.filter(s => s.stop_status === 'arrived' || s.stop_status === 'completed').length;

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Status banner */}
      <div style={{
        background: cfg.bg, border: `2px solid ${cfg.color}`,
        borderRadius: 16, padding: '18px 20px', marginBottom: 16, textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>{cfg.icon}</div>
        <div style={{ fontWeight: 900, fontSize: 22, color: cfg.color, letterSpacing: '0.04em' }}>{cfg.label}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>#{trip.job_card_number}</div>
      </div>

      {/* Info grid */}
      <div style={{ background: '#1e293b', borderRadius: 14, padding: '16px 18px', marginBottom: 14, border: '1px solid #334155' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Info label="Date" val={fmtDate(trip.job_card_date || trip.created_at)} />
          <Info label="Vehicle" val={trip.vehicle_number} color="#60a5fa" />
          <Info label="Driver" val={trip.driver_name || '—'} color="#a3e635" />
          <Info label="Munshi" val={trip.munshi_name || '—'} color="#a78bfa" />
          {stops.length > 0 && (
            <div style={{ gridColumn: '1/-1' }}>
              <Info label="Stops Done" val={`${doneStops} / ${stops.length}`} color={doneStops === stops.length ? '#4ade80' : '#f59e0b'} />
            </div>
          )}
          {trip.notes && (
            <div style={{ gridColumn: '1/-1', background: '#0f172a', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>📝 Notes from Munshi</div>
              <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{trip.notes}</div>
            </div>
          )}
        </div>
      </div>

      {/* Delivery stops */}
      {stops.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingLeft: 4 }}>
            📍 Delivery Stops ({doneStops}/{stops.length})
          </div>
          {stops.map((s, i) => (
            <StopRow key={s.id} stop={s} index={i} tripActive={tripActive} onArrived={onStopArrived} />
          ))}
        </div>
      )}

      {/* Big action button */}
      {cfg.btnLabel && (
        <button
          onClick={() => onStatusUpdate(cfg.next)}
          disabled={updating}
          style={{
            width: '100%', padding: '20px', marginBottom: 12,
            background: updating ? '#334155' : `linear-gradient(135deg, ${cfg.btnColor} 0%, ${cfg.btnColor}cc 100%)`,
            border: 'none', borderRadius: 16, color: '#fff',
            fontSize: 18, fontWeight: 900, cursor: updating ? 'not-allowed' : 'pointer',
            boxShadow: updating ? 'none' : `0 6px 24px ${cfg.btnColor}55`,
            transition: 'all 0.2s', letterSpacing: '0.04em',
          }}
        >
          {updating ? '⏳ Updating...' : cfg.btnLabel}
        </button>
      )}

      {trip.status === 'completed' && (
        <div style={{ textAlign: 'center', padding: 24, color: '#4ade80', fontWeight: 900, fontSize: 20 }}>
          🎉 Trip Completed — Great work!
        </div>
      )}
    </div>
  );
}

function Info({ label, val, color }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2, fontWeight: 700 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 15, color: color || '#f1f5f9' }}>{val || '—'}</div>
    </div>
  );
}

// ─── Pay tab ──────────────────────────────────────────────────────────────────
function PayTab({ ledger }) {
  const totAdv   = ledger.reduce((s, e) => s + num(e.advance_given),    0);
  const totFuel  = ledger.reduce((s, e) => s + num(e.fuel_cost),         0);
  const totToll  = ledger.reduce((s, e) => s + num(e.toll_charges),      0);
  const totUnl   = ledger.reduce((s, e) => s + num(e.unloading_charges), 0);
  const totSet   = ledger.reduce((s, e) => s + num(e.settlement),        0);

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          ['Advance',    totAdv,  '#f59e0b'],
          ['Fuel',       totFuel,  '#ef4444'],
          ['Toll',       totToll,  '#8b5cf6'],
          ['Unloading',  totUnl,   '#0ea5e9'],
          ['Settlement', totSet,   '#22c55e'],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background: '#1e293b', borderRadius: 12, padding: '14px 16px', border: '1px solid #334155' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>{label}</div>
            <div style={{ fontWeight: 900, fontSize: 20, color }}>{fmt(val)}</div>
          </div>
        ))}
      </div>

      {ledger.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#475569', fontSize: 13 }}>No pay records yet</div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Transaction History</div>
          {ledger.map((e, i) => (
            <div key={e.id || i} style={{ background: '#1e293b', borderRadius: 10, padding: '12px 14px', marginBottom: 8, border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>{e.trip_id || e.settlement_status || 'Entry'}</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>{fmtDate(e.trip_date)}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12 }}>
                {num(e.advance_given) > 0  && <span style={{ color: '#f59e0b' }}>Adv: {fmt(e.advance_given)}</span>}
                {num(e.fuel_cost) > 0      && <span style={{ color: '#ef4444' }}>Fuel: {fmt(e.fuel_cost)}</span>}
                {num(e.toll_charges) > 0   && <span style={{ color: '#8b5cf6' }}>Toll: {fmt(e.toll_charges)}</span>}
                {num(e.settlement) > 0     && <span style={{ color: '#22c55e', fontWeight: 700 }}>Settled: {fmt(e.settlement)}</span>}
              </div>
              {e.notes && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{e.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── History tab ──────────────────────────────────────────────────────────────
function HistoryTab({ trips }) {
  if (!trips.length) return (
    <div style={{ textAlign: 'center', padding: 50, color: '#475569' }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
      <div>No trips found</div>
    </div>
  );
  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>{trips.length} total trips</div>
      {trips.map(trip => {
        const cfg = STATUS_CFG[trip.status] || STATUS_CFG.started;
        return (
          <div key={trip.id} style={{ background: '#1e293b', borderRadius: 10, padding: '14px 16px', marginBottom: 10, border: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#60a5fa' }}>{trip.job_card_number}</div>
              <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                {cfg.icon} {cfg.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>📅 {fmtDate(trip.job_card_date || trip.created_at)}</div>
            {trip.munshi_name && <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 2 }}>👨‍💼 {trip.munshi_name}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── PIN Login Screen ─────────────────────────────────────────────────────────
function DriverPinLogin({ onLogin }) {
  const [vehicleNo, setVehicleNo] = useState('');
  const [pin,       setPin]       = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const pinRef = useRef(null);

  async function handleLogin() {
    if (!vehicleNo.trim()) { setError('Enter your vehicle number'); return; }
    if (pin.length < 4)    { setError('PIN must be at least 4 digits'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API}/vehicles/driver-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_no: vehicleNo.trim().toUpperCase(), pin, client_id: 'CLIENT_001' }),
      });
      const data = await res.json();
      if (data.success && data.vehicle) {
        onLogin(data.vehicle);
      } else {
        setError('❌ Wrong vehicle number or PIN');
        setPin('');
        pinRef.current?.focus();
      }
    } catch { setError('Network error. Try again.'); }
    finally { setLoading(false); }
  }

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>🚛</div>
        <div style={{ fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: '0.06em' }}>DRIVER PORTAL</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>Atul Logistics — Enter vehicle & PIN</div>
      </div>

      {/* Vehicle number input */}
      <input
        type="text"
        placeholder="Vehicle Number (e.g. HR69E0353)"
        value={vehicleNo}
        onChange={e => { setVehicleNo(e.target.value.toUpperCase()); setError(''); }}
        onKeyDown={e => e.key === 'Enter' && pinRef.current?.focus()}
        style={{
          width: '100%', maxWidth: 280, padding: '14px 16px',
          background: '#1e293b', border: `2px solid ${vehicleNo ? '#3b82f6' : '#334155'}`,
          borderRadius: 12, color: '#f1f5f9', fontSize: 16, fontWeight: 700,
          outline: 'none', textAlign: 'center', letterSpacing: '0.1em',
          marginBottom: 20, boxSizing: 'border-box',
        }}
      />

      {/* PIN dots */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: '50%',
            background: i < pin.length ? '#3b82f6' : '#1e293b',
            border: `2px solid ${i < pin.length ? '#3b82f6' : '#334155'}`,
            transition: 'all 0.15s',
          }} />
        ))}
      </div>

      {/* Hidden input for keyboard support */}
      <input ref={pinRef} type="password" inputMode="numeric" value={pin}
        onChange={e => { setPin(e.target.value.replace(/\D/g,'').slice(0,6)); setError(''); }}
        onKeyDown={e => e.key === 'Enter' && handleLogin()}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
      />

      {/* PIN pad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 10, marginBottom: 16 }}>
        {digits.map((d, i) => (
          <button key={i} onClick={() => {
            if (d === '⌫') { setPin(p => p.slice(0,-1)); setError(''); }
            else if (d !== '') { setPin(p => p.length < 6 ? p + d : p); setError(''); }
          }} style={{
            height: 72, borderRadius: 14,
            background: d === '' ? 'transparent' : '#1e293b',
            border: d === '' ? 'none' : '1px solid #334155',
            color: d === '⌫' ? '#f87171' : '#f1f5f9',
            fontSize: d === '⌫' ? 22 : 24, fontWeight: 700,
            cursor: d === '' ? 'default' : 'pointer',
            visibility: d === '' ? 'hidden' : 'visible',
          }}
            onMouseDown={e => { if (d) e.currentTarget.style.background = '#334155'; }}
            onMouseUp={e => { e.currentTarget.style.background = '#1e293b'; }}
          >{d}</button>
        ))}
      </div>

      {error && <div style={{ color: '#f87171', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</div>}

      <button onClick={handleLogin} disabled={loading || pin.length < 4 || !vehicleNo.trim()} style={{
        width: '100%', maxWidth: 240, padding: 16,
        background: (pin.length >= 4 && vehicleNo.trim()) ? 'linear-gradient(135deg,#1d4ed8,#2563eb)' : '#1e293b',
        border: 'none', borderRadius: 14, color: '#fff',
        fontSize: 16, fontWeight: 800, cursor: (pin.length >= 4 && vehicleNo.trim()) ? 'pointer' : 'not-allowed',
        boxShadow: (pin.length >= 4 && vehicleNo.trim()) ? '0 4px 20px #2563eb55' : 'none',
      }}>{loading ? '⏳ Checking...' : '🔓 Login'}</button>
    </div>
  );
}

// ─── Main DriverPage ──────────────────────────────────────────────────────────
const SESSION_KEY = 'driverPortal_session';

export default function DriverPage() {
  const [vehicle,   setVehicle]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; }
    catch { return null; }
  });
  const [trips,     setTrips]     = useState([]);
  const [stops,     setStops]     = useState([]);
  const [ledger,    setLedger]    = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [updating,  setUpdating]  = useState(false);
  const [tab,       setTab]       = useState('trip');
  const intervalRef = useRef(null);

  function handleLogin(v) {
    setVehicle(v);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(v));
    setTab('trip');
  }
  function handleLogout() {
    setVehicle(null);
    sessionStorage.removeItem(SESSION_KEY);
    setTrips([]); setStops([]); setLedger([]);
  }

  const selVehicle = vehicle?.vehicle_no || '';

  const load = useCallback(async (silent = false) => {
    if (!selVehicle) return;
    if (!silent) setLoading(true);
    try {
      const [tripRes, ledgerRes] = await Promise.all([
        fetch(`${API}/trip-dispatches?clientId=CLIENT_001`),
        fetch(`${API}/ledger/driver`),
      ]);
      const tripData  = await tripRes.json();
      const allTrips  = Array.isArray(tripData) ? tripData : (tripData.trips || []);
      const myTrips   = allTrips.filter(t => (t.vehicle_number || '').toUpperCase() === selVehicle.toUpperCase());
      const sorted    = myTrips.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setTrips(sorted);

      const ldData = await ledgerRes.json();
      setLedger((Array.isArray(ldData) ? ldData : []).filter(e =>
        (e.vehicle_number || '').toUpperCase() === selVehicle.toUpperCase()
      ));

      // Load stops for active trip
      const active = sorted.find(t => t.status !== 'completed' && t.status !== 'cancelled');
      if (active) {
        const stopsRes  = await fetch(`${API}/trip-dispatches/${encodeURIComponent(active.job_card_number)}/stops`);
        const stopsData = await stopsRes.json();
        setStops(stopsData.stops || []);
      } else {
        setStops([]);
      }
    } catch (e) { console.error(e); }
    finally { if (!silent) setLoading(false); }
  }, [selVehicle]);

  useEffect(() => {
    load();
    // Auto-refresh every 30s
    intervalRef.current = setInterval(() => load(true), 30000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  const updateTripStatus = async (newStatus) => {
    const active = trips.find(t => t.status !== 'completed' && t.status !== 'cancelled');
    if (!active) return;
    setUpdating(true);
    try {
      await fetch(`${API}/trip-dispatches/${encodeURIComponent(active.job_card_number)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      await load();
    } catch (e) { alert('Error: ' + e.message); }
    finally { setUpdating(false); }
  };

  const markStopArrived = async (stop) => {
    const active = trips.find(t => t.status !== 'completed' && t.status !== 'cancelled');
    if (!active) return;
    // Optimistic UI update
    setStops(prev => prev.map(s =>
      s.id === stop.id ? { ...s, stop_status: 'arrived', arrived_at: new Date().toISOString() } : s
    ));
    try {
      await fetch(`${API}/trip-dispatches/${encodeURIComponent(active.job_card_number)}/stops/${stop.id}/arrived`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stop_status: 'arrived', arrived_at: new Date().toISOString() }),
      });
    } catch (e) { console.error('Stop update failed', e); }
  };

  const activeTrip  = trips.find(t => t.status !== 'completed' && t.status !== 'cancelled');

  const TABS = [
    { key: 'trip',    label: '🚛 Active Trip' },
    { key: 'history', label: '📋 History'     },
    { key: 'pay',     label: '💰 My Pay'      },
  ];

  // ── Show PIN login if not logged in ────────────────────────────────────────
  if (!vehicle) return <DriverPinLogin onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)', padding: '14px 20px', display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 17, color: '#fff', letterSpacing: '0.05em' }}>🚛 DRIVER PORTAL</div>
          <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 2 }}>
            {selVehicle}{vehicle.driver_name ? ` · ${vehicle.driver_name}` : ''}{vehicle.munshi_name ? ` · 👨‍💼 ${vehicle.munshi_name}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => load()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '7px 12px', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>🔄</button>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>🔒</button>
        </div>
      </div>

      {loading && (
        <div style={{ padding: 60, textAlign: 'center', color: '#475569' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>Loading...
        </div>
      )}

      {!loading && (
        <>
          {/* Tab bar */}
          <div style={{ display: 'flex', background: '#1e293b', borderBottom: '2px solid #334155', position: 'sticky', top: 72, zIndex: 40 }}>
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  flex: 1, padding: '12px 4px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: tab === key ? '3px solid #3b82f6' : '3px solid transparent',
                  color: tab === key ? '#60a5fa' : '#64748b',
                  fontWeight: tab === key ? 800 : 500,
                  fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >{label}</button>
            ))}
          </div>

          {/* Active trip tab */}
          {tab === 'trip' && (
            <div style={{ padding: '16px 20px' }}>
              {!activeTrip ? (
                <div style={{ textAlign: 'center', padding: '50px 20px', color: '#475569' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>No active trip</div>
                  <div style={{ fontSize: 13 }}>Contact your munshi to assign a trip</div>
                  {trips.length > 0 && (
                    <button onClick={() => setTab('history')} style={{ marginTop: 16, background: '#1e3a8a', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#93c5fd', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      View Trip History →
                    </button>
                  )}
                </div>
              ) : (
                <ActiveTripCard
                  trip={activeTrip}
                  stops={stops}
                  updating={updating}
                  onStatusUpdate={updateTripStatus}
                  onStopArrived={markStopArrived}
                />
              )}
            </div>
          )}

          {tab === 'history' && <HistoryTab trips={trips} />}
          {tab === 'pay'     && <PayTab ledger={ledger} />}
        </>
      )}

      {/* Auto-refresh indicator */}
      <div style={{ position: 'fixed', bottom: 12, right: 12, background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: '4px 12px', fontSize: 10, color: '#64748b' }}>
        🔄 Auto-refresh 30s
      </div>
    </div>
  );
}
