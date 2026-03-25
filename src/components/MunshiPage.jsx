import React, { useState, useEffect, useCallback } from 'react';

const API = 'http://localhost:3000/api';

// ── Helpers ───────────────────────────────────────────────────────────────
function num(v) { return parseFloat(v) || 0; }
function fmt(v) {
  const n = num(v);
  if (n === 0) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}
function fullRoute(e) {
  const parts = [e.from_location, e.to_location].filter(Boolean);
  return parts.join(' → ') || '—';
}

// Status config (matches TripMonitor)
const STATUS_CFG = {
  started:    { label: 'Dispatched', color: '#2563eb', bg: '#dbeafe' },
  in_transit: { label: 'En Route',   color: '#d97706', bg: '#fef3c7' },
  unloading:  { label: 'Unloading',  color: '#7c3aed', bg: '#ede9fe' },
  completed:  { label: 'Completed',  color: '#16a34a', bg: '#dcfce7' },
  cancelled:  { label: 'Cancelled',  color: '#dc2626', bg: '#fee2e2' },
};

// ── Settlement badge helper ────────────────────────────────────────────────
function settleBadge(v) {
  const n = num(v);
  if (n === 0) return { label: '✓ Settled', color: '#16a34a', bg: '#dcfce7' };
  if (n > 0)   return { label: `Owes ₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: '#dc2626', bg: '#fee2e2' };
  return { label: `Due ₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, color: '#d97706', bg: '#fef3c7' };
}

// ── Small helper components ────────────────────────────────────────────────
const TH = ({ children, right }) => (
  <th style={{
    padding: '7px 10px', background: '#1e3a8a', color: '#fff',
    fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    textAlign: right ? 'right' : 'left',
    position: 'sticky', top: 0, zIndex: 2,
  }}>{children}</th>
);
const TD = ({ children, right, bold, color, style: extraStyle }) => (
  <td style={{
    padding: '6px 10px', borderBottom: '1px solid #f0f4f8',
    fontSize: 12, whiteSpace: 'nowrap',
    textAlign: right ? 'right' : 'left',
    fontWeight: bold ? 700 : 400,
    color: color || '#1e293b',
    ...(extraStyle || {}),
  }}>{children}</td>
);
function SummaryCard({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 6, padding: '7px 12px', minWidth: 90 }}>
      <div style={{ fontSize: 10, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ── My Trips Tab ──────────────────────────────────────────────────────────
function MyTripsTab({ munshi }) {
  const [trips,   setTrips]   = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!munshi) return;
    setLoading(true);
    try {
      // Fetch dispatched trips from TripDispatchWizard
      const dispRes  = await fetch(`${API}/trip-dispatches?munshiId=${encodeURIComponent(munshi.id)}`);
      const dispData = await dispRes.json();
      const dispatched = dispData.trips || [];

      // Fetch EWB-based ledger entries as virtual trips (fallback/supplement)
      const ledRes   = await fetch(`${API}/ledger/munshi?munshiId=${encodeURIComponent(munshi.id)}`);
      const ledData  = await ledRes.json();
      const ewbTrips = (Array.isArray(ledData) ? ledData : [])
        .filter(e => e.trip_id && e.trip_id.startsWith('EWB-'))
        .map(e => ({
          id:               e.id,
          job_card_number:  e.trip_id,
          job_card_date:    e.trip_date,
          status:           e.settlement_status === 'settled' ? 'completed' : 'started',
          vehicle_number:   e.vehicle_number,
          driver_name:      '',
          notes: JSON.stringify({
            from_location: e.from_location,
            to_location:   e.to_location,
            munshi_debit:  e.advance_given,
          }),
          _source: 'ewb',
        }));

      // Merge: dispatched trips first, then EWB entries not already present
      const dispIds = new Set(dispatched.map(t => t.job_card_number));
      setTrips([...dispatched, ...ewbTrips.filter(t => !dispIds.has(t.job_card_number))]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [munshi]);

  useEffect(() => { load(); }, [load]);

  const active    = trips.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const completed = trips.filter(t => t.status === 'completed');

  function parseMeta(notes) {
    if (!notes) return {};
    try { return typeof notes === 'string' ? JSON.parse(notes) : notes; } catch { return {}; }
  }

  if (!munshi) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Select a munshi to view trips.</div>;
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading trips…</div>;

  return (
    <div>
      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <SummaryCard label="Total Trips"     value={trips.length}    color="#1e3a8a" bg="#dbeafe" />
        <SummaryCard label="Active"          value={active.length}   color="#d97706" bg="#fef3c7" />
        <SummaryCard label="Completed"       value={completed.length} color="#16a34a" bg="#dcfce7" />
      </div>

      {trips.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          No trips found for {munshi.name}.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700 }}>
            <thead>
              <tr>
                <TH>#</TH>
                <TH>Date</TH>
                <TH>Trip ID</TH>
                <TH>Status</TH>
                <TH>Route</TH>
                <TH>Vehicle</TH>
                <TH>Driver</TH>
                <TH right>Munshi Adv.</TH>
              </tr>
            </thead>
            <tbody>
              {trips.map((t, i) => {
                const meta = parseMeta(t.notes);
                const cfg  = STATUS_CFG[t.status] || STATUS_CFG.started;
                const from = meta.from_location || '—';
                const to   = meta.to_location   || '—';
                return (
                  <tr key={t.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <TD color="#94a3b8">{i + 1}</TD>
                    <TD>{fmtDate(t.job_card_date)}</TD>
                    <TD>
                      <span style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#475569' }}>{t.job_card_number}</span>
                    </TD>
                    <TD>
                      <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
                        {cfg.label}
                      </span>
                    </TD>
                    <TD style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {from.split(',')[0]} → {to.split(',')[0]}
                    </TD>
                    <TD>{t.vehicle_number || '—'}</TD>
                    <TD>{t.driver_name || '—'}</TD>
                    <TD right color={num(meta.munshi_debit) > 0 ? '#d97706' : '#94a3b8'}>
                      {num(meta.munshi_debit) > 0 ? fmt(meta.munshi_debit) : '—'}
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── My Ledger Tab ─────────────────────────────────────────────────────────
function MyLedgerTab({ munshi }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!munshi) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/ledger/munshi?munshiId=${encodeURIComponent(munshi.id)}`);
      const d = await res.json();
      setEntries(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [munshi]);

  useEffect(() => { load(); }, [load]);

  if (!munshi) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Select a munshi to view ledger.</div>;
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading ledger…</div>;

  const totalAdv    = entries.reduce((s, e) => s + num(e.advance_given),       0);
  const totalExp    = entries.reduce((s, e) => s + num(e.total_expense),       0);
  const totalSet    = entries.reduce((s, e) => s + num(e.settlement),           0);
  const totalFuel   = entries.reduce((s, e) => s + num(e.fuel_cost),            0);
  const totalToll   = entries.reduce((s, e) => s + num(e.toll_charges),        0);
  const totalUnload = entries.reduce((s, e) => s + num(e.unloading_charges),   0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <SummaryCard label="Total Entries"  value={entries.length}   color="#1e3a8a" bg="#dbeafe" />
        <SummaryCard label="Advance Given"  value={fmt(totalAdv)}    color="#d97706" bg="#fef3c7" />
        <SummaryCard label="Total Fuel"     value={fmt(totalFuel)}   color="#dc2626" bg="#fee2e2" />
        <SummaryCard label="Total Toll"     value={fmt(totalToll)}   color="#b45309" bg="#fef9c3" />
        <SummaryCard label="Total Unload"   value={fmt(totalUnload)} color="#0891b2" bg="#e0f2fe" />
        <SummaryCard label="Total Expenses" value={fmt(totalExp)}    color="#7c3aed" bg="#ede9fe" />
        <SummaryCard label="Net Settlement" value={fmt(totalSet)}
          color={totalSet > 0 ? '#dc2626' : '#16a34a'}
          bg={totalSet > 0 ? '#fee2e2' : '#dcfce7'} />
      </div>

      {entries.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          No ledger entries for {munshi.name}.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1000 }}>
            <thead>
              <tr>
                <TH>#</TH>
                <TH>Date</TH>
                <TH>Trip ID</TH>
                <TH>Vehicle</TH>
                <TH>Route</TH>
                <TH right>Advance</TH>
                <TH right>Fuel ₹</TH>
                <TH right>Toll ₹</TH>
                <TH right>Unload ₹</TH>
                <TH right>Total Exp.</TH>
                <TH right>Settlement</TH>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const s = settleBadge(e.settlement);
                return (
                  <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <TD color="#94a3b8">{i + 1}</TD>
                    <TD>{fmtDate(e.trip_date)}</TD>
                    <TD><span style={{ fontFamily: 'monospace', fontSize: 10.5 }}>{e.trip_id}</span></TD>
                    <TD>{e.vehicle_number || '—'}</TD>
                    <TD style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullRoute(e)}</TD>
                    <TD right color={num(e.advance_given) > 0 ? '#d97706' : '#374151'} bold={num(e.advance_given) > 0}>{fmt(e.advance_given)}</TD>
                    <TD right color={num(e.fuel_cost) > 0 ? '#dc2626' : '#94a3b8'}>{num(e.fuel_cost) > 0 ? fmt(e.fuel_cost) : '—'}</TD>
                    <TD right color={num(e.toll_charges) > 0 ? '#b45309' : '#94a3b8'}>{num(e.toll_charges) > 0 ? fmt(e.toll_charges) : '—'}</TD>
                    <TD right color={num(e.unloading_charges) > 0 ? '#0891b2' : '#94a3b8'}>{num(e.unloading_charges) > 0 ? fmt(e.unloading_charges) : '—'}</TD>
                    <TD right bold color="#0066cc">{fmt(e.total_expense)}</TD>
                    <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f4f8', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ background: s.bg, color: s.color, borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {entries.length > 0 && (
                <tr style={{ background: '#1e293b', borderTop: '2px solid #334155' }}>
                  <td colSpan={5} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#94a3b8', textAlign: 'right', borderRight: '1px solid #334155' }}>TOTALS</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#fbbf24' }}>{fmt(totalAdv)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#f87171' }}>{totalFuel > 0 ? fmt(totalFuel) : '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#fde68a' }}>{totalToll > 0 ? fmt(totalToll) : '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#67e8f9' }}>{totalUnload > 0 ? fmt(totalUnload) : '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#818cf8' }}>{fmt(totalExp)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#94a3b8' }}>—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Vehicle Expenses Tab ──────────────────────────────────────────────────
function VehicleExpensesTab({ munshi }) {
  const [allEntries, setAllEntries] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [tripVehicles, setTripVehicles] = useState(new Set());

  // Load vehicle numbers from munshi_ledger (covers both dispatched trips and EWB imports)
  const loadTrips = useCallback(async () => {
    if (!munshi) return;
    try {
      const res = await fetch(`${API}/ledger/munshi?munshiId=${encodeURIComponent(munshi.id)}`);
      const d = await res.json();
      const vnos = new Set((Array.isArray(d) ? d : []).map(e => e.vehicle_number).filter(Boolean));
      setTripVehicles(vnos);
    } catch { /* ignore */ }
  }, [munshi]);

  // Load vehicle ledger
  const load = useCallback(async () => {
    if (!munshi) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/ledger/vehicle`);
      const d = await res.json();
      setAllEntries(Array.isArray(d) ? d : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [munshi]);

  useEffect(() => {
    loadTrips();
    load();
  }, [loadTrips, load]);

  if (!munshi) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Select a munshi to view vehicle expenses.</div>;
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading vehicle expenses…</div>;

  // Filter to vehicles that appear in this munshi's trips
  const entries = tripVehicles.size > 0
    ? allEntries.filter(e => tripVehicles.has(e.vehicle_number))
    : [];

  const totalKm   = entries.reduce((s, e) => s + num(e.actual_km),   0);
  const totalFuel = entries.reduce((s, e) => s + num(e.fuel_cost),   0);
  const totalExp  = entries.reduce((s, e) => s + num(e.total_expense), 0);

  // Group by vehicle
  const byVehicle = {};
  entries.forEach(e => {
    const v = e.vehicle_number || 'Unknown';
    if (!byVehicle[v]) byVehicle[v] = { trips: 0, km: 0, fuel: 0, total: 0 };
    byVehicle[v].trips++;
    byVehicle[v].km    += num(e.actual_km);
    byVehicle[v].fuel  += num(e.fuel_cost);
    byVehicle[v].total += num(e.total_expense);
  });

  return (
    <div>
      {/* Per-vehicle cards */}
      {Object.keys(byVehicle).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>🚛 Vehicles under this Munshi</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(byVehicle).map(([vno, v]) => (
              <div key={vno} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', minWidth: 180 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 4 }}>🚛 {vno}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{v.trips} trip{v.trips > 1 ? 's' : ''} · {v.km.toFixed(0)} km</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px', fontSize: 11 }}>
                  <span style={{ color: '#64748b' }}>Fuel</span>
                  <span style={{ fontWeight: 700, color: '#dc2626', textAlign: 'right' }}>{fmt(v.fuel)}</span>
                  <span style={{ color: '#64748b' }}>Total</span>
                  <span style={{ fontWeight: 700, color: '#7c3aed', textAlign: 'right' }}>{fmt(v.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <SummaryCard label="Trip Entries" value={entries.length}          color="#1e3a8a" bg="#dbeafe" />
        <SummaryCard label="Total KM"     value={`${totalKm.toFixed(0)} km`} color="#d97706" bg="#fef3c7" />
        <SummaryCard label="Total Fuel"   value={fmt(totalFuel)}          color="#dc2626" bg="#fee2e2" />
        <SummaryCard label="Total Exp."   value={fmt(totalExp)}           color="#7c3aed" bg="#ede9fe" />
      </div>

      {entries.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          No vehicle expense records for vehicles assigned to {munshi.name}.<br />
          <span style={{ fontSize: 11 }}>Records are created when trips are completed.</span>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
            <thead>
              <tr>
                <TH>#</TH>
                <TH>Date</TH>
                <TH>Trip ID</TH>
                <TH>Vehicle</TH>
                <TH>Route</TH>
                <TH right>KM</TH>
                <TH right>Fuel ₹</TH>
                <TH right>Total ₹</TH>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <TD color="#94a3b8">{i + 1}</TD>
                  <TD>{fmtDate(e.trip_date)}</TD>
                  <TD><span style={{ fontFamily: 'monospace', fontSize: 10.5 }}>{e.trip_id}</span></TD>
                  <TD bold color="#1e3a8a">{e.vehicle_number}</TD>
                  <TD style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{fullRoute(e)}</TD>
                  <TD right>{num(e.actual_km) > 0 ? `${num(e.actual_km).toFixed(0)} km` : '—'}</TD>
                  <TD right color={num(e.fuel_cost) > 0 ? '#dc2626' : '#94a3b8'}>{fmt(e.fuel_cost)}</TD>
                  <TD right bold color="#0066cc">{fmt(e.total_expense)}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main MunshiPage ───────────────────────────────────────────────────────
const TABS = [
  { key: 'trips',    label: '🚛 My Trips'         },
  { key: 'ledger',   label: '📒 My Ledger'         },
  { key: 'vehicles', label: '🚗 Vehicle Expenses'  },
];

const LS_KEY = 'munshiPage_activeMunshiId';

export default function MunshiPage({ onNavigate }) {
  const [munshis,        setMunshis]        = useState([]);
  const [selectedId,     setSelectedId]     = useState(() => localStorage.getItem(LS_KEY) || '');
  const [tab,            setTab]            = useState('trips');
  const [loadingMunshis, setLoadingMunshis] = useState(true);

  // Load munshi list
  const loadMunshis = useCallback(async () => {
    try {
      const res = await fetch(`${API}/munshis`);
      const d = await res.json();
      setMunshis(Array.isArray(d) ? d : []);
    } catch { /* ignore */ }
    finally { setLoadingMunshis(false); }
  }, []);

  useEffect(() => { loadMunshis(); }, [loadMunshis]);

  // Persist selected munshi
  function selectMunshi(id) {
    setSelectedId(id);
    if (id) localStorage.setItem(LS_KEY, id);
    else    localStorage.removeItem(LS_KEY);
  }

  const munshi = munshis.find(m => String(m.id) === String(selectedId)) || null;

  return (
    <div style={{ padding: '12px 16px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        borderRadius: 8, padding: '10px 16px', marginBottom: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📋 Munshi Hub</h2>
          <div style={{ color: '#93c5fd', fontSize: 11, marginTop: 2 }}>
            Personal portal — trips, ledger &amp; vehicle expenses
          </div>
        </div>

        {/* Munshi selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {onNavigate && (
            <button
              onClick={() => onNavigate('trip-dispatch')}
              style={{ padding: '5px 13px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer', letterSpacing: 0.3 }}
            >
              + Dispatch Trip
            </button>
          )}
          <span style={{ color: '#93c5fd', fontSize: 11, fontWeight: 600 }}>Logged in as:</span>
          {loadingMunshis ? (
            <span style={{ color: '#fff', fontSize: 11 }}>Loading…</span>
          ) : (
            <select
              value={selectedId}
              onChange={e => { selectMunshi(e.target.value); setTab('trips'); }}
              style={{
                padding: '4px 10px', fontSize: 12, borderRadius: 5, fontWeight: 700,
                border: '1.5px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.12)', color: '#fff',
                cursor: 'pointer', minWidth: 160,
              }}
            >
              <option value="" style={{ color: '#1e293b', background: '#fff' }}>-- Select Your Name --</option>
              {munshis.map((m, i) => (
                <option key={m.id ?? `munshi-${i}`} value={String(m.id)} style={{ color: '#1e293b', background: '#fff' }}>
                  {m.name}{m.area ? ` (${m.area})` : ''}
                </option>
              ))}
            </select>
          )}
          {munshi && (
            <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
              👤 {munshi.name}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 12, borderBottom: '2px solid #e2e8f0', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '6px 16px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              border: 'none', background: 'transparent',
              color: tab === t.key ? '#1e3a8a' : '#64748b',
              borderBottom: tab === t.key ? '3px solid #1e3a8a' : '3px solid transparent',
              marginBottom: -2, transition: 'all 0.12s', textTransform: 'uppercase', letterSpacing: '0.4px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'trips'    && <MyTripsTab          munshi={munshi} />}
        {tab === 'ledger'   && <MyLedgerTab         munshi={munshi} />}
        {tab === 'vehicles' && <VehicleExpensesTab  munshi={munshi} />}
      </div>
    </div>
  );
}
