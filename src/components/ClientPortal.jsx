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

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function DashboardTab({ client, vehicles, drivers }) {
  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ background: '#1e293b', borderRadius: 14, padding: '20px', marginBottom: 16, border: '1px solid #334155' }}>
        <div style={{ fontSize: 13, color: '#64748b', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Welcome</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#f1f5f9', marginBottom: 16 }}>{client?.name || 'Client'}</div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: '#0f172a', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#60a5fa' }}>{vehicles?.length || 0}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>🚗 Vehicles</div>
          </div>
          <div style={{ background: '#0f172a', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#a3e635' }}>{drivers?.length || 0}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>👤 Drivers</div>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>Quick Stats</div>
      <div style={{ background: '#1e293b', borderRadius: 10, padding: '14px', marginBottom: 8, border: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ color: '#94a3b8' }}>Active Vehicles</span>
          <span style={{ color: '#a3e635', fontWeight: 700 }}>{vehicles?.filter(v => v.status === 'active').length || 0}</span>
        </div>
      </div>
      <div style={{ background: '#1e293b', borderRadius: 10, padding: '14px', border: '1px solid #334155' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ color: '#94a3b8' }}>Available Drivers</span>
          <span style={{ color: '#60a5fa', fontWeight: 700 }}>{drivers?.length || 0}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Vehicles Tab ────────────────────────────────────────────────────────────
function VehiclesTab({ vehicles }) {
  if (!vehicles?.length) {
    return (
      <div style={{ padding: '16px 20px', textAlign: 'center', color: '#475569', paddingTop: 40 }}>
        <div style={{ fontSize: 14 }}>No vehicles yet</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      {vehicles.map((v, i) => (
        <div key={i} style={{ background: '#1e293b', borderRadius: 10, padding: '14px', marginBottom: 10, border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#60a5fa' }}>🚗 {v.vehicle_number}</div>
            <span style={{ fontSize: 11, background: v.status === 'active' ? '#14532d' : '#78350f', color: v.status === 'active' ? '#4ade80' : '#f59e0b', padding: '2px 8px', borderRadius: 8 }}>
              {v.status === 'active' ? '✓ Active' : 'Inactive'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{v.model || '—'}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Drivers Tab ─────────────────────────────────────────────────────────────
function DriversTab({ drivers }) {
  if (!drivers?.length) {
    return (
      <div style={{ padding: '16px 20px', textAlign: 'center', color: '#475569', paddingTop: 40 }}>
        <div style={{ fontSize: 14 }}>No drivers yet</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      {drivers.map((d, i) => (
        <div key={i} style={{ background: '#1e293b', borderRadius: 10, padding: '14px', marginBottom: 10, border: '1px solid #334155' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#a3e635', marginBottom: 4 }}>👤 {d.driver_name || d.name || '—'}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {d.phone && `📱 ${d.phone}`}
            {d.vehicle_no && <div>🚗 {d.vehicle_no}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Client Portal ───────────────────────────────────────────────────────
const SESSION_KEY = 'clientPortal_session';

export default function ClientPortal() {
  const [client, setClient] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; }
    catch { return null; }
  });
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('dashboard');

  function handleLogin(c) {
    setClient(c);
    localStorage.setItem(SESSION_KEY, JSON.stringify(c));
    setTab('dashboard');
  }

  function handleLogout() {
    setClient(null);
    sessionStorage.removeItem(SESSION_KEY);
    
    // Clear persistent localStorage sessions to go back to role selection
    localStorage.removeItem('driverPortal_session');
    localStorage.removeItem('munshiPortal_session');
    localStorage.removeItem('clientPortal_session');
    localStorage.removeItem('adminPINLogin');
    
    // Redirect to home to get role selection screen
    window.location.href = '/';
  }

  const load = useCallback(async () => {
    if (!client?.client_code) return;
    setLoading(true);
    try {
      const [vRes, dRes] = await Promise.all([
        fetch(`${API}/vehicles?client_id=${client.client_code}`),
        fetch(`${API}/drivers?client_id=${client.client_code}`),
      ]);
      const vData = await vRes.json();
      const dData = await dRes.json();
      setVehicles(vData.vehicles ? vData.vehicles : []);
      setDrivers(dData.drivers ? dData.drivers : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [client?.client_code]);

  useEffect(() => { load(); }, [load]);

  const TABS = [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'vehicles', label: '🚗 Vehicles' },
    { key: 'drivers', label: '👤 Drivers' },
  ];

  if (!client) return <ClientCodePinLogin onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: '#fff' }}>🏢 {client.name}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>🔄</button>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>🔒</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #334155', background: '#0f172a' }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              flex: 1, padding: '14px', border: 'none', background: 'transparent',
              color: tab === key ? '#3b82f6' : '#64748b',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              borderBottom: tab === key ? '3px solid #3b82f6' : 'none',
              transition: 'all 0.2s',
            }}
          >{label}</button>
        ))}
      </div>

      {/* Content */}
      {loading && <div style={{ textAlign: 'center', padding: '40px 20px', color: '#475569' }}>Loading...</div>}
      {!loading && (
        <>
          {tab === 'dashboard' && <DashboardTab client={client} vehicles={vehicles} drivers={drivers} />}
          {tab === 'vehicles' && <VehiclesTab vehicles={vehicles} />}
          {tab === 'drivers' && <DriversTab drivers={drivers} />}
        </>
      )}
    </div>
  );
}
