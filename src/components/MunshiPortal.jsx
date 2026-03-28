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

const STATUS_CFG = {
  started:    { label: 'Dispatched', color: '#2563eb', bg: '#1e3a8a22', icon: '🔵' },
  in_transit: { label: 'En Route',   color: '#d97706', bg: '#78350f22', icon: '🟡' },
  unloading:  { label: 'Unloading',  color: '#a78bfa', bg: '#4c1d9522', icon: '🟣' },
  completed:  { label: 'Completed',  color: '#4ade80', bg: '#14532d22', icon: '🟢' },
  cancelled:  { label: 'Cancelled',  color: '#f87171', bg: '#7f1d1d22', icon: '🔴' },
};

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
        onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0,6); setPin(v); setError(''); }}
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

// ─── Trips Tab ────────────────────────────────────────────────────────────────
function TripsTab({ munshi, vehicles }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!munshi) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API}/trip-dispatches?munshiId=${encodeURIComponent(munshi.id)}`);
      const data = await res.json();
      const rows  = Array.isArray(data) ? data : (data.trips || []);
      setTrips(rows.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [munshi]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;

  const active    = trips.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const completed = trips.filter(t => t.status === 'completed');

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatBox label="Total" val={trips.length} color="#60a5fa" />
        <StatBox label="Active" val={active.length} color="#f59e0b" />
        <StatBox label="Done" val={completed.length} color="#4ade80" />
      </div>

      {trips.length === 0 ? (
        <Empty msg="No trips dispatched yet" />
      ) : trips.map(trip => {
        const cfg = STATUS_CFG[trip.status] || STATUS_CFG.started;
        const vInfo = vehicles.find(v => v.vehicle_no === trip.vehicle_number);
        return (
          <div key={trip.id} style={{ background: '#1e293b', borderRadius: 12, padding: '14px 16px', marginBottom: 10, border: `1px solid ${cfg.color}33` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#60a5fa', fontWeight: 700 }}>{trip.job_card_number}</span>
              <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                {cfg.icon} {cfg.label}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', fontSize: 12 }}>
              <Kv label="Date"    val={fmtDate(trip.job_card_date || trip.created_at)} />
              <Kv label="Vehicle" val={trip.vehicle_number} color="#60a5fa" />
              <Kv label="Driver"  val={trip.driver_name || vInfo?.driver_name || '—'} color="#a3e635" />
              {trip.notes && <div style={{ gridColumn: '1/-1', fontSize: 11, color: '#64748b', background: '#0f172a', borderRadius: 6, padding: '6px 8px', marginTop: 4 }}>
                📝 {trip.notes}
              </div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Vehicles Tab ─────────────────────────────────────────────────────────────
function VehiclesTab({ munshi, vehicles }) {
  const myVehicles = vehicles.filter(v =>
    v.munshi_id && String(v.munshi_id) === String(munshi.id) ||
    (v.munshi_name || '').toLowerCase() === (munshi.name || '').toLowerCase()
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
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>{myVehicles.length} vehicles assigned to you</div>
      {myVehicles.map(v => {
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
      })}
    </div>
  );
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

// ─── Main MunshiPortal ────────────────────────────────────────────────────────
const SESSION_KEY = 'munshiPortal_session';
const TABS = [
  { key: 'trips',    label: '🚛 Trips'    },
  { key: 'vehicles', label: '🚗 Vehicles' },
  { key: 'ledger',   label: '💰 Ledger'   },
];

export default function MunshiPortal() {
  const [munshi,   setMunshi]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; }
    catch { return null; }
  });
  const [vehicles, setVehicles] = useState([]);
  const [tab,      setTab]      = useState('trips');
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
  }, [munshi]);

  if (!munshi) return <PinLogin onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', maxWidth: 520, margin: '0 auto' }}>
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
      {tab === 'trips'    && <TripsTab    munshi={munshi} vehicles={vehicles} />}
      {tab === 'vehicles' && <VehiclesTab munshi={munshi} vehicles={vehicles} />}
      {tab === 'ledger'   && <LedgerTab   munshi={munshi} />}
    </div>
  );
}
