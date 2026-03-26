/**
 * RouteMemoryAdmin — View & edit all learned route distances.
 * Admin clients can correct KM values; dispatch system picks from this table.
 */
import React, { useState, useEffect, useCallback } from 'react';

const API = '/api';

const TAG = {
  highway:   { bg: '#fef3c7', color: '#92400e', text: '🛣️ Highway' },
  local:     { bg: '#dbeafe', color: '#1e40af', text: '🏙️ Local'   },
  expressway:{ bg: '#f0fdf4', color: '#166534', text: '🚀 Expressway' },
};

function RouteTag({ isHighway }) {
  const t = isHighway ? TAG.highway : TAG.local;
  return (
    <span style={{ background: t.bg, color: t.color, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
      {t.text}
    </span>
  );
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return dateStr; }
}

function shortName(fullName) {
  if (!fullName) return '—';
  const parts = fullName.split(',');
  return parts[0]?.trim() || fullName;
}

export default function RouteMemoryAdmin() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState(null);
  const [editKm, setEditKm] = useState('');
  const [editToll, setEditToll] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ from_poi: '', to_poi: '', km: '', toll: '', is_highway: false, two_way: true });
  const [addSaving, setAddSaving] = useState(false);
  const [editTwoWay, setEditTwoWay] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/route-km-memory/all`)
      .then(r => r.json())
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    return !q || e.from_poi?.toLowerCase().includes(q) || e.to_poi?.toLowerCase().includes(q);
  });

  // Deduplicate two-way pairs: only show one row per A↔B pair (keep the one with lower id)
  const deduped = filtered.filter(row => {
    const reverse = filtered.find(
      e => e.from_poi === row.to_poi && e.to_poi === row.from_poi && e.is_highway === row.is_highway
    );
    // If a reverse exists, only keep the row with the smaller id (A→B canonical direction)
    return !reverse || row.id < reverse.id;
  });

  // Compute which entries have a reverse counterpart in the full entries list
  const hasReverse = (row) => entries.some(
    e => e.from_poi === row.to_poi && e.to_poi === row.from_poi && e.is_highway === row.is_highway
  );

  async function saveEdit(id) {
    const km = parseFloat(editKm);
    if (!km || km <= 0) { setMsg('❌ Enter a valid KM'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/route-km-memory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ km, toll: editToll !== '' ? parseFloat(editToll) || 0 : -1, two_way: editTwoWay }),
      });
      const d = await res.json();
      if (d.success) {
        setMsg(editTwoWay ? '✅ Saved (both directions updated)' : '✅ Saved');
        setEditId(null);
        setEditToll('');
        setEditTwoWay(false);
        load();
      } else setMsg('❌ ' + d.error);
    } catch (e) { setMsg('❌ ' + e.message); }
    finally { setSaving(false); }
  }

  async function doDelete(id) {
    if (!window.confirm('Delete this learned route? Dispatch will no longer auto-fill its distance.')) return;
    setDeleting(id);
    try {
      const res = await fetch(`${API}/route-km-memory/${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) { setMsg('🗑️ Deleted'); load(); }
      else setMsg('❌ ' + d.error);
    } catch (e) { setMsg('❌ ' + e.message); }
    finally { setDeleting(null); }
  }

  async function doAdd() {
    const km = parseFloat(addForm.km);
    if (!addForm.from_poi.trim() || !addForm.to_poi.trim() || !km || km <= 0) {
      setMsg('❌ Fill all fields'); return;
    }
    setAddSaving(true);
    try {
      const res = await fetch(`${API}/route-km-memory/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, km, toll: parseFloat(addForm.toll) || 0 }),
      });
      const d = await res.json();
      if (d.success) {
        setMsg(addForm.two_way ? '✅ Route added (both directions)' : '✅ Route added');
        setShowAdd(false);
        setAddForm({ from_poi: '', to_poi: '', km: '', toll: '', is_highway: false, two_way: true });
        load();
      } else setMsg('❌ ' + d.error);
    } catch (e) { setMsg('❌ ' + e.message); }
    finally { setAddSaving(false); }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1e293b' }}>🧠 Learned Routes</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
            Routes auto-learned from dispatches. Edit KM to correct — dispatch will use updated values.
          </p>
        </div>
        <button onClick={() => { setShowAdd(v => !v); setMsg(''); }}
          style={{ padding: '9px 20px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Add Manual Route
        </button>
      </div>

      {/* Flash message */}
      {msg && (
        <div style={{ marginBottom: 14, padding: '9px 16px', borderRadius: 8, background: msg.startsWith('✅') ? '#dcfce7' : msg.startsWith('🗑️') ? '#fef9c3' : '#fee2e2', color: '#1e293b', fontSize: 13, fontWeight: 600 }}>
          {msg}
          <button onClick={() => setMsg('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Add Form */}
      {showAdd && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 14px', color: '#1e40af', fontSize: 14 }}>Add / Overwrite Route Distance</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 100px auto', gap: 10, alignItems: 'end', marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>From (exact POI name)</label>
              <input value={addForm.from_poi} onChange={e => setAddForm(f => ({ ...f, from_poi: e.target.value }))}
                placeholder="Haier India Pvt Ltd, Noida"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>To (exact POI name)</label>
              <input value={addForm.to_poi} onChange={e => setAddForm(f => ({ ...f, to_poi: e.target.value }))}
                placeholder="Karnal Warehouse"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Distance (km)</label>
              <input type="number" min="1" step="0.5" value={addForm.km} onChange={e => setAddForm(f => ({ ...f, km: e.target.value }))}
                placeholder="150"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Toll (₹) <span style={{ color: '#94a3b8' }}>optional</span></label>
              <input type="number" min="0" step="10" value={addForm.toll} onChange={e => setAddForm(f => ({ ...f, toll: e.target.value }))}
                placeholder="0"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Type</label>
              <select value={addForm.is_highway ? '1' : '0'} onChange={e => setAddForm(f => ({ ...f, is_highway: e.target.value === '1' }))}
                style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
                <option value="0">🏙️ Local</option>
                <option value="1">🛣️ Highway</option>
              </select>
            </div>
          </div>
          {/* Two-way toggle + action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none',
              background: addForm.two_way ? '#eff6ff' : '#f8fafc', border: `1px solid ${addForm.two_way ? '#bfdbfe' : '#e2e8f0'}`,
              borderRadius: 8, padding: '7px 14px', fontWeight: 600, fontSize: 13, color: addForm.two_way ? '#1d4ed8' : '#64748b' }}>
              <input type="checkbox" checked={addForm.two_way} onChange={e => setAddForm(f => ({ ...f, two_way: e.target.checked }))}
                style={{ width: 15, height: 15, cursor: 'pointer' }} />
              ⇄ Two-Way Route
              <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8', marginLeft: 4 }}>
                {addForm.two_way ? '(saves A→B and B→A)' : '(saves A→B only)'}
              </span>
            </label>
            <button onClick={doAdd} disabled={addSaving}
              style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {addSaving ? '…' : '✅ Save'}
            </button>
            <button onClick={() => setShowAdd(false)}
              style={{ padding: '8px 12px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Search + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by location name…"
          style={{ flex: 1, maxWidth: 380, padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
        <span style={{ fontSize: 13, color: '#64748b' }}>
          {loading ? 'Loading…' : `${deduped.length} of ${entries.length} routes`}
        </span>
        <button onClick={load} style={{ padding: '7px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, cursor: 'pointer', color: '#475569' }}>
          🔄 Refresh
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th style={th}>#</th>
              <th style={th}>From</th>
              <th style={th}>To</th>
              <th style={th}>Type</th>
              <th style={{ ...th, textAlign: 'center' }}>Direction</th>
              <th style={{ ...th, textAlign: 'center' }}>Distance (km)</th>
              <th style={{ ...th, textAlign: 'center' }}>Toll (₹)</th>
              <th style={{ ...th, textAlign: 'center' }}>Trips</th>
              <th style={th}>Last Used</th>
              <th style={{ ...th, textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && deduped.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No learned routes yet. Routes are auto-learned after each dispatch.</td></tr>
            )}
            {deduped.map((row, i) => (
              <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ ...td, color: '#94a3b8', width: 36 }}>{i + 1}</td>
                <td style={{ ...td, fontWeight: 600, color: '#1e293b', maxWidth: 260 }}>
                  <span title={row.from_poi}>{shortName(row.from_poi)}</span>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginTop: 1 }}>{row.from_poi?.split(',').slice(1).join(',').trim() || ''}</div>
                </td>
                <td style={{ ...td, fontWeight: 600, color: '#1e293b', maxWidth: 260 }}>
                  <span title={row.to_poi}>{shortName(row.to_poi)}</span>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginTop: 1 }}>{row.to_poi?.split(',').slice(1).join(',').trim() || ''}</div>
                </td>
                <td style={td}><RouteTag isHighway={row.is_highway} /></td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {hasReverse(row)
                    ? <span style={{ background: '#ecfdf5', color: '#065f46', padding: '2px 9px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>⇄ Two-Way</span>
                    : <span style={{ background: '#f8fafc', color: '#64748b', padding: '2px 9px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>→ One-Way</span>}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {editId === row.id
                    ? (
                      <div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" min="1" step="0.5" value={editKm}
                            onChange={e => setEditKm(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(row.id); if (e.key === 'Escape') { setEditId(null); setEditToll(''); setEditTwoWay(false); } }}
                            autoFocus
                            style={{ width: 72, padding: '4px 6px', border: '2px solid #3b82f6', borderRadius: 5, fontSize: 13, textAlign: 'center' }}
                          />
                          <button onClick={() => saveEdit(row.id)} disabled={saving}
                            style={{ padding: '3px 8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
                            {saving ? '…' : '✓'}
                          </button>
                          <button onClick={() => { setEditId(null); setEditToll(''); setEditTwoWay(false); }}
                            style={{ padding: '3px 6px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}>
                            ✕
                          </button>
                        </span>
                        <div style={{ marginTop: 5 }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 11,
                            color: editTwoWay ? '#1d4ed8' : '#64748b', fontWeight: editTwoWay ? 700 : 400 }}>
                            <input type="checkbox" checked={editTwoWay} onChange={e => setEditTwoWay(e.target.checked)}
                              style={{ cursor: 'pointer' }} />
                            ⇄ Also update reverse
                          </label>
                        </div>
                      </div>
                    )
                    : (
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                        {row.km} <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>km</span>
                        {hasReverse(row) && (
                          <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500, marginTop: 1 }}>per direction</div>
                        )}
                      </span>
                    )
                  }
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {editId === row.id
                    ? (
                      <input type="number" min="0" step="10" value={editToll}
                        onChange={e => setEditToll(e.target.value)}
                        placeholder="0"
                        style={{ width: 72, padding: '4px 6px', border: '2px solid #f59e0b', borderRadius: 5, fontSize: 13, textAlign: 'center' }}
                      />
                    )
                    : (
                      <span style={{ fontWeight: 600, fontSize: 14, color: row.toll > 0 ? '#92400e' : '#94a3b8' }}>
                        {row.toll > 0 ? `₹${row.toll}` : '—'}
                      </span>
                    )
                  }
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>{row.dispatches}</span>
                </td>
                <td style={{ ...td, color: '#475569', fontSize: 12 }}>{fmt(row.last_used)}</td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {editId !== row.id && (
                    <span style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                      onClick={() => { setEditId(row.id); setEditKm(String(row.km)); setEditToll(row.toll > 0 ? String(row.toll) : ''); setEditTwoWay(hasReverse(row)); setMsg(''); }}
                        style={{ padding: '4px 12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        ✏️ Edit KM/Toll
                      </button>
                      <button
                        onClick={() => doDelete(row.id)}
                        disabled={deleting === row.id}
                        style={{ padding: '4px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                        {deleting === row.id ? '…' : '🗑️'}
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <p style={{ marginTop: 16, fontSize: 12, color: '#94a3b8' }}>
        💡 When dispatching a trip, the system first checks this table. If a learned KM + Toll exist, both are auto-filled. Edit KM/Toll here to correct — takes effect on the very next dispatch.
      </p>
    </div>
  );
}

const th = { padding: '10px 14px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' };
const td = { padding: '10px 14px', color: '#334155', verticalAlign: 'top' };
