import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://kd-logistics-production.up.railway.app';
const API = API_BASE + '/api';

function num(v) { return parseFloat(v) || 0; }
function fmt(v) { return '₹' + num(v).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

// ─── Client Code + PIN Login ──────────────────────────────────────────────────
function ClientCodePinLogin({ onLogin }) {
  const [clientCode, setClientCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pinRef = useRef(null);

  async function handleLogin() {
    if (!clientCode.trim()) { setError('Enter your client code'); return; }
    if (pin.length < 3) { setError('PIN must be at least 3 digits'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/clients/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_code: clientCode.trim().toUpperCase(), pin }),
      });
      const data = await res.json();
      if (data.success && data.client) {
        onLogin(data.client);
      } else {
        setError('❌ Invalid code or PIN');
        setPin('');
        pinRef.current?.focus();
      }
    } catch {
      setError('Network error. Try again.');
    } finally { setLoading(false); }
  }

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>🏢</div>
        <div style={{ fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: '0.06em' }}>CLIENT PORTAL</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>Atul Logistics — Enter code & PIN</div>
      </div>

      {/* Client code input */}
      <input
        type="text"
        placeholder="Client Code (e.g., 001)"
        value={clientCode}
        onChange={e => { setClientCode(e.target.value.toUpperCase()); setError(''); }}
        onKeyDown={e => e.key === 'Enter' && pinRef.current?.focus()}
        style={{
          width: '100%', maxWidth: 280, padding: '14px 16px',
          background: '#1e293b', border: `2px solid ${clientCode ? '#3b82f6' : '#334155'}`,
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

      <button onClick={handleLogin} disabled={loading || pin.length < 3 || !clientCode.trim()} style={{
        width: '100%', maxWidth: 240, padding: 16,
        background: (pin.length >= 3 && clientCode.trim()) ? 'linear-gradient(135deg,#1d4ed8,#2563eb)' : '#1e293b',
        border: 'none', borderRadius: 14, color: '#fff',
        fontSize: 16, fontWeight: 800, cursor: (pin.length >= 3 && clientCode.trim()) ? 'pointer' : 'not-allowed',
        boxShadow: (pin.length >= 3 && clientCode.trim()) ? '0 4px 20px #2563eb55' : 'none',
      }}>{loading ? '⏳ Checking...' : '🔓 Login'}</button>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function DashboardPage({ client, vehicles, drivers }) {
  const S = {
    grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 28 },
    card: { background: '#1e293b', borderRadius: 14, padding: 24, border: '1px solid #334155' },
    statVal: { fontSize: 36, fontWeight: 900, marginBottom: 6, lineHeight: 1 },
    statLbl: { fontSize: 13, color: '#64748b', fontWeight: 600 },
    section: { background: '#1e293b', borderRadius: 14, border: '1px solid #334155', overflow: 'hidden', marginBottom: 24 },
    th: { padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #334155', background: '#0f172a', textAlign: 'left' },
    td: { padding: '12px 16px', fontSize: 13, color: '#e2e8f0', borderBottom: '1px solid #1e293b' },
  };
  const recent = [...vehicles].slice(0, 8);
  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>Welcome back, {client?.name}</h1>
        <p style={{ color: '#64748b', marginTop: 6, fontSize: 14 }}>Here's an overview of your fleet and operations.</p>
      </div>

      {/* Stat cards */}
      <div style={S.grid4}>
        {[
          { label: 'Total Vehicles', val: vehicles.length, color: '#60a5fa', icon: '🚛' },
          { label: 'Total Drivers', val: drivers.length, color: '#a3e635', icon: '👤' },
          { label: 'On Road', val: vehicles.filter(v => v.gps_status === 'ACTIVE' || v.status === 'ACTIVE').length, color: '#f59e0b', icon: '🛣️' },
          { label: 'Available Drivers', val: drivers.filter(d => !d.assigned_vehicle).length || drivers.length, color: '#34d399', icon: '✅' },
        ].map(({ label, val, color, icon }) => (
          <div key={label} style={S.card}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
            <div style={{ ...S.statVal, color }}>{val}</div>
            <div style={S.statLbl}>{label}</div>
          </div>
        ))}
      </div>

      {/* Recent vehicles */}
      <div style={S.section}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>Recent Vehicles</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>{vehicles.length} total</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Vehicle No', 'Type', 'Driver', 'Phone', 'Owner'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {recent.map((v, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#162032' }}>
                <td style={{ ...S.td, fontWeight: 700, color: '#60a5fa' }}>{v.vehicle_no || v.number || '—'}</td>
                <td style={S.td}>{v.vehicle_type || v.type || '—'}</td>
                <td style={S.td}>{v.driver_name || '—'}</td>
                <td style={S.td}>{v.phone || '—'}</td>
                <td style={S.td}>{v.owner_name || '—'}</td>
              </tr>
            ))}
            {!recent.length && <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: '#475569', padding: 32 }}>No vehicles found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Vehicles Page ────────────────────────────────────────────────────────────
function VehiclesPage({ vehicles }) {
  const [search, setSearch] = useState('');
  const S = {
    th: { padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #334155', background: '#0f172a', textAlign: 'left' },
    td: { padding: '13px 16px', fontSize: 13, color: '#e2e8f0', borderBottom: '1px solid #1e293b' },
  };
  const filtered = vehicles.filter(v =>
    !search ||
    (v.vehicle_no || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.driver_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.vehicle_type || '').toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>Vehicles</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{vehicles.length} vehicles registered</p>
        </div>
        <input
          placeholder="Search vehicle, driver..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '10px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9', fontSize: 13, width: 240, outline: 'none' }}
        />
      </div>
      <div style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['#', 'Vehicle No', 'Type', 'Driver Name', 'Phone', 'Owner', 'Added On'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((v, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#162032' }}>
                <td style={{ ...S.td, color: '#475569', width: 40 }}>{i + 1}</td>
                <td style={{ ...S.td, fontWeight: 700, color: '#60a5fa' }}>{v.vehicle_no || v.number || '—'}</td>
                <td style={S.td}><span style={{ background: '#1e3a5f', color: '#93c5fd', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{v.vehicle_type || v.type || '—'}</span></td>
                <td style={S.td}>{v.driver_name || '—'}</td>
                <td style={S.td}>{v.phone || '—'}</td>
                <td style={S.td}>{v.owner_name || '—'}</td>
                <td style={{ ...S.td, color: '#64748b' }}>{fmtDate(v.created_at)}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#475569', padding: 40 }}>No vehicles found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Drivers Page ─────────────────────────────────────────────────────────────
function DriversPage({ drivers }) {
  const [search, setSearch] = useState('');
  const S = {
    th: { padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #334155', background: '#0f172a', textAlign: 'left' },
    td: { padding: '13px 16px', fontSize: 13, color: '#e2e8f0', borderBottom: '1px solid #1e293b' },
  };
  const filtered = drivers.filter(d =>
    !search ||
    (d.driver_name || d.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.phone || '').includes(search) ||
    (d.vehicle_no || '').toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', margin: 0 }}>Drivers</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{drivers.length} drivers registered</p>
        </div>
        <input
          placeholder="Search driver, phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '10px 16px', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, color: '#f1f5f9', fontSize: 13, width: 240, outline: 'none' }}
        />
      </div>
      <div style={{ background: '#1e293b', borderRadius: 14, border: '1px solid #334155', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['#', 'Driver Name', 'Phone', 'License No', 'Assigned Vehicle', 'Added On'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#162032' }}>
                <td style={{ ...S.td, color: '#475569', width: 40 }}>{i + 1}</td>
                <td style={{ ...S.td, fontWeight: 700, color: '#a3e635' }}>{d.driver_name || d.name || '—'}</td>
                <td style={S.td}>{d.phone || '—'}</td>
                <td style={{ ...S.td, color: '#94a3b8' }}>{d.license_no || d.dl_no || '—'}</td>
                <td style={S.td}>{d.vehicle_no ? <span style={{ color: '#60a5fa', fontWeight: 700 }}>{d.vehicle_no}</span> : <span style={{ color: '#475569' }}>—</span>}</td>
                <td style={{ ...S.td, color: '#64748b' }}>{fmtDate(d.created_at)}</td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={6} style={{ ...S.td, textAlign: 'center', color: '#475569', padding: 40 }}>No drivers found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Client Portal ───────────────────────────────────────────────────────
const SESSION_KEY = 'clientPortal_session';

const NAV_ITEMS = [
  { key: 'dashboard', icon: '📊', label: 'Dashboard' },
  { key: 'vehicles',  icon: '🚛', label: 'Vehicles' },
  { key: 'drivers',   icon: '👤', label: 'Drivers' },
];

export default function ClientPortal() {
  const [client, setClient] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; }
    catch { return null; }
  });
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState('dashboard');

  function handleLogin(c) {
    setClient(c);
    localStorage.setItem(SESSION_KEY, JSON.stringify(c));
    setPage('dashboard');
  }

  function handleLogout() {
    setClient(null);
    localStorage.removeItem('driverPortal_session');
    localStorage.removeItem('munshiPortal_session');
    localStorage.removeItem('clientPortal_session');
    localStorage.removeItem('adminPINLogin');
    window.location.href = '/';
  }

  const load = useCallback(async () => {
    if (!client?.client_id && !client?.client_code) return;
    setLoading(true);
    try {
      const id = client.client_id || client.client_code;
      const [vRes, dRes] = await Promise.all([
        fetch(`${API}/vehicles-master?clientId=${id}`),
        fetch(`${API}/drivers?client_id=${id}`),
      ]);
      const vData = await vRes.json();
      const dData = await dRes.json();
      setVehicles(Array.isArray(vData) ? vData : (vData.vehicles || []));
      setDrivers(Array.isArray(dData) ? dData : (dData.drivers || []));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [client?.client_id, client?.client_code]);

  useEffect(() => { load(); }, [load]);

  if (!client) return <ClientCodePinLogin onLogin={handleLogin} />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: '#0a1628', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1e293b' }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', letterSpacing: '0.02em' }}>🏢 {client.name}</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{client.client_id || client.client_code}</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {NAV_ITEMS.map(({ key, icon, label }) => (
            <button key={key} onClick={() => setPage(key)} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: page === key ? '#1d4ed8' : 'transparent',
              color: page === key ? '#fff' : '#64748b',
              fontSize: 14, fontWeight: page === key ? 700 : 500,
              marginBottom: 4, transition: 'all 0.15s', textAlign: 'left',
            }}>
              <span style={{ fontSize: 18 }}>{icon}</span> {label}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid #1e293b' }}>
          <button onClick={load} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'transparent', color: '#64748b', fontSize: 13, fontWeight: 600, marginBottom: 6,
          }}>🔄 {loading ? 'Refreshing…' : 'Refresh'}</button>
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: '#1e293b', color: '#f87171', fontSize: 13, fontWeight: 700,
          }}>🔒 Logout</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#475569', fontSize: 15 }}>
            Loading data…
          </div>
        )}
        {!loading && (
          <>
            {page === 'dashboard' && <DashboardPage client={client} vehicles={vehicles} drivers={drivers} />}
            {page === 'vehicles'  && <VehiclesPage vehicles={vehicles} />}
            {page === 'drivers'   && <DriversPage drivers={drivers} />}
          </>
        )}
      </div>
    </div>
  );
}
