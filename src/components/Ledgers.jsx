import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../utils/apiBase.js';

const API = `${API_BASE}/api`;

// ── Admin PIN (same as TripMonitor) ────────────────────────────────────────
const ADMIN_PIN = 'ATLOG';

// ── Admin PIN modal ────────────────────────────────────────────────────────
function AdminPinModal({ onSuccess, onClose, title = '🔐 Admin Access', description = 'Enter admin PIN to enable delete operations.' }) {
  const [entered, setEntered] = useState('');
  const [err,     setErr]     = useState('');

  function tryPin() {
    if (entered === ADMIN_PIN) { onSuccess(); }
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

function num(v) { return parseFloat(v) || 0; }
function fmt(v) {
  const n = num(v);
  if (n === 0) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
// Like fmt but always shows a value (₹0 instead of —) — used for Advance column
function fmtAmt(v) {
  const n = num(v);
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}
function fullRoute(e) {
  if (!e.from_location) return '—';
  const from = e.from_location.split(',')[0];
  const to = (e.to_location || '').split(',')[0];
  let stops = [];
  try {
    const wps = JSON.parse(e.waypoints_json || '[]');
    stops = wps.map(w => {
      const name = w?.poi_name || w?.name || (typeof w === 'string' ? w : '');
      return name.split(',')[0];
    }).filter(Boolean);
  } catch { /* ignore */ }
  const parts = [from, ...stops, to].filter(Boolean);
  return parts.join(' → ');
}
function settleBadge(val) {
  const n = num(val);
  if (n > 0) return { label: `+₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}  ↩ Driver returns`, color: '#dc2626', bg: '#fee2e2' };
  if (n < 0) return { label: `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}  ← Co. owes`, color: '#16a34a', bg: '#dcfce7' };
  return { label: '✓ Settled', color: '#64748b', bg: '#f1f5f9' };
}

// ── Summary card ────────────────────────────────────────────────────────────
function SummaryCard({ label, value, color = '#1e3a8a', bg = '#dbeafe' }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '14px 20px', minWidth: 140, flex: 1 }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

// ── Salary edit inline ──────────────────────────────────────────────────────
function SalaryCell({ person, endpoint, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(num(person.monthly_salary) || ''));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/${endpoint}/${person.id}/salary`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthly_salary: parseFloat(val) || 0 }),
      });
      const d = await res.json();
      if (d.success) { setEditing(false); onSaved(person.id, parseFloat(val) || 0); }
      else alert('Save failed');
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', gap: 4 }}>
        <input type="number" value={val} onChange={e => setVal(e.target.value)}
          autoFocus autoComplete="off"
          style={{ width: 90, padding: '2px 6px', fontSize: 12, border: '2px solid #3b82f6', borderRadius: 4 }}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        />
        <button onClick={save} disabled={saving}
          style={{ fontSize: 11, padding: '2px 6px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          {saving ? '…' : '✓'}
        </button>
        <button onClick={() => setEditing(false)}
          style={{ fontSize: 11, padding: '2px 6px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4, cursor: 'pointer' }}>
          ✕
        </button>
      </span>
    );
  }
  const salary = num(person.monthly_salary);
  return (
    <span onClick={() => setEditing(true)} title="Click to set salary"
      style={{ cursor: 'pointer', borderRadius: 4, padding: '2px 6px', border: '1px dashed #93c5fd',
        color: salary ? '#1e3a8a' : '#94a3b8', fontSize: 12, fontWeight: salary ? 700 : 400 }}>
      {salary ? fmt(salary) : 'Set salary'}
    </span>
  );
}

// ── TH helper ──────────────────────────────────────────────────────────────
const TH = ({ children, right }) => (
  <th style={{
    padding: '7px 10px', background: '#1e3a8a', color: '#fff',
    fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    textAlign: right ? 'right' : 'left',
    position: 'sticky', top: 0, zIndex: 2,
  }}>{children}</th>
);
const TD = ({ children, right, bold, color }) => (
  <td style={{
    padding: '6px 10px', borderBottom: '1px solid #f0f4f8',
    fontSize: 12, whiteSpace: 'nowrap',
    textAlign: right ? 'right' : 'left',
    fontWeight: bold ? 700 : 400,
    color: color || '#1e293b',
  }}>{children}</td>
);

// ═══════════════════════════════════════════════════════════════════════════
// DRIVER LEDGER TAB
// ═══════════════════════════════════════════════════════════════════════════
function DriverLedgerTab() {
  const [entries,  setEntries]  = useState([]);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [isAdmin,  setIsAdmin]  = useState(false);
  const [showPin,  setShowPin]  = useState(false);
  const [expanded, setExpanded] = useState({}); // { driverName: bool }

  async function deleteEntry(e) {
    if (!isAdmin) { alert('Admin access required to delete entries.'); return; }
    if (!window.confirm(`Delete ledger entry + trip ${e.trip_id}?\nThis removes the route and ALL ledger entries for this trip.`)) return;
    setDeleting(e.id);
    try {
      const res = await fetch(`${API}/ledger/driver/entry/${e.id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) setEntries(prev => prev.filter(x => !d.deleted_trips.includes(x.trip_id)));
      else alert('Delete failed: ' + (d.error || 'unknown'));
    } catch (err) { alert('Delete failed: ' + err.message); }
    finally { setDeleting(null); }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ledRes = await fetch(`${API}/ledger/driver`);
      const ledData = await ledRes.json();
      setEntries(Array.isArray(ledData) ? ledData : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter(e => !search.trim() ||
    (e.driver_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.trip_id     || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalAdv    = filtered.reduce((s, e) => s + num(e.advance_given),      0);
  const totalFuel   = filtered.reduce((s, e) => s + num(e.fuel_cost),           0);
  const totalToll   = filtered.reduce((s, e) => s + num(e.toll_charges),        0);
  const totalUnload = filtered.reduce((s, e) => s + num(e.unloading_charges),   0);
  const totalOther  = filtered.reduce((s, e) => s + num(e.other_charges),       0);
  const totalDed    = filtered.reduce((s, e) => s + num(e.total_deducted),      0);
  const totalSet    = filtered.reduce((s, e) => s + num(e.settlement),          0);

  // Group by driver
  const byDriver = {};
  filtered.forEach(e => {
    const d = e.driver_name || 'Unknown';
    if (!byDriver[d]) byDriver[d] = { trips: [], fuel: 0, toll: 0, unload: 0, other: 0, advance: 0, deducted: 0 };
    byDriver[d].trips.push(e);
    byDriver[d].fuel    += num(e.fuel_cost);
    byDriver[d].toll    += num(e.toll_charges);
    byDriver[d].unload  += num(e.unloading_charges);
    byDriver[d].other   += num(e.other_charges);
    byDriver[d].advance += num(e.advance_given);
    byDriver[d].deducted += num(e.total_deducted);
  });

  const toggleRow = (dname) => setExpanded(p => ({ ...p, [dname]: !p[dname] }));

  return (
    <div>
      {/* Summary totals */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <SummaryCard label="Total Trips"    value={filtered.length}    color="#1e3a8a" bg="#dbeafe" />
        <SummaryCard label="Total Advance"  value={fmt(totalAdv)}      color="#d97706" bg="#fef3c7" />
        <SummaryCard label="Total Fuel"     value={fmt(totalFuel)}     color="#dc2626" bg="#fee2e2" />
        <SummaryCard label="Total Toll"     value={fmt(totalToll)}     color="#b45309" bg="#fef9c3" />
        {totalUnload > 0 && <SummaryCard label="Total Unload" value={fmt(totalUnload)} color="#0891b2" bg="#e0f2fe" />}
        {totalOther  > 0 && <SummaryCard label="Total Other"  value={fmt(totalOther)}  color="#7c3aed" bg="#ede9fe" />}
        <SummaryCard label="Total Deducted" value={fmt(totalDed)}      color="#7c3aed" bg="#ede9fe" />
        <SummaryCard label="Net Settlement" value={fmt(totalSet)}      color={totalSet > 0 ? '#dc2626' : '#16a34a'} bg={totalSet > 0 ? '#fee2e2' : '#dcfce7'} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input type="text" placeholder="Search driver / trip ID…" value={search}
          onChange={e => setSearch(e.target.value)} autoComplete="off"
          style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, width: 260 }}
        />
        {isAdmin && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, background: '#dcfce7', borderRadius: 20, padding: '4px 12px' }}>🔓 Admin Mode ON</span>}
        <button onClick={() => isAdmin ? setIsAdmin(false) : setShowPin(true)}
          style={{ padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: isAdmin ? '#fee2e2' : '#fff', color: isAdmin ? '#dc2626' : '#374151',
            border: `1px solid ${isAdmin ? '#fca5a5' : '#e2e8f0'}` }}>
          {isAdmin ? '🔒 Lock Admin' : '🔐 Admin Mode'}
        </button>
      </div>

      {loading && <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</div>}

      {/* Per-driver accordion table */}
      <div style={{ borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 80px 100px 100px 100px 110px 110px 36px', background: '#1e293b', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5 }}>
          <span></span>
          <span>DRIVER</span>
          <span style={{ textAlign: 'center' }}>TRIPS</span>
          <span style={{ textAlign: 'right' }}>ADVANCE</span>
          <span style={{ textAlign: 'right' }}>FUEL</span>
          <span style={{ textAlign: 'right' }}>UNLOAD</span>
          <span style={{ textAlign: 'right' }}>OTHER / TOLL</span>
          <span style={{ textAlign: 'right' }}>TOTAL DED.</span>
          <span></span>
        </div>

        {Object.keys(byDriver).length === 0 && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            No ledger entries yet. Complete a trip to auto-generate.
          </div>
        )}

        {Object.entries(byDriver).map(([dname, d], idx) => {
          const isOpen = !!expanded[dname];
          return (
            <div key={dname}>
              {/* Summary row — click to expand */}
              <div
                onClick={() => toggleRow(dname)}
                style={{
                  display: 'grid', gridTemplateColumns: '32px 1fr 80px 100px 100px 100px 110px 110px 36px',
                  padding: '10px 12px', alignItems: 'center', cursor: 'pointer',
                  background: isOpen ? '#eff6ff' : (idx % 2 === 0 ? '#fff' : '#f8fafc'),
                  borderBottom: '1px solid #e2e8f0',
                  borderLeft: isOpen ? '3px solid #3b82f6' : '3px solid transparent',
                  transition: 'background 0.15s',
                }}
              >
                <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 700, textAlign: 'center' }}>
                  {isOpen ? '▼' : '▶'}
                </span>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#1e3a8a' }}>👤 {dname}</span>
                <span style={{ textAlign: 'center', fontSize: 12, color: '#64748b' }}>
                  <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: 10, padding: '2px 8px', fontWeight: 700 }}>{d.trips.length}</span>
                </span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: '#d97706', fontSize: 13 }}>{d.advance > 0 ? fmt(d.advance) : '—'}</span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626', fontSize: 13 }}>{d.fuel > 0 ? fmt(d.fuel) : '—'}</span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: '#0891b2', fontSize: 13 }}>{d.unload > 0 ? fmt(d.unload) : '—'}</span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: '#7c3aed', fontSize: 13 }}>{(d.other + d.toll) > 0 ? fmt(d.other + d.toll) : '—'}</span>
                <span style={{ textAlign: 'right', fontWeight: 800, color: '#7c3aed', fontSize: 14 }}>{fmt(d.deducted)}</span>
                <span></span>
              </div>

              {/* Expanded trip rows */}
              {isOpen && (
                <div style={{ background: '#f0f9ff', borderBottom: '2px solid #bfdbfe' }}>
                  {/* Sub-header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '28px 100px 120px 1fr 90px 90px 90px 90px 90px 90px 36px', padding: '5px 12px 5px 44px', fontSize: 10, fontWeight: 700, color: '#64748b', background: '#dbeafe', letterSpacing: 0.5 }}>
                    <span>#</span>
                    <span>DATE</span>
                    <span>TRIP ID</span>
                    <span>ROUTE</span>
                    <span style={{ textAlign: 'right' }}>ADVANCE</span>
                    <span style={{ textAlign: 'right' }}>FUEL</span>
                    <span style={{ textAlign: 'right' }}>TOLL</span>
                    <span style={{ textAlign: 'right' }}>UNLOAD</span>
                    <span style={{ textAlign: 'right' }}>OTHER</span>
                    <span style={{ textAlign: 'right' }}>DEDUCTED</span>
                    <span></span>
                  </div>
                  {d.trips.map((e, ti) => {
                    return (
                      <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '28px 100px 120px 1fr 90px 90px 90px 90px 90px 90px 36px', padding: '7px 12px 7px 44px', alignItems: 'center', fontSize: 11, borderBottom: '1px solid #bfdbfe', background: ti % 2 === 0 ? '#f0f9ff' : '#e0f2fe' }}>
                        <span style={{ color: '#94a3b8' }}>{ti + 1}</span>
                        <span style={{ color: '#475569' }}>{fmtDate(e.trip_date)}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#1e40af' }}>{e.trip_id}</span>
                        <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fullRoute(e)}>{fullRoute(e)}</span>
                        <span style={{ textAlign: 'right', color: '#d97706', fontWeight: 700 }}>{fmtAmt(e.advance_given)}</span>
                        <span style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{num(e.fuel_cost) > 0 ? fmt(e.fuel_cost) : '—'}</span>
                        <span style={{ textAlign: 'right', color: '#b45309' }}>{num(e.toll_charges) > 0 ? fmt(e.toll_charges) : '—'}</span>
                        <span style={{ textAlign: 'right', color: '#0891b2' }}>{num(e.unloading_charges) > 0 ? fmt(e.unloading_charges) : '—'}</span>
                        <span style={{ textAlign: 'right', color: '#7c3aed' }}>{num(e.other_charges) > 0 ? fmt(e.other_charges) : '—'}</span>
                        <span style={{ textAlign: 'right', fontWeight: 800, color: '#7c3aed' }}>{fmt(e.total_deducted)}</span>
                        <span style={{ textAlign: 'center' }}>
                          {isAdmin ? (
                            <button onClick={(ev) => { ev.stopPropagation(); deleteEntry(e); }} disabled={deleting === e.id}
                              style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', color: '#dc2626', fontSize: 12, padding: '1px 5px' }}>
                              {deleting === e.id ? '⏳' : '🗑'}
                            </button>
                          ) : <span style={{ color: '#cbd5e1', fontSize: 12 }}>🔒</span>}
                        </span>
                      </div>
                    );
                  })}
                  {/* Driver subtotal */}
                  <div style={{ display: 'grid', gridTemplateColumns: '28px 100px 120px 1fr 90px 90px 90px 90px 90px 90px 36px', padding: '6px 12px 6px 44px', background: '#1e3a8a', fontSize: 11, fontWeight: 800 }}>
                    <span></span><span></span><span></span>
                    <span style={{ color: '#93c5fd', fontSize: 10 }}>SUBTOTAL</span>
                    <span style={{ textAlign: 'right', color: '#fbbf24' }}>{fmt(d.advance)}</span>
                    <span style={{ textAlign: 'right', color: '#f87171' }}>{fmt(d.fuel)}</span>
                    <span style={{ textAlign: 'right', color: '#fbbf24' }}>{d.toll > 0 ? fmt(d.toll) : '—'}</span>
                    <span style={{ textAlign: 'right', color: '#67e8f9' }}>{d.unload > 0 ? fmt(d.unload) : '—'}</span>
                    <span style={{ textAlign: 'right', color: '#c4b5fd' }}>{d.other > 0 ? fmt(d.other) : '—'}</span>
                    <span style={{ textAlign: 'right', color: '#a5b4fc' }}>{fmt(d.deducted)}</span>
                    <span></span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Grand total row */}
        {Object.keys(byDriver).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 80px 100px 100px 100px 110px 110px 36px', padding: '10px 12px', background: '#0f172a', fontSize: 13, fontWeight: 800 }}>
            <span></span>
            <span style={{ color: '#94a3b8' }}>GRAND TOTAL</span>
            <span style={{ textAlign: 'center', color: '#7dd3fc' }}>{filtered.length}</span>
            <span style={{ textAlign: 'right', color: '#fbbf24' }}>{fmt(totalAdv)}</span>
            <span style={{ textAlign: 'right', color: '#f87171' }}>{fmt(totalFuel)}</span>
            <span style={{ textAlign: 'right', color: '#67e8f9' }}>{totalUnload > 0 ? fmt(totalUnload) : '—'}</span>
            <span style={{ textAlign: 'right', color: '#c4b5fd' }}>{(totalOther + totalToll) > 0 ? fmt(totalOther + totalToll) : '—'}</span>
            <span style={{ textAlign: 'right', color: '#818cf8' }}>{fmt(totalDed)}</span>
            <span></span>
          </div>
        )}
      </div>

      {showPin && (
        <AdminPinModal
          onSuccess={() => { setIsAdmin(true); setShowPin(false); }}
          onClose={() => setShowPin(false)}
          description="Enter admin PIN to enable delete operations on driver ledger entries."
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MUNSHI LEDGER TAB
// ═══════════════════════════════════════════════════════════════════════════
function MunshiLedgerTab() {
  const [entries,  setEntries]  = useState([]);
  const [munshis,  setMunshis]  = useState([]);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [isAdmin,  setIsAdmin]  = useState(false);
  const [showPin,  setShowPin]  = useState(false);

  async function deleteEntry(e) {
    if (!isAdmin) { alert('Admin access required to delete entries.'); return; }
    if (!window.confirm(`Delete ledger entry + trip ${e.trip_id}?\nThis removes the route and ALL ledger entries for this trip.`)) return;
    setDeleting(e.id);
    try {
      const res = await fetch(`${API}/ledger/munshi/entry/${e.id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) setEntries(prev => prev.filter(x => !d.deleted_trips.includes(x.trip_id)));
      else alert('Delete failed: ' + (d.error || 'unknown'));
    } catch (err) { alert('Delete failed: ' + err.message); }
    finally { setDeleting(null); }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ledRes, mnRes] = await Promise.all([
        fetch(`${API}/ledger/munshi`),
        fetch(`${API}/munshis`),
      ]);
      const ledData = await ledRes.json();
      const mnData  = await mnRes.json();
      setEntries(Array.isArray(ledData) ? ledData : []);
      setMunshis(Array.isArray(mnData) ? mnData : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function onSalarySaved(id, salary) {
    setMunshis(prev => prev.map(m => m.id === id ? { ...m, monthly_salary: salary } : m));
  }

  const filtered = entries.filter(e => !search.trim() ||
    (e.munshi_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.trip_id     || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalAdv    = filtered.reduce((s, e) => s + num(e.advance_given),      0);
  const totalFuel   = filtered.reduce((s, e) => s + num(e.fuel_cost),           0);
  const totalToll   = filtered.reduce((s, e) => s + num(e.toll_charges),        0);
  const totalUnload = filtered.reduce((s, e) => s + num(e.unloading_charges),   0);
  const totalExp    = filtered.reduce((s, e) => s + num(e.total_expense),       0);
  const totalSet    = filtered.reduce((s, e) => s + num(e.settlement),          0);

  // Group by munshi for per-munshi summary
  const byMunshi = {};
  filtered.forEach(e => {
    const m = e.munshi_name || 'Unknown';
    if (!byMunshi[m]) byMunshi[m] = { trips: 0, advance: 0, fuel: 0, toll: 0, unload: 0, total: 0 };
    byMunshi[m].trips++;
    byMunshi[m].advance += num(e.advance_given);
    byMunshi[m].fuel    += num(e.fuel_cost);
    byMunshi[m].toll    += num(e.toll_charges);
    byMunshi[m].unload  += num(e.unloading_charges);
    byMunshi[m].total   += num(e.total_expense);
  });

  return (
    <div>
      {/* Munshi salary management */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
          📋 Munshi Salary Master
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {munshis.map(m => (
            <div key={m.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', minWidth: 200 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{m.name}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>{m.id} · {m.area || '—'}</div>
              <SalaryCell person={m} endpoint="ledger/munshi" onSaved={onSalarySaved} />
            </div>
          ))}
          {munshis.length === 0 && <span style={{ fontSize: 12, color: '#94a3b8' }}>No munshis found</span>}
        </div>
      </div>

      {/* Per-munshi summary cards */}
      {Object.keys(byMunshi).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>📋 Per Munshi Summary</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(byMunshi).map(([mname, m]) => (
              <div key={mname} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', minWidth: 190 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 4 }}>📋 {mname}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{m.trips} trip{m.trips > 1 ? 's' : ''}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px', fontSize: 11 }}>
                  {m.advance > 0 && <><span style={{ color: '#64748b' }}>Advance</span><span style={{ fontWeight: 700, color: '#d97706', textAlign: 'right' }}>{fmt(m.advance)}</span></>}
                  {m.fuel > 0    && <><span style={{ color: '#64748b' }}>Fuel</span>   <span style={{ fontWeight: 700, color: '#dc2626', textAlign: 'right' }}>{fmt(m.fuel)}</span></>}
                  {m.toll > 0    && <><span style={{ color: '#64748b' }}>Toll</span>   <span style={{ fontWeight: 700, color: '#b45309', textAlign: 'right' }}>{fmt(m.toll)}</span></>}
                  {m.unload > 0  && <><span style={{ color: '#64748b' }}>Unload</span> <span style={{ fontWeight: 700, color: '#0891b2', textAlign: 'right' }}>{fmt(m.unload)}</span></>}
                </div>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 5, marginTop: 5, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>TOTAL EXP</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed' }}>{fmt(m.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <SummaryCard label="Total Entries"  value={filtered.length}  color="#1e3a8a" bg="#dbeafe" />
        <SummaryCard label="Total Advance"  value={fmt(totalAdv)}    color="#d97706" bg="#fef3c7" />
        {totalFuel   > 0 && <SummaryCard label="Total Fuel"    value={fmt(totalFuel)}   color="#dc2626" bg="#fee2e2" />}
        {totalToll   > 0 && <SummaryCard label="Total Toll"    value={fmt(totalToll)}   color="#b45309" bg="#fef9c3" />}
        {totalUnload > 0 && <SummaryCard label="Total Unload"  value={fmt(totalUnload)} color="#0891b2" bg="#e0f2fe" />}
        <SummaryCard label="Total Expense"  value={fmt(totalExp)}    color="#7c3aed" bg="#ede9fe" />
        <SummaryCard label="Net Settlement" value={fmt(totalSet)}    color={totalSet > 0 ? '#dc2626' : '#16a34a'} bg={totalSet > 0 ? '#fee2e2' : '#dcfce7'} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input type="text" placeholder="Search munshi / trip ID…" value={search}
          onChange={e => setSearch(e.target.value)} autoComplete="off"
          style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, width: 260 }}
        />
        {isAdmin && (
          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, background: '#dcfce7', borderRadius: 20, padding: '4px 12px' }}>
            🔓 Admin Mode ON
          </span>
        )}
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
      </div>

      {loading && <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</div>}

      <div style={{ overflowX: 'auto', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1100 }}>
          <thead>
            <tr>
              <TH>#</TH>
              <TH>Date</TH>
              <TH>Trip ID</TH>
              <TH>Munshi</TH>
              <TH>Vehicle</TH>
              <TH>Route</TH>
              <TH right>Advance</TH>
              <TH right>Fuel ₹</TH>
              <TH right>Toll ₹</TH>
              <TH right>Unload ₹</TH>
              <TH right>Total Exp.</TH>
              <TH right>Settlement</TH>
              <TH></TH>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={13} style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                No munshi ledger entries yet. Complete a trip to auto-generate.
              </td></tr>
            )}
            {filtered.map((e, i) => {
              const s = settleBadge(e.settlement);
              return (
                <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <TD>{i + 1}</TD>
                  <TD>{fmtDate(e.trip_date)}</TD>
                  <TD><span style={{ fontFamily: 'monospace', fontSize: 10.5 }}>{e.trip_id}</span></TD>
                  <TD bold>{e.munshi_name || '—'}</TD>
                  <TD>{e.vehicle_number || '—'}</TD>
                  <TD style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fullRoute(e)}>{fullRoute(e)}</TD>
                  <TD right color={num(e.advance_given) > 0 ? '#d97706' : '#64748b'} bold={num(e.advance_given) > 0}>{fmt(e.advance_given)}</TD>
                  <TD right color={num(e.fuel_cost) > 0 ? '#dc2626' : '#94a3b8'}>{num(e.fuel_cost) > 0 ? fmt(e.fuel_cost) : '—'}</TD>
                  <TD right color={num(e.toll_charges) > 0 ? '#b45309' : '#94a3b8'}>{num(e.toll_charges) > 0 ? fmt(e.toll_charges) : '—'}</TD>
                  <TD right color={num(e.unloading_charges) > 0 ? '#0891b2' : '#94a3b8'}>{num(e.unloading_charges) > 0 ? fmt(e.unloading_charges) : '—'}</TD>
                  <TD right bold color="#0066cc">{fmt(e.total_expense)}</TD>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f0f4f8', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <span style={{ background: s.bg, color: s.color, borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                      {s.label}
                    </span>
                  </td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #f0f4f8', textAlign: 'center' }}>
                    {isAdmin ? (
                      <button onClick={() => deleteEntry(e)} disabled={deleting === e.id} title="Delete trip + all ledger entries (Admin only)"
                        style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 5, cursor: 'pointer', color: '#dc2626', fontSize: 13, padding: '2px 7px', lineHeight: 1 }}>
                        {deleting === e.id ? '⏳' : '🗑'}
                      </button>
                    ) : (
                      <span title="Admin access required" style={{ color: '#cbd5e1', fontSize: 13 }}>🔒</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length > 0 && (
              <tr style={{ background: '#1e293b', borderTop: '2px solid #334155' }}>
                <td colSpan={6} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#94a3b8', textAlign: 'right', borderRight: '1px solid #334155' }}>TOTALS</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#fbbf24' }}>{fmt(totalAdv)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#f87171' }}>{totalFuel > 0 ? fmt(totalFuel) : '—'}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#fde68a' }}>{totalToll > 0 ? fmt(totalToll) : '—'}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#67e8f9' }}>{totalUnload > 0 ? fmt(totalUnload) : '—'}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#818cf8' }}>{fmt(totalExp)}</td>
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showPin && (
        <AdminPinModal
          onSuccess={() => { setIsAdmin(true); setShowPin(false); }}
          onClose={() => setShowPin(false)}
          description="Enter admin PIN to enable delete operations on munshi ledger entries."
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VEHICLE LEDGER TAB
// ═══════════════════════════════════════════════════════════════════════════
function VehicleLedgerTab() {
  const [entries, setEntries]  = useState([]);
  const [search,  setSearch]   = useState('');
  const [loading, setLoading]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/ledger/vehicle`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter(e => !search.trim() ||
    (e.vehicle_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (e.trip_id        || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalKm      = filtered.reduce((s, e) => s + num(e.actual_km),         0);
  const totalFuel    = filtered.reduce((s, e) => s + num(e.fuel_cost),          0);
  const totalAdv     = filtered.reduce((s, e) => s + num(e.advance_given),      0);
  const totalToll    = filtered.reduce((s, e) => s + num(e.toll_charges),       0);
  const totalUnload  = filtered.reduce((s, e) => s + num(e.unloading_charges),  0);
  const totalOther   = filtered.reduce((s, e) => s + num(e.other_charges),      0);
  const totalExp     = filtered.reduce((s, e) => s + num(e.total_expense),      0);

  // Group by vehicle for per-vehicle summary
  const byVehicle = {};
  filtered.forEach(e => {
    const v = e.vehicle_number || 'Unknown';
    if (!byVehicle[v]) byVehicle[v] = { trips: 0, km: 0, fuel: 0, toll: 0, unload: 0, other: 0, advance: 0, total: 0 };
    byVehicle[v].trips++;
    byVehicle[v].km      += num(e.actual_km);
    byVehicle[v].fuel    += num(e.fuel_cost);
    byVehicle[v].toll    += num(e.toll_charges);
    byVehicle[v].unload  += num(e.unloading_charges);
    byVehicle[v].other   += num(e.other_charges);
    byVehicle[v].advance += num(e.advance_given);
    byVehicle[v].total   += num(e.total_expense);
  });

  return (
    <div>
      {/* Per-vehicle summary cards */}
      {Object.keys(byVehicle).length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>🚛 Per Vehicle Summary</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(byVehicle).map(([vno, v]) => (
              <div key={vno} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', minWidth: 200 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 4 }}>🚛 {vno}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{v.trips} trip{v.trips > 1 ? 's' : ''} · {v.km.toFixed(0)} km</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px', fontSize: 11, marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Fuel</span>   <span style={{ fontWeight: 700, color: '#dc2626', textAlign: 'right' }}>{fmt(v.fuel)}</span>
                  {v.toll > 0 && <><span style={{ color: '#64748b' }}>Toll</span>   <span style={{ fontWeight: 700, color: '#d97706', textAlign: 'right' }}>{fmt(v.toll)}</span></>}
                  {v.unload > 0 && <><span style={{ color: '#64748b' }}>Unload</span><span style={{ fontWeight: 700, color: '#0891b2', textAlign: 'right' }}>{fmt(v.unload)}</span></>}
                  {v.other > 0 && <><span style={{ color: '#64748b' }}>Other</span> <span style={{ fontWeight: 700, color: '#7c3aed', textAlign: 'right' }}>{fmt(v.other)}</span></>}
                  <span style={{ color: '#64748b' }}>Advance</span><span style={{ fontWeight: 700, color: '#d97706', textAlign: 'right' }}>{fmt(v.advance)}</span>
                </div>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#64748b' }}>TOTAL EXP</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed' }}>{fmt(v.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <SummaryCard label="Total Trips"    value={filtered.length}                    color="#1e3a8a" bg="#dbeafe" />
        <SummaryCard label="Total Advance"  value={fmt(totalAdv)}                      color="#d97706" bg="#fef3c7" />
        <SummaryCard label="Total KM"       value={`${totalKm.toFixed(0)} km`}         color="#d97706" bg="#fef3c7" />
        <SummaryCard label="Total Fuel"     value={fmt(totalFuel)}                     color="#dc2626" bg="#fee2e2" />
        <SummaryCard label="Total Toll"     value={fmt(totalToll)}                     color="#b45309" bg="#fef9c3" />
        {totalUnload > 0 && <SummaryCard label="Total Unload" value={fmt(totalUnload)} color="#0891b2" bg="#e0f2fe" />}
        {totalOther  > 0 && <SummaryCard label="Total Other"  value={fmt(totalOther)}  color="#7c3aed" bg="#ede9fe" />}
        <SummaryCard label="Total Expense"  value={fmt(totalExp)}                      color="#7c3aed" bg="#ede9fe" />
      </div>

      <input type="text" placeholder="Search vehicle / trip ID…" value={search}
        onChange={e => setSearch(e.target.value)} autoComplete="off"
        style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, width: 260, marginBottom: 10 }}
      />

      {loading && <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</div>}

      <div style={{ overflowX: 'auto', borderRadius: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 860 }}>
          <thead>
            <tr>
              <TH>#</TH>
              <TH>Date</TH>
              <TH>Trip ID</TH>
              <TH>Vehicle</TH>
              <TH>Route</TH>
              <TH right>Advance</TH>
              <TH right>KM</TH>
              <TH right>Fuel ₹</TH>
              <TH right>Toll ₹</TH>
              <TH right>Unload ₹</TH>
              <TH right>Other ₹</TH>
              <TH right>Total ₹</TH>
            </tr>
          </thead>
          <tbody>
              {filtered.length === 0 && (
              <tr><td colSpan={12} style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                No vehicle ledger entries yet. Complete a trip to auto-generate.
              </td></tr>
            )}
            {filtered.map((e, i) => (
              <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <TD>{i + 1}</TD>
                <TD>{fmtDate(e.trip_date)}</TD>
                <TD><span style={{ fontFamily: 'monospace', fontSize: 10.5 }}>{e.trip_id}</span></TD>
                <TD bold color="#1e3a8a">{e.vehicle_number}</TD>
                <TD style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fullRoute(e)}>{fullRoute(e)}</TD>
                <TD right color={num(e.advance_given) > 0 ? '#d97706' : '#64748b'}>{fmtAmt(e.advance_given)}</TD>
                <TD right>{num(e.actual_km) > 0 ? `${num(e.actual_km).toFixed(0)} km` : '—'}</TD>
                <TD right>{fmt(e.fuel_cost)}</TD>
                <TD right>{fmt(e.toll_charges)}</TD>
                <TD right>{fmt(e.unloading_charges)}</TD>
                <TD right>{fmt(e.other_charges)}</TD>
                <TD right bold color="#0066cc">{fmt(e.total_expense)}</TD>
              </tr>
            ))}
            {filtered.length > 0 && (
              <tr style={{ background: '#1e293b', borderTop: '2px solid #334155' }}>
                <td colSpan={5} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#94a3b8', textAlign: 'right', borderRight: '1px solid #334155' }}>TOTALS</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#fbbf24' }}>{fmt(totalAdv)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>{totalKm > 0 ? `${totalKm.toFixed(0)} km` : '—'}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#f87171' }}>{fmt(totalFuel)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#fbbf24' }}>{totalToll > 0 ? fmt(totalToll) : '—'}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#67e8f9' }}>{totalUnload > 0 ? fmt(totalUnload) : '—'}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 12, fontWeight: 800, color: '#c4b5fd' }}>{totalOther > 0 ? fmt(totalOther) : '—'}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#818cf8' }}>{fmt(totalExp)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MONTHLY SALARY REVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════
function SalaryReviewTab() {
  // ── Period helpers ──
  function currentPeriod() {
    const now = new Date();
    const d = now.getDate();
    // If day >= 25, we're in the NEXT month's period
    if (d >= 25) {
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2,'0')}`;
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`;
  }
  function periodLabel(ym) {
    // ym = "YYYY-MM" → "25 Jan – 24 Feb 2026"
    try {
      const [y, m] = ym.split('-').map(Number);
      const pm = m === 1 ? 12 : m - 1;
      const py = m === 1 ? y - 1 : y;
      const fromStr = new Date(py, pm - 1, 25).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const toStr   = new Date(y,  m - 1,  24).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return `${fromStr} – ${toStr}`;
    } catch { return ym; }
  }

  // Generate last 12 period options
  function periodOptions() {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
      opts.push(ym);
    }
    return opts;
  }

  function isPeriodSettleable(ym) {
    try {
      const [y, m] = ym.split('-').map(Number);
      return new Date() >= new Date(y, m - 1, 25);
    } catch { return true; }
  }
  function settleAvailableFrom(ym) {
    try {
      const [y, m] = ym.split('-').map(Number);
      return new Date(y, m - 1, 25).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return ym; }
  }

  const [period,    setPeriod]    = useState(currentPeriod);
  const [empType,   setEmpType]   = useState('driver');
  const [data,      setData]      = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [expanded,  setExpanded]  = useState({});
  const [settling,  setSettling]  = useState({});
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [showPin,   setShowPin]   = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const doFetch = async () => {
      setLoading(true);
      try {
        const url = empType === 'driver'
          ? `${API}/ledger/admin/summary?period=${encodeURIComponent(period)}`
          : `${API}/ledger/admin/munshi-summary?period=${encodeURIComponent(period)}`;
        const res  = await fetch(url, { signal: controller.signal });
        const json = await res.json();
        setData(Array.isArray(json) ? json : []);
      } catch { if (!controller.signal.aborted) setData([]); }
      if (!controller.signal.aborted) setLoading(false);
    };
    doFetch();
    return () => controller.abort();
  }, [period, refreshKey, empType]);

  async function settleEmployee(empName) {
    const key = empName + period;
    setSettling(p => ({ ...p, [key]: true }));
    try {
      const endpoint = empType === 'driver' ? `${API}/ledger/driver/settle` : `${API}/ledger/munshi/settle`;
      const body = empType === 'driver'
        ? { driver_name: empName, period_label: period }
        : { munshi_name: empName, munshi_id: (data.find(d => d.munshi_name === empName)?.munshi_id || ''), period_label: period };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success || d.ok) {
        load();
      } else { alert('Settle failed: ' + (d.error || 'unknown')); }
    } catch (e) { alert(e.message); }
    setSettling(p => ({ ...p, [key]: false }));
  }

  const toggleExpand = (name) => setExpanded(p => ({ ...p, [name]: !p[name] }));

  // totals across all drivers
  const grandSalary    = data.reduce((s, d) => s + num(d.monthly_salary), 0);
  const grandNet       = data.reduce((s, d) => s + num(d.net_balance),    0);
  const grandPayable   = data.reduce((s, d) => s + Math.max(0, num(d.monthly_salary) - num(d.net_balance)), 0);

  const pendingCount   = data.filter(d => d.pending_count > 0).length;
  const allSettled     = data.length > 0 && data.every(d => d.pending_count === 0);
  const empLabel       = empType === 'driver' ? 'Driver' : 'Munshi';

  return (
    <div>
      {showPin && (
        <AdminPinModal
          title="🔐 Admin Review Access"
          description="Enter PIN to approve and settle driver salary."
          onSuccess={() => { setIsAdmin(true); setShowPin(false); }}
          onClose={() => setShowPin(false)}
        />
      )}

      {/* ── Controls bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '2px solid #6366f1' }}>
          {[['driver', '👤 Drivers'], ['munshi', '📋 Munshi Staff']].map(([type, lbl]) => (
            <button key={type} onClick={() => { setEmpType(type); setData([]); }}
              style={{ padding: '7px 16px', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer',
                background: empType === type ? '#6366f1' : '#f8fafc', color: empType === type ? '#fff' : '#4338ca' }}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>SALARY PERIOD</label>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            style={{ padding: '7px 12px', fontSize: 13, border: '2px solid #6366f1', borderRadius: 8, fontWeight: 700, color: '#312e81', background: '#eef2ff', cursor: 'pointer' }}
          >
            {periodOptions().map(p => (
              <option key={p} value={p}>{periodLabel(p)}</option>
            ))}
          </select>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 14px', fontSize: 12, color: '#475569', marginTop: 16 }}>
          📅 <strong>{periodLabel(period)}</strong>
        </div>
        <button onClick={load} disabled={loading}
          style={{ marginTop: 16, padding: '7px 16px', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          🔄 Refresh
        </button>
        <span style={{ flex: 1 }} />
        {isAdmin ? (
          <span style={{ padding: '6px 14px', background: '#dcfce7', color: '#15803d', borderRadius: 20, fontSize: 12, fontWeight: 700, marginTop: 16 }}>
            🔓 Admin Review ON
          </span>
        ) : (
          <button onClick={() => setShowPin(true)}
            style={{ marginTop: 16, padding: '7px 16px', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            🔐 Admin Review
          </button>
        )}
      </div>

      {/* ── Grand totals ── */}
      {data.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, padding: '12px 14px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <SummaryCard label={`${data.length} ${empLabel}s`}   value={String(data.length)}        color="#1e3a8a" bg="#dbeafe" />
          <SummaryCard label="Total Base Salary"           value={fmt(grandSalary)}            color="#7c3aed" bg="#ede9fe" />
          <SummaryCard label="Net Advance Balance"         value={fmt(Math.abs(grandNet))}     color={grandNet >= 0 ? '#dc2626' : '#16a34a'} bg={grandNet >= 0 ? '#fee2e2' : '#dcfce7'} />
          <SummaryCard label="Total Payable This Period"   value={fmt(grandPayable)}           color="#059669" bg="#d1fae5" />
          {pendingCount > 0 && <SummaryCard label="Pending Approval" value={`${pendingCount} ${empLabel.toLowerCase()}${pendingCount > 1 ? 's' : ''}`} color="#b45309" bg="#fef3c7" />}
          {allSettled && <SummaryCard label="Status" value="✅ All Settled" color="#16a34a" bg="#dcfce7" />}
        </div>
      )}

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>⏳ Loading salary data...</div>}

      {!loading && data.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
          No ledger entries found for this period.<br />
          <span style={{ fontSize: 11 }}>Trips completed between {periodLabel(period)} will appear here.</span>
        </div>
      )}

      {/* ── Driver salary cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {data.map(d => {
          const empName      = d.driver_name || d.munshi_name;
          const settleKey    = empName + period;
          const isSettling   = settling[settleKey];
          const alreadyDone  = d.pending_count === 0;
          const canSettle    = isPeriodSettleable(period);
          const netBalance   = num(d.net_balance);
          const totalExp     = num(d.total_deducted != null ? d.total_deducted : d.total_expense);
          const baseSalary   = num(d.monthly_salary);
          const finalPayable = baseSalary - netBalance;
          const isExpanded   = expanded[empName];

          return (
            <div key={empName} style={{
              border: `2px solid ${alreadyDone ? '#86efac' : d.pending_count > 0 ? '#fde68a' : '#e2e8f0'}`,
              borderRadius: 14, overflow: 'hidden',
              background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
            }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: alreadyDone ? '#f0fdf4' : '#fafafa', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', minWidth: 160 }}>{empType === 'driver' ? '👤' : '📋'} {empName}</div>
                <div style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', borderRadius: 5, padding: '2px 8px' }}>
                  {d.entries?.length || 0} trips · {d.settled_count} settled · {d.pending_count} pending
                </div>
                {alreadyDone && <span style={{ fontSize: 11, background: '#dcfce7', color: '#16a34a', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>✅ Period Settled</span>}
                {!alreadyDone && d.pending_count > 0 && (
                  <span style={{ fontSize: 11, background: '#fef3c7', color: '#b45309', borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>
                    ⏳ {d.pending_count} trip{d.pending_count > 1 ? 's' : ''} pending
                  </span>
                )}
                <span style={{ flex: 1 }} />
                <button onClick={() => toggleExpand(empName)}
                  style={{ padding: '5px 14px', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {isExpanded ? '▲ Hide trips' : '▼ View trips'}
                </button>
              </div>

              {/* Salary breakdown row */}
              <div style={{ display: 'flex', gap: 0, borderTop: '1px solid #f0f4f8', flexWrap: 'wrap' }}>
                {[
                  { label: 'BASE SALARY',          val: baseSalary,             color: '#7c3aed', bg: '#ede9fe' },
                  { label: 'TOTAL ADVANCE GIVEN',  val: num(d.total_advance),   color: '#d97706', bg: '#fef3c7' },
                  { label: 'TOTAL EXPENSES',        val: totalExp,               color: '#dc2626', bg: '#fee2e2' },
                  { label: netBalance >= 0 ? `${empLabel.toUpperCase()} HOLDS (deduct)` : 'EXTRA OWED BY CO.',
                    val: Math.abs(netBalance),
                    color: netBalance >= 0 ? '#dc2626' : '#16a34a',
                    bg:    netBalance >= 0 ? '#fee2e2' : '#dcfce7' },
                  { label: 'NET PAYABLE',           val: finalPayable,           color: '#059669', bg: '#d1fae5', bold: true },
                ].map((item, i) => (
                  <div key={i} style={{ flex: '1 1 130px', padding: '12px 14px', background: item.bg, borderRight: i < 4 ? '1px solid #e2e8f0' : 'none', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: item.bold ? 17 : 14, fontWeight: item.bold ? 900 : 700, color: item.color }}>
                      {item.val > 0 ? `₹${item.val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : <span style={{ color: '#94a3b8' }}>—</span>}
                    </div>
                  </div>
                ))}

                {/* Approve button */}
                {isAdmin && (
                  <div style={{ flex: '0 0 auto', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
                    {alreadyDone ? (
                      <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>✅ Approved</span>
                    ) : !canSettle ? (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#b45309', fontWeight: 700 }}>🔒 Settles from</div>
                        <div style={{ fontSize: 10, color: '#92400e' }}>{settleAvailableFrom(period)}</div>
                      </div>
                    ) : (
                      <button onClick={() => settleEmployee(empName)} disabled={isSettling}
                        style={{ padding: '9px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', opacity: isSettling ? 0.7 : 1 }}>
                        {isSettling ? '⏳...' : '✅ Approve & Settle'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Expanded trip detail table */}
              {isExpanded && d.entries?.length > 0 && (
                <div style={{ borderTop: '1px solid #e2e8f0', overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820, fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        {['#', 'Date', 'Trip ID', 'Vehicle', 'Route', 'Advance', 'Fuel', 'Toll', 'Unload', 'Other', 'Deducted', 'Status'].map(h => (
                          <th key={h} style={{ padding: '7px 10px', textAlign: h === '#' ? 'center' : ['Advance','Fuel','Toll','Unload','Other','Deducted'].includes(h) ? 'right' : 'left', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {d.entries.map((e, i) => (
                        <tr key={e.id || i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: '#94a3b8' }}>{i + 1}</td>
                          <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>{fmtDate(e.trip_date)}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 10.5, color: '#475569' }}>{e.trip_id}</td>
                          <td style={{ padding: '6px 10px' }}>{e.vehicle_number || '—'}</td>
                          <td style={{ padding: '6px 10px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={fullRoute(e)}>{fullRoute(e)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#d97706', fontWeight: 600 }}>{fmtAmt(e.advance_given)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#dc2626' }}>{num(e.fuel_cost) > 0 ? fmt(e.fuel_cost) : '—'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#b45309' }}>{num(e.toll_charges) > 0 ? fmt(e.toll_charges) : '—'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#0891b2' }}>{num(e.unloading_charges) > 0 ? fmt(e.unloading_charges) : '—'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', color: '#7c3aed' }}>{num(e.other_charges) > 0 ? fmt(e.other_charges) : '—'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' }}>{fmt(e.total_deducted || e.total_expense)}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 8, padding: '2px 7px',
                              background: e.settlement_status === 'settled' ? '#dcfce7' : '#fef3c7',
                              color:      e.settlement_status === 'settled' ? '#16a34a' : '#b45309' }}>
                              {e.settlement_status === 'settled' ? '✓ Settled' : '⏳ Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#1e293b', color: '#fff' }}>
                        <td colSpan={5} style={{ padding: '8px 12px', fontWeight: 700, fontSize: 12 }}>TOTALS ({d.entries.length} trips)</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#fde68a' }}>{fmt(d.total_advance)}</td>
                        <td colSpan={4} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#fca5a5', fontSize: 11 }}>
                          Exp: {fmt(d.total_deducted || d.total_expense)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#6ee7b7' }}>{fmt(d.total_deducted || d.total_expense)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN LEDGERS PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function Ledgers() {
  const [tab, setTab] = useState('driver');

  const tabs = [
    { key: 'driver',  label: '👤 Driver Ledger'       },
    { key: 'munshi',  label: '📋 Munshi Ledger'       },
    { key: 'vehicle', label: '🚛 Vehicle Ledger'      },
    { key: 'salary',  label: '💰 Monthly Salary'      },
  ];

  return (
    <div style={{ padding: '20px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#1e293b' }}>📒 Ledgers</h2>
        <span style={{ fontSize: 12, color: '#64748b', background: '#f1f5f9', borderRadius: 6, padding: '3px 10px' }}>
          Auto-updated on trip completion
        </span>
      </div>

      {/* Tab buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #e2e8f0', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              border: 'none', borderBottom: tab === t.key ? '3px solid #1e3a8a' : '3px solid transparent',
              background: 'transparent', color: tab === t.key ? '#1e3a8a' : '#64748b',
              marginBottom: -2, transition: 'all 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'driver'  && <DriverLedgerTab  />}
      {tab === 'munshi'  && <MunshiLedgerTab  />}
      {tab === 'vehicle' && <VehicleLedgerTab />}
      {tab === 'salary'  && <SalaryReviewTab  />}
    </div>
  );
}
