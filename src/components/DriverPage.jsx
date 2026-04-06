import { useState, useEffect, useCallback, useRef } from 'react';

const API = '/api';

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

// Status colour helper (no STATUS_CFG dependency)
function statusChip(status) {
  const MAP = {
    started:    { label: 'Dispatched', color: '#60a5fa', bg: '#1e3a8a33' },
    in_transit: { label: 'En Route',   color: '#fbbf24', bg: '#78350f33' },
    unloading:  { label: 'Unloading',  color: '#c084fc', bg: '#4c1d9533' },
    completed:  { label: 'Completed',  color: '#4ade80', bg: '#14532d33' },
    cancelled:  { label: 'Cancelled',  color: '#f87171', bg: '#7f1d1d33' },
  };
  return MAP[status] || MAP.started;
}

// ─── Current trip card (clean, no status progression buttons) ─────────────────
function CurrentTripCard({ trip, stops, onStopArrived }) {
  const tripActive = trip.status !== 'completed' && trip.status !== 'cancelled';
  const doneStops  = stops.filter(s => s.stop_status === 'arrived' || s.stop_status === 'completed').length;
  const chip       = statusChip(trip.status);

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Job card header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: '#f1f5f9' }}>#{trip.job_card_number}</div>
        <span style={{ background: chip.bg, color: chip.color, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700, border: `1px solid ${chip.color}44` }}>
          {chip.label}
        </span>
      </div>

      {/* Info grid */}
      <div style={{ background: '#1e293b', borderRadius: 14, padding: '16px 18px', marginBottom: 14, border: '1px solid #334155' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Info label="Date"    val={fmtDate(trip.job_card_date || trip.created_at)} />
          <Info label="Vehicle" val={trip.vehicle_number} color="#60a5fa" />
          <Info label="Driver"  val={trip.driver_name || '—'} color="#a3e635" />
          <Info label="Munshi"  val={trip.munshi_name || '—'} color="#a78bfa" />
          {(trip.from_city || trip.to_city) && (
            <div style={{ gridColumn: '1/-1' }}>
              <Info label="Route" val={[trip.from_city, trip.to_city].filter(Boolean).join(' → ')} color="#38bdf8" />
            </div>
          )}
          {trip.ewb_number && (
            <div style={{ gridColumn: '1/-1' }}>
              <Info label="E-Way Bill" val={trip.ewb_number} color="#fb923c" />
            </div>
          )}
          {stops.length > 0 && (
            <div style={{ gridColumn: '1/-1' }}>
              <Info label="Stops Done" val={`${doneStops} / ${stops.length}`} color={doneStops === stops.length ? '#4ade80' : '#f59e0b'} />
            </div>
          )}
          {trip.notes && (
            <div style={{ gridColumn: '1/-1', background: '#0f172a', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>📝 Notes</div>
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

      {trip.status === 'completed' && (
        <div style={{ textAlign: 'center', padding: 24, color: '#4ade80', fontWeight: 900, fontSize: 18, background: '#14532d22', borderRadius: 14, border: '1px solid #16a34a44' }}>
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

// ─── Report tab ──────────────────────────────────────────────────────────────
const ISSUE_TYPES = [
  'Breakdown / Engine Failure',
  'Tyre Puncture',
  'Accident',
  'Route Blocked / Diversion',
  'Delivery Dispute at Party',
  'Vehicle Not Moving / Stuck',
  'Other',
];

const ISSUE_TEMPLATES = {
  'Breakdown / Engine Failure': 'Engine failure detected. Vehicle is not moving. Immediate assistance needed.',
  'Tyre Puncture': 'Vehicle has a tyre puncture. Unable to continue. Requesting roadside assistance.',
  'Accident': 'Vehicle involved in an accident. Assessing damage and safety situation.',
  'Route Blocked / Diversion': 'Original route is blocked due to construction/accident. Taking alternate route.',
  'Delivery Dispute at Party': 'Customer refusing delivery. Discussing resolution with party.',
  'Vehicle Not Moving / Stuck': 'Vehicle is stuck and unable to move forward.',
  'Other': 'Issue details to be provided.',
};

function ReportTab({ vehicle, issueType, setIssueType, desc, setDesc, submitting, setSubmitting, msg, setMsg, reports, setReports, loading: loadingR, setLoading: setLoadingR, activeTrip, stops }) {

  const vno = vehicle?.vehicle_no || '';
  
  // Get current POI from first incomplete stop
  const currentStop = stops?.find(s => s.stop_status !== 'arrived' && s.stop_status !== 'completed');
  const currentPoi = currentStop?.poi_name || (stops && stops.length > 0 ? stops[0]?.poi_name : null);
  
  // Show trip destination if no POI/stops
  const displayLocation = currentPoi || activeTrip?.to_place || activeTrip?.to_poi_name || 'Active Trip';

  const loadReports = useCallback(async () => {
    if (!vno) return;
    setLoadingR(true);
    try {
      const res = await fetch(`${API}/drivers/reports?vehicle_no=${encodeURIComponent(vno)}`);
      const d = await res.json();
      setReports(Array.isArray(d) ? d : []);
    } catch { setReports([]); }
    setLoadingR(false);
  }, [vno, setLoadingR, setReports]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const submit = async () => {
    if (!desc.trim()) { setMsg({ ok: false, text: 'Please describe the issue' }); return; }
    setSubmitting(true); setMsg(null);
    try {
      const res = await fetch(`${API}/drivers/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_no: vno,
          driver_name: vehicle?.driver_name || '',
          issue_type: issueType,
          description: desc.trim(),
          client_id: 'CLIENT_001',
        }),
      });
      const d = await res.json();
      if (d.success) {
        setMsg({ ok: true, text: '✅ Report submitted! Admin will be notified.' });
        setDesc('');
        setIssueType(ISSUE_TYPES[0]);
        await loadReports();
      } else {
        setMsg({ ok: false, text: '❌ Failed: ' + (d.error || 'Unknown error') });
      }
    } catch (e) { setMsg({ ok: false, text: '❌ Network error' }); }
    setSubmitting(false);
  };

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Submit form */}
      <div style={{ background: '#1e293b', borderRadius: 14, padding: '18px 18px', marginBottom: 20, border: '1px solid #334155' }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#f1f5f9', marginBottom: 14 }}>🚨 Report an Issue</div>
        
        {/* Current POI/Location */}
        {displayLocation && (
          <div style={{ background: '#0f172a', borderRadius: 10, padding: '10px 12px', marginBottom: 14, borderLeft: '3px solid #60a5fa' }}>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>📍 Location</div>
            <div style={{ fontSize: 13, color: '#60a5fa', fontWeight: 700 }}>{displayLocation}</div>
            {currentStop && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Stop {stops?.indexOf(currentStop) + 1 || 1} of {stops?.length || 1}</div>}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Issue Type</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ISSUE_TYPES.map(t => (
              <button key={t} onClick={() => {
                setIssueType(t);
                setDesc(ISSUE_TEMPLATES[t] || '');
              }} style={{
                padding: '8px 12px', fontSize: 12, fontWeight: 700,
                borderRadius: 10, cursor: 'pointer', border: 'none',
                background: issueType === t ? '#3b82f6' : '#0f172a',
                color: issueType === t ? '#fff' : '#94a3b8',
                boxShadow: issueType === t ? '0 2px 8px #3b82f655' : 'none',
              }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Description</div>
          <textarea
            value={desc}
            onChange={e => { setDesc(e.target.value); setMsg(null); }}
            placeholder="Describe the issue in detail..."
            rows={4}
            style={{
              width: '100%', background: '#0f172a', border: '1px solid #334155',
              borderRadius: 10, padding: '12px', color: '#f1f5f9', fontSize: 14,
              resize: 'none', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        {msg && (
          <div style={{ fontSize: 13, fontWeight: 700, color: msg.ok ? '#4ade80' : '#f87171', marginBottom: 10 }}>{msg.text}</div>
        )}

        <button onClick={submit} disabled={submitting || !desc.trim()} style={{
          width: '100%', padding: '16px', borderRadius: 12, border: 'none',
          background: (!desc.trim() || submitting) ? '#1e3a8a' : 'linear-gradient(135deg,#dc2626,#ef4444)',
          color: '#fff', fontSize: 16, fontWeight: 900, cursor: (desc.trim() && !submitting) ? 'pointer' : 'not-allowed',
          boxShadow: (desc.trim() && !submitting) ? '0 4px 16px #dc262655' : 'none',
        }}>
          {submitting ? '⏳ Submitting...' : '🚨 Submit Report'}
        </button>
      </div>

      {/* Past reports */}
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Past Reports</div>
      {loadingR ? (
        <div style={{ textAlign: 'center', color: '#475569', padding: 20 }}>Loading...</div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#475569', padding: 20, fontSize: 13 }}>No reports yet</div>
      ) : reports.map((r, i) => (
        <div key={r.id || i} style={{ background: '#1e293b', borderRadius: 10, padding: '12px 14px', marginBottom: 8, border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>{r.issue_type}</span>
            <span style={{ fontSize: 11, color: '#475569' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'}</span>
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{r.description}</div>
          {r.admin_reply && (
            <div style={{ marginTop: 8, background: '#0f172a', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#4ade80' }}>
              📋 Admin: {r.admin_reply}
            </div>
          )}
        </div>
      ))}
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
        const chip = statusChip(trip.status);
        return (
          <div key={trip.id} style={{ background: '#1e293b', borderRadius: 10, padding: '14px 16px', marginBottom: 10, border: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#60a5fa' }}>{trip.job_card_number}</div>
              <span style={{ background: chip.bg, color: chip.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, border: `1px solid ${chip.color}44` }}>
                {chip.label}
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
  const [vehicles,  setVehicles]  = useState([]);
  const pinRef = useRef(null);

  // Load available vehicles
  useEffect(() => {
    const loadVehicles = async () => {
      try {
        const res = await fetch(`${API}/vehicles?client_id=CLIENT_001`);
        const data = await res.json();
        let vehicleList = [];
        if (data.vehicles && Array.isArray(data.vehicles)) {
          vehicleList = data.vehicles.map(v => ({
            vehicle_no: v.vehicle_number || v.vehicle_no || '',
            vehicle_number: v.vehicle_number || v.vehicle_no || '',
          })).filter(v => v.vehicle_no).slice(0, 5);
        }
        setVehicles(vehicleList);
      } catch (e) {
        console.error('Failed to load vehicles:', e);
        setVehicles([]);
      }
    };
    loadVehicles();
  }, []);

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
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>Atul Logistics — Select vehicle & enter PIN</div>
      </div>

      {/* Available vehicles list */}
      {vehicles.length > 0 && (
        <div style={{ width: '100%', maxWidth: 320, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>Select Vehicle</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {vehicles.map((v, i) => {
              const vno = v.vehicle_no || v.vehicle_number || '';
              return (
                <button
                  key={i}
                  onClick={() => { setVehicleNo(vno); setError(''); pinRef.current?.focus(); }}
                  style={{
                    padding: '8px 12px', borderRadius: 10, border: 'none',
                    background: vehicleNo === vno ? '#3b82f6' : '#1e293b',
                    color: vehicleNo === vno ? '#fff' : '#60a5fa',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    boxShadow: vehicleNo === vno ? '0 2px 8px #3b82f655' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  🚗 {vno}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; }
    catch { return null; }
  });
  const [trips,     setTrips]     = useState([]);
  const [stops,     setStops]     = useState([]);
  const [ledger,    setLedger]    = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [tab,       setTab]       = useState('trip');
  
  // Report tab state (kept in parent to persist across tab switches)
  const [reportIssueType, setReportIssueType] = useState('Breakdown / Engine Failure');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportMsg, setReportMsg] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  
  const intervalRef = useRef(null);

  function handleLogin(v) {
    setVehicle(v);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(v));
    setTab('trip');
  }
  function handleLogout() {
    // Clear all session data
    setVehicle(null);
    sessionStorage.removeItem(SESSION_KEY);
    setTrips([]); setStops([]); setLedger([]);
    
    // Clear persistent localStorage sessions to go back to role selection
    localStorage.removeItem('driverPortal_session');
    localStorage.removeItem('munshiPortal_session');
    localStorage.removeItem('clientPortal_session');
    localStorage.removeItem('adminPINLogin');
    
    // Redirect to home to get role selection screen
    window.location.href = '/';
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
    { key: 'trip',    label: '🚛 Trip'    },
    { key: 'report',  label: '🚨 Report'  },
    { key: 'history', label: '📋 History' },
    { key: 'pay',     label: '💰 Pay'     },
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
          <button onClick={() => load()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '7px 12px', color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🔄</button>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 12px', color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>🔒</button>
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
                    <button onClick={() => setTab('history')} style={{ marginTop: 16, background: '#1e3a8a', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#93c5fd', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      View Trip History →
                    </button>
                  )}
                </div>
              ) : (
                <CurrentTripCard
                  trip={activeTrip}
                  stops={stops}
                  onStopArrived={markStopArrived}
                />
              )}
            </div>
          )}

          {tab === 'report'  && <ReportTab vehicle={vehicle} issueType={reportIssueType} setIssueType={setReportIssueType} desc={reportDesc} setDesc={setReportDesc} submitting={reportSubmitting} setSubmitting={setReportSubmitting} msg={reportMsg} setMsg={setReportMsg} reports={reports} setReports={setReports} loading={reportLoading} setLoading={setReportLoading} activeTrip={activeTrip} stops={stops} />}
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
