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
function TripsTab({ munshi, vehicles, pois }) {
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
    };
  }

  function openNew(ewb, vehicle) {
    // For POI-sourced EWBs, vehicle comes from the EWB record itself
    const ewbVehicle = ewb?.vehicle_no ? vehicles.find(v => v.vehicle_no === ewb.vehicle_no) : null;
    const v          = ewbVehicle || vehicle || selectedVehicle;
    const tempNo = ewb ? '' : (() => {
      const ds = new Date().toISOString().slice(0,10).replace(/-/g,'');
      return `T${ds}${String(Math.floor(Math.random()*900)+100)}`;
    })();
    setForm({
      ...blankForm(munshi),
      vehicle_no:    v?.vehicle_no  || ewb?.vehicle_no || '',
      driver_name:   v?.driver_name || '',
      ewb_no:        ewb ? ewb.ewb_no : tempNo,
      ewb_is_temp:   ewb ? 0 : 1,
      to_poi_name:   ewb?.to_poi_name || ewb?.to_place || '',
      from_poi_name: ewb?.from_poi_name || '',
    });
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
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, client_id: 'CLIENT_001' }),
      });
      const d = await res.json();
      if (d.error) { setMsg('❌ ' + d.error); return; }
      setMsg('✅ Saved!');
      setShowForm(false);
      // Refresh trips list
      const tripData = await fetch(`${API}/munshi-trips?clientId=CLIENT_001&vehicle_no=${encodeURIComponent(form.vehicle_no)}`).then(r => r.json()).catch(() => []);
      setTrips(Array.isArray(tripData) ? tripData : []);
    } catch (e) { setMsg('❌ ' + e.message); }
    finally { setSaving(false); }
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

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 110px)', overflow: 'hidden' }}>

      {/* ── LEFT: Vehicle List ── */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid #1e293b', overflowY: 'auto', background: '#0f172a', padding: '8px 0' }}>
        <div style={{ fontSize: 10, color: '#475569', fontWeight: 800, textTransform: 'uppercase', padding: '4px 10px 8px', letterSpacing: '0.08em' }}>Vehicles ({myVehicles.length})</div>
        {myVehicles.length === 0 && <div style={{ fontSize: 11, color: '#334155', padding: '8px 10px' }}>No vehicles</div>}
        {myVehicles.map(v => {
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

        {/* POI-sourced EWBs — shown at top always */}
        {poiEwbs.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: '#0ea5e9', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>📍 E-Way Bills from My POI ({poiEwbs.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
              {poiEwbs.map(ewb => (
                <div key={ewb.id}
                  onClick={() => { openNew(ewb, null); setShowForm(true); }}
                  style={{ background: '#0c1a30', border: '1px solid #0e4163', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#60a5fa', fontWeight: 700 }}>{ewb.ewb_no}</span>
                      {ewb.vehicle_no && <span style={{ fontSize: 10, color: '#a3e635', fontFamily: 'monospace', background: '#14532d33', padding: '1px 6px', borderRadius: 4 }}>{ewb.vehicle_no}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>→ {ewb.to_poi_name || ewb.to_place || 'Unknown destination'}</div>
                    {ewb.total_value > 0 && <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>₹{Number(ewb.total_value).toLocaleString('en-IN')}</div>}
                  </div>
                  <div style={{ fontSize: 10, color: '#fff', background: '#0284c7', borderRadius: 6, padding: '4px 10px', fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 8 }}>Use →</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!selectedVehicle ? (
          <div style={{ textAlign: 'center', padding: poiEwbs.length > 0 ? '16px 20px' : '60px 20px', color: '#334155', borderTop: poiEwbs.length > 0 ? '1px solid #1e293b' : 'none', paddingTop: poiEwbs.length > 0 ? 16 : 60 }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>👈</div>
            <div style={{ fontWeight: 700, color: '#475569', fontSize: 13 }}>Select a vehicle for trips</div>
          </div>
        ) : loadingR ? <Spinner /> : (
          <>
            {/* Vehicle header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#60a5fa', fontFamily: 'monospace' }}>{selectedVehicle.vehicle_no}</div>
                {selectedVehicle.driver_name && <div style={{ fontSize: 11, color: '#a3e635' }}>👤 {selectedVehicle.driver_name}</div>}
              </div>
              <button
                onClick={() => openNew(null, selectedVehicle)}
                style={{ background: '#1d4ed8', border: 'none', borderRadius: 8, padding: '8px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >+ New Trip</button>
            </div>

            {/* Active E-Way Bills */}
            {ewbs.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>📄 Active E-Way Bills</div>
                {ewbs.map(ewb => (
                  <div key={ewb.id}
                    onClick={() => openNew(ewb, selectedVehicle)}
                    style={{ background: '#0c1a30', border: '1px solid #1e3a8a', borderRadius: 8, padding: '10px 12px', marginBottom: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#60a5fa', fontWeight: 700 }}>{ewb.ewb_no}</div>
                      <div style={{ fontSize: 11, color: '#a3e635', marginTop: 2 }}>→ {ewb.to_poi_name || ewb.to_place || 'Unknown destination'}</div>
                      {ewb.total_value > 0 && <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>₹{Number(ewb.total_value).toLocaleString('en-IN')}</div>}
                    </div>
                    <div style={{ fontSize: 10, color: '#1e3a8a', background: '#1d4ed8', borderRadius: 6, padding: '3px 8px', fontWeight: 700 }}>Use →</div>
                  </div>
                ))}
              </div>
            )}

            {/* Trip Form */}
            {showForm && (
              <div style={{ background: '#1e293b', borderRadius: 10, padding: '14px 14px', marginBottom: 14, border: '1px solid #334155' }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#f1f5f9', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{editId ? '✏️ Edit Trip' : '➕ New Trip'}</span>
                  {form.ewb_is_temp ? <span style={{ fontSize: 10, background: '#78350f', color: '#fbbf24', borderRadius: 6, padding: '2px 8px' }}>TEMP EWB</span> : null}
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
                  <Field label="EWB Number" name="ewb_no" hint={form.ewb_is_temp ? '⚠️ Temporary — replace with real EWB later' : ''} />
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
                  <div style={{ gridColumn: '1/-1' }}>
                    <Field label="Other Expense (₹)" name="exp_other" type="number" />
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: 3 }}>Munshi Name 🔒</label>
                  <input readOnly value={form.munshi_name} style={{ width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 12, background: '#0f172a', border: '1px solid #1e293b', color: '#475569', boxSizing: 'border-box' }} />
                </div>
                <Field label="Notes" name="notes" />

                {msg && <div style={{ fontSize: 12, marginBottom: 8, color: msg.startsWith('✅') ? '#4ade80' : '#f87171', fontWeight: 700 }}>{msg}</div>}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                  <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveTrip} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>  {saving ? '⏳...' : '💾 Save'}</button>
                </div>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa', fontWeight: 700 }}>{trip.trip_no}</span>
                        <span style={{ fontSize: 10, color: '#64748b' }}>{trip.trip_date}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#a3e635' }}>{trip.from_poi_name || '?'} → {trip.to_poi_name || '?'}</div>
                      {trip.ewb_no && <div style={{ fontSize: 10, color: trip.ewb_is_temp ? '#fbbf24' : '#64748b', marginTop: 2 }}>{trip.ewb_is_temp ? '⚠️ TEMP: ' : '📄 '}{trip.ewb_no}</div>}
                      {total > 0 && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4, fontWeight: 700 }}>Total Exp: ₹{total.toLocaleString('en-IN')}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {trips.length === 0 && !showForm && (
              <Empty msg="No trips for this vehicle yet" sub="Click + New Trip or tap an E-Way Bill above" />
            )}
          </>
        )}
      </div>
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
  const [pois,     setPois]     = useState([]);
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
    fetch(`${API}/pois?clientId=CLIENT_001`)
      .then(r => r.json())
      .then(d => setPois(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [munshi]);

  if (!munshi) return <PinLogin onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', maxWidth: tab === 'trips' ? '100%' : 520, margin: '0 auto' }}>
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
      {tab === 'trips'    && <TripsTab    munshi={munshi} vehicles={vehicles} pois={pois} />}
      {tab === 'vehicles' && <VehiclesTab munshi={munshi} vehicles={vehicles} />}
      {tab === 'ledger'   && <LedgerTab   munshi={munshi} />}
    </div>
  );
}
