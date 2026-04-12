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

// ─── Main Client Portal (login only — after login App.jsx renders full UI) ────
const SESSION_KEY = 'clientPortal_session';

export default function ClientPortal({ onLogin }) {
  // If already logged in, trigger switch immediately
  useEffect(() => {
    const existing = (() => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } })();
    if (existing && onLogin) onLogin(existing);
  }, [onLogin]);

  function handleLogin(c) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(c));
    if (onLogin) onLogin(c);
  }

  return <ClientCodePinLogin onLogin={handleLogin} />;
}