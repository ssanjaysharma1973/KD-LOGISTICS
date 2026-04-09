import React, { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../services/apiClient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://kd-logistics-production.up.railway.app';
const API = API_BASE + '/api/eway-bills-hub';

const MOVEMENT_LABELS = {
  primary_to_secondary:  { label: 'Hub → Distributor',      color: '#1d4ed8', bg: '#dbeafe' },
  primary_to_tertiary:   { label: 'Hub → Dealer',           color: '#7c3aed', bg: '#ede9fe' },
  primary_to_other:      { label: 'Hub → Other',            color: '#0891b2', bg: '#cffafe' },
  hub_transfer:          { label: 'Hub Transfer',            color: '#0369a1', bg: '#e0f2fe' },
  secondary_to_dealer:   { label: 'Distributor → Dealer',   color: '#166534', bg: '#dcfce7' },
  secondary_to_other:    { label: 'Distributor → Other',    color: '#15803d', bg: '#f0fdf4' },
  dealer_transfer:       { label: 'Dealer Transfer',         color: '#b45309', bg: '#fef9c3' },
  dealer_return:         { label: 'Dealer Return',           color: '#92400e', bg: '#fefce8' },
  inward_return:         { label: 'Inward Return',           color: '#b45309', bg: '#fef3c7' },
  unclassified:          { label: 'Unclassified',            color: '#6b7280', bg: '#f3f4f6' },
};

const STATUS_COLORS = {
  active:    { color: '#166534', bg: '#dcfce7' },
  delivered: { color: '#1d4ed8', bg: '#dbeafe' },
  expired:   { color: '#991b1b', bg: '#fee2e2' },
  cancelled: { color: '#6b7280', bg: '#f3f4f6' },
};

const WARN_COLORS = {
  HIGH:   { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  MEDIUM: { color: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
  LOW:    { color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd' },
  INFO:   { color: '#374151', bg: '#f3f4f6', border: '#d1d5db' },
};

const LOAD_STATUS_LABELS = {
  empty_at_loading:      { label: 'At Loading Point (Empty)', color: '#92400e', bg: '#fef3c7' },
  in_transit_loaded:     { label: 'In Transit (Loaded)',      color: '#166534', bg: '#dcfce7' },
  unloading_at_delivery: { label: 'Unloading at Delivery',   color: '#1d4ed8', bg: '#dbeafe' },
  empty_at_delivery:     { label: 'At Delivery (Empty)',      color: '#6b7280', bg: '#f3f4f6' },
  unknown:               { label: 'Unknown',                  color: '#6b7280', bg: '#f3f4f6' },
};

function Badge({ text, color, bg }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, color, background: bg, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

// Check if user is logged in
// ─── IMPORT TAB ───────────────────────────────────────────────────────────────
function ImportTab({ onImported }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const handleUpload = async () => {
    if (!file) { setError('Please select an Excel file (.xlsx / .xls)'); return; }
    setError(''); setLoading(true); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const data = await apiClient.post(`${API}/import-excel`, fd);
      if (data.error) { setError(data.error || 'Import failed'); }
      else { setResult(data); onImported && onImported(); }
    } catch (e) { setError('Network error: ' + e.message); }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 28 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 18, color: '#111827' }}>📥 Import E-Way Bills from Excel</h3>
        <p style={{ margin: '0 0 20px', color: '#6b7280', fontSize: 13 }}>
          Export from the NIC E-Way Bill portal (March 1 – today). The system will auto-detect columns,
          match POIs, classify movement types, and assign munshis.
        </p>

        <div style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#1e40af' }}>
          <strong>NIC Portal export:</strong> After downloading the .xls from the EWB portal, open the <strong>_files</strong> folder that was created alongside it and upload <strong>sheet001.htm</strong> from that folder.
        </div>
        <div style={{ padding: '10px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, marginBottom: 16, fontSize: 12, color: '#92400e' }}>
          <strong>⚠️ EWB Number Precision:</strong> Before uploading, open the <code>.xls</code> in Excel → right-click the <strong>EWB.No</strong> column header
          → Format Cells → <strong>Number, 0 decimal places</strong> → Save As → Web Page (.htm) → then upload the new <code>sheet001.htm</code>.
          This prevents EWB numbers from appearing as shortened scientific notation (e.g. <code>3.52159E+11</code> → full <code>352159XXXXXX</code>).
        </div>

        <div
          style={{ border: '2px dashed #d1d5db', borderRadius: 10, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: file ? '#f0fdf4' : '#fafafa' }}
          onClick={() => fileRef.current.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
          {file
            ? <div style={{ color: '#166534', fontWeight: 600 }}>{file.name}</div>
            : <div style={{ color: '#6b7280' }}>Drag & drop here, or click to browse<br/><span style={{fontSize:11}}>(.xls wrapper → upload sheet001.htm from _files folder)</span></div>
          }
          <input ref={fileRef} type="file" accept=".htm,.html,.xlsx,.xls,text/html,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
        </div>

        {error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>{error}</div>}

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            onClick={handleUpload}
            disabled={loading || !file}
            style={{ padding: '10px 24px', background: loading ? '#9ca3af' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 11 }}
          >
            {loading ? '⏳ Importing…' : '⬆️ Import'}
          </button>
          {file && <button onClick={() => { setFile(null); setResult(null); setError(''); }} style={{ padding: '10px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 11 }}>✕ Clear</button>}
        </div>

        {result && (
          <div style={{ marginTop: 20, padding: 16, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10 }}>
            <div style={{ fontWeight: 700, color: '#166534', fontSize: 15, marginBottom: 10 }}>✅ Import Complete</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              {[
                { label: 'Total Rows', value: result.total_rows, color: '#374151' },
                { label: 'Inserted', value: result.inserted, color: '#166534' },
                { label: 'Status Updated', value: result.status_updated || 0, color: '#1d4ed8' },
                { label: 'Skipped (dup)', value: result.skipped, color: '#92400e' },
                { label: 'Failed', value: result.failed || 0, color: '#991b1b' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '12px 8px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {result.unclassified_count > 0 && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef3c7', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
                ⚠️ {result.unclassified_count} bills could not be classified — check Bills List and update manually.
              </div>
            )}
            {result.truncated_ewb_nos > 0 && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
                <strong>⚠️ {result.truncated_ewb_nos} EWB numbers are truncated</strong> — the NIC HTML export
                shows them in scientific notation (e.g. <code>3.52159E+11</code>) which only keeps 6 digits.
                The last 6 digits of each 12-digit EWB number are lost.<br/>
                <strong>Fix:</strong> Open the <code>.xls</code> in Excel → right-click the <strong>EWB.No</strong> column
                → Format Cells → <strong>Number (0 decimal places)</strong> → File → Save As → Web Page
                → re-upload <code>sheet001.htm</code>.
              </div>
            )}
            {result.batch_id && <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>Batch ID: {result.batch_id}</div>}
          </div>
        )}
      </div>

      {/* ── Deduplicate / Purge panel ── */}
      <DeduplicatePanel onDone={onImported} />
    </div>
  );
}

// ─── DEDUPLICATE PANEL ────────────────────────────────────────────────────────
function DeduplicatePanel({ onDone }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [showPurge, setShowPurge] = useState(false);
  const [oldDate, setOldDate] = useState('');
  const [deletingOld, setDeletingOld] = useState(false);

  const runDedup = async (dryRun = false) => {
    setLoading(true); setResult(null);
    try {
      const data = await apiClient.post(`${API}/deduplicate`, { dry_run: dryRun });
      setResult({ ...data, dry_run: dryRun });
      if (!dryRun) onDone && onDone();
    } catch (e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  const runPurge = async () => {
    if (!window.confirm('DELETE ALL e-way bill records? This cannot be undone.')) return;
    setPurging(true);
    try {
      const data = await apiClient.post(`${API}/purge-all`, { confirm: 'PURGE' });
      setResult({ purged: true, deleted: data.deleted });
      onDone && onDone();
    } catch (e) { setResult({ error: e.message }); }
    setPurging(false);
    setShowPurge(false);
  };

  const runDeleteOld = async () => {
    if (!oldDate) return;
    if (!window.confirm(`Delete ALL e-way bills with doc date BEFORE ${oldDate}? This cannot be undone.`)) return;
    setDeletingOld(true); setResult(null);
    try {
      const data = await apiClient.post(`${API}/purge-old`, { confirm: 'DELETE_OLD', before_date: oldDate });
      if (data.error) throw new Error(data.error);
      setResult({ deletedOld: true, deleted: data.deleted, cutoff: data.cutoff });
      onDone && onDone();
    } catch (e) { setResult({ error: e.message }); }
    setDeletingOld(false);
  };

  return (
    <div style={{ marginTop: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
      <div style={{ fontWeight: 600, color: '#374151', marginBottom: 10, fontSize: 15 }}>🧹 Remove Duplicates</div>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>
        Removes records with truncated EWB numbers (ending in 000000) when a correctly-formatted
        version with the same invoice exists, and removes duplicate entries by invoice number (doc_no).
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => runDedup(true)} disabled={loading}
          style={{ padding: '9px 18px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          🔍 Preview (dry run)
        </button>
        <button onClick={() => runDedup(false)} disabled={loading}
          style={{ padding: '9px 18px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          {loading ? '⏳ Running…' : '✅ Remove Duplicates'}
        </button>
        <button onClick={() => setShowPurge(s => !s)}
          style={{ padding: '9px 18px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, marginLeft: 'auto' }}>
          🗑️ Clear All
        </button>
      </div>
      {showPurge && (
        <div style={{ marginTop: 12, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
          <strong>This will delete ALL e-way bill records.</strong> Use only to start fresh after fixing EWB number format in Excel.
          <div style={{ marginTop: 8 }}>
            <button onClick={runPurge} disabled={purging}
              style={{ padding: '8px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, marginRight: 8 }}>
              {purging ? '⏳ Deleting…' : '🗑️ Confirm Delete All'}
            </button>
            <button onClick={() => setShowPurge(false)} style={{ padding: '8px 14px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
      {result && !result.error && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: result.dry_run ? '#eff6ff' : '#f0fdf4', border: `1px solid ${result.dry_run ? '#bfdbfe' : '#86efac'}`, borderRadius: 8, fontSize: 13 }}>
          {result.purged
            ? <span style={{ color: '#991b1b' }}>🗑️ Deleted {result.deleted} records.</span>
            : result.deletedOld
            ? <span style={{ color: '#991b1b' }}>🗑️ Deleted {result.deleted} records older than {result.cutoff}.</span>
            : <>
                <strong>{result.dry_run ? '🔍 Preview:' : '✅ Done:'}</strong>{' '}
                {result.truncated_removed} truncated EWB records removed,{' '}
                {result.doc_dup_removed} doc_no duplicates removed
                {result.dry_run ? ' (no changes made)' : ''}.
              </>
          }
        </div>
      )}
      {result?.error && <div style={{ marginTop: 10, padding: '8px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>{result.error}</div>}

      {/* Delete Old Data */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
        <div style={{ fontWeight: 600, color: '#374151', marginBottom: 6, fontSize: 14 }}>🗓️ Delete Old EWBs by Date</div>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 10px' }}>
          Permanently delete all e-way bills with a doc date <strong>before</strong> the selected date.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={oldDate}
            onChange={e => setOldDate(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
          />
          <button
            onClick={runDeleteOld}
            disabled={!oldDate || deletingOld}
            style={{ padding: '8px 18px', background: oldDate ? '#dc2626' : '#f3f4f6', color: oldDate ? '#fff' : '#9ca3af', border: 'none', borderRadius: 8, cursor: oldDate ? 'pointer' : 'default', fontWeight: 700, fontSize: 13 }}
          >
            {deletingOld ? '⏳ Deleting…' : '🗑️ Delete Before This Date'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BILLS LIST TAB ────────────────────────────────────────────────────────────
function BillsListTab() {
  const [bills, setBills] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ movement_type: '', status: '', vehicle_no: '', search: '', date_from: '', date_to: '' });
  const [searchInput, setSearchInput] = useState(''); // local input — not committed yet
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const PER_PAGE = 50;

  const fetchBills = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, per_page: PER_PAGE, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
    try {
      const data = await apiClient.get(`${API}?${params}`);
      setBills(data.bills || []);
      setTotal(data.total || 0);
    } catch { setBills([]); }
    setLoading(false);
  }, [filters, page]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this e-way bill?')) return;
    await apiClient.delete(`${API}/${id}`);
    fetchBills();
  };

  const handleReclassify = async () => {
    await apiClient.post(`${API}/reclassify`, {});
    fetchBills();
  };

  const fld = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); };

  const commitSearch = () => { fld('search', searchInput.trim()); };
  const clearSearch = () => { setSearchInput(''); fld('search', ''); };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden', background: '#fff', minWidth: 280 }}>
          <input
            placeholder="🔍 Search EWB no / vehicle / place…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitSearch(); if (e.key === 'Escape') clearSearch(); }}
            style={{ padding: '7px 12px', border: 'none', outline: 'none', fontSize: 13, flex: 1, minWidth: 0 }}
          />
          {searchInput && (
            <button onClick={clearSearch} title="Clear" style={{ padding: '0 8px', border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          )}
          <button onClick={commitSearch} style={{ padding: '7px 14px', background: '#2563eb', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}>Search</button>
        </div>
        <select value={filters.movement_type} onChange={e => fld('movement_type', e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
          <option value="">All Types</option>
          {Object.entries(MOVEMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filters.status} onChange={e => fld('status', e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="delivered">Delivered</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input placeholder="Vehicle No" value={filters.vehicle_no} onChange={e => fld('vehicle_no', e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, width: 120 }} />
        <input type="date" value={filters.date_from} onChange={e => fld('date_from', e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
        <span style={{ fontSize: 11, color: '#9ca3af', alignSelf: 'center' }}>to</span>
        <input type="date" value={filters.date_to} onChange={e => fld('date_to', e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }} />
        <button onClick={handleReclassify} style={{ padding: '7px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, cursor: 'pointer' }}>🔄 Re-classify All</button>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#6b7280', alignSelf: 'center' }}>{total} bills</div>
      </div>

      {/* Table */}
      <div style={{ overflow: 'auto', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['EWB No', 'Doc Date', 'Vehicle', 'From', 'To', 'Value', 'Valid Upto', 'Movement', 'Status', 'Munshi', ''].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading…</td></tr>
            ) : bills.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No bills found. Import an Excel file to get started.</td></tr>
            ) : bills.map(b => {
              const mv = MOVEMENT_LABELS[b.movement_type] || MOVEMENT_LABELS.unclassified;
              const sc = STATUS_COLORS[b.status] || STATUS_COLORS.active;
              const expiring = b.valid_upto && new Date(b.valid_upto) - new Date() < 86400000 && new Date(b.valid_upto) > new Date();
              const expired = b.valid_upto && new Date(b.valid_upto) < new Date() && b.status === 'active';
              const rowBg = expired ? '#fff7f7' : expiring ? '#fffbeb' : '#fff';
              return (
                <React.Fragment key={b.id}>
                  <tr
                    style={{ background: rowBg, borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                    onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                  >
                    <td style={{ padding: '5px 10px', fontWeight: 600, color: '#1d4ed8', fontFamily: 'monospace', fontSize: 12 }}>{b.ewb_no || '—'}</td>
                    <td style={{ padding: '5px 10px', color: '#374151', fontSize: 12 }}>{b.doc_date ? b.doc_date.slice(0, 10) : '—'}</td>
                    <td style={{ padding: '5px 10px', fontWeight: 600, fontSize: 12 }}>{b.vehicle_no || '—'}</td>
                    <td style={{ padding: '5px 10px', fontSize: 12 }}>{b.from_poi_name || b.from_place || '—'}</td>
                    <td style={{ padding: '5px 10px', fontSize: 12 }}>{b.to_poi_name || b.to_place || '—'}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', fontSize: 12 }}>₹{b.total_value ? Number(b.total_value).toLocaleString('en-IN') : '—'}</td>
                    <td style={{ padding: '5px 10px', color: expired ? '#991b1b' : expiring ? '#92400e' : '#374151', fontSize: 12 }}>
                      {b.valid_upto ? b.valid_upto.slice(0, 10) : '—'}
                      {expired && ' ⚠️'}
                      {expiring && !expired && ' ⏳'}
                    </td>
                    <td style={{ padding: '5px 10px' }}><Badge text={mv.label} color={mv.color} bg={mv.bg} /></td>
                    <td style={{ padding: '5px 10px' }}><Badge text={b.status || 'active'} color={sc.color} bg={sc.bg} /></td>
                    <td style={{ padding: '5px 10px', color: '#374151', fontSize: 12 }}>{b.munshi_name || '—'}</td>
                    <td style={{ padding: '5px 10px' }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {b.status !== 'delivered' && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const data = await apiClient.patch(`${API}/${b.id}`, { status: 'delivered' });
                                if (!data.error) fetchBills();
                                else alert(data.error || 'Save failed');
                              } catch (err) { alert('Network error: ' + err.message); }
                            }}
                            title="Mark as Delivered"
                            style={{ padding: '2px 7px', background: '#f0fdf4', color: '#166534', border: '1px solid #86efac', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}
                          >✅ Deliver</button>
                        )}
                        <button onClick={e => { e.stopPropagation(); handleDelete(b.id); }} style={{ padding: '2px 8px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}>✕</button>
                      </div>
                    </td>
                  </tr>
                  {expanded === b.id && (
                    <tr style={{ background: '#f9fafb' }}>
                      <td colSpan={11} style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                          <InfoBlock label="GSTIN (From)" value={b.from_gstin} />
                          <InfoBlock label="From Trade Name" value={b.from_trade_name} />
                          <InfoBlock label="From Place, State" value={`${b.from_place || '—'}, ${b.from_state || '—'} - ${b.from_pincode || ''}`} />
                          <InfoBlock label="GSTIN (To)" value={b.to_gstin} />
                          <InfoBlock label="To Trade Name" value={b.to_trade_name} />
                          <InfoBlock label="To Place, State" value={`${b.to_place || '—'}, ${b.to_state || '—'} - ${b.to_pincode || ''}`} />
                          <InfoBlock label="Product" value={b.product_name} />
                          <InfoBlock label="HSN Code" value={b.hsn_code} />
                          <InfoBlock label="Taxable Value" value={b.taxable_value ? '₹' + Number(b.taxable_value).toLocaleString('en-IN') : '—'} />
                          <InfoBlock label="Distance (km)" value={b.distance_km} />
                          <InfoBlock label="Transport Mode" value={b.transport_mode} />
                          <InfoBlock label="Doc Type" value={b.doc_type} />
                          <InfoBlock label="Supply Type" value={b.supply_type} />
                          <InfoBlock label="Notes" value={b.notes} />
                        </div>
                        <QuickStatusUpdate bill={b} onUpdated={fetchBills} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PER_PAGE && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>← Prev</button>
          <span style={{ padding: '6px 8px', fontSize: 13, color: '#6b7280' }}>Page {page} of {Math.ceil(total / PER_PAGE)}</span>
          <button disabled={page * PER_PAGE >= total} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Next →</button>
        </div>
      )}
    </div>
  );
}

function InfoBlock({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#374151' }}>{value || '—'}</div>
    </div>
  );
}

function QuickStatusUpdate({ bill, onUpdated }) {
  const [status, setStatus] = useState(bill.status || 'active');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { ok: bool, text: string }

  // Sync dropdown if bill prop changes (e.g. after re-fetch)
  useEffect(() => { setStatus(bill.status || 'active'); }, [bill.status]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const data = await apiClient.patch(`${API}/${bill.id}`, { status });
      if (data.error) {
        setMsg({ ok: false, text: data.error || 'Save failed' });
      } else {
        setMsg({ ok: true, text: `✅ Saved as "${status}"` });
        onUpdated();
        setTimeout(() => setMsg(null), 3000);
      }
    } catch (e) {
      setMsg({ ok: false, text: `Network error: ${e.message}` });
    }
    setSaving(false);
  };

  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>Update Status:</span>
      <select value={status} onChange={e => setStatus(e.target.value)}
        style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }}>
        <option value="active">Active</option>
        <option value="delivered">Delivered</option>
        <option value="expired">Expired</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <button onClick={save} disabled={saving}
        style={{ padding: '4px 14px', background: status === 'delivered' ? '#166534' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
        {saving ? '⏳ Saving…' : '💾 Save'}
      </button>
      {msg && (
        <span style={{ fontSize: 12, color: msg.ok ? '#166534' : '#991b1b', fontWeight: 600 }}>
          {msg.text}
        </span>
      )}
      {bill.delivered_at && (
        <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>
          Delivered at: {new Date(bill.delivered_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

// ─── VEHICLE MOVEMENT TAB ─────────────────────────────────────────────────────

const CHIP_STATUS = {
  empty_at_loading:      { bg: '#fffbeb', color: '#92400e', border: '#fde68a', dot: '#f59e0b' },
  in_transit_loaded:     { bg: '#f0fdf4', color: '#166534', border: '#86efac', dot: '#22c55e' },
  unloading_at_delivery: { bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd', dot: '#3b82f6' },
  empty_at_delivery:     { bg: '#f9fafb', color: '#4b5563', border: '#d1d5db', dot: '#9ca3af' },
  unknown:               { bg: '#fff',    color: '#9ca3af', border: '#e5e7eb', dot: '#d1d5db' },
};

// Colors keyed by vehicle size — cycles through a palette for unknown sizes
const SIZE_PALETTE = [
  { bg: '#2563eb', border: '#1d4ed8' }, // blue
  { bg: '#7c3aed', border: '#6d28d9' }, // purple
  { bg: '#0891b2', border: '#0e7490' }, // cyan
  { bg: '#059669', border: '#047857' }, // green
  { bg: '#d97706', border: '#b45309' }, // amber
  { bg: '#dc2626', border: '#b91c1c' }, // red
  { bg: '#db2777', border: '#be185d' }, // pink
  { bg: '#65a30d', border: '#4d7c0f' }, // lime
];
const _sizeColorCache = {};
let _sizeColorIdx = 0;
function sizeColor(size) {
  if (!size) return SIZE_PALETTE[0];
  if (!_sizeColorCache[size]) {
    _sizeColorCache[size] = SIZE_PALETTE[_sizeColorIdx % SIZE_PALETTE.length];
    _sizeColorIdx++;
  }
  return _sizeColorCache[size];
}

function VehicleChip({ v, pois = [] }) {
  const [open, setOpen]       = useState(false);
  const [selCity, setSelCity] = useState('');
  const [orgQ, setOrgQ]       = useState('');
  const [fwding, setFwding]   = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const sc   = sizeColor(v.vehicle_size);
  const ewbs = v.active_ewbs?.length || 0;
  const dest = v.active_ewbs?.[0]?.to_poi_name || v.active_ewbs?.[0]?.to_place || '';
  const tip  = [
    v.vehicle_no,
    v.vehicle_size ? `🚛 ${v.vehicle_size}` : '',
    v.current_poi_name ? `📍 ${v.current_poi_name}` : '📍 No POI',
    dest ? `→ ${dest}` : '',
    ewbs ? `📄 ${ewbs} EWB${ewbs > 1 ? 's' : ''}` : 'No active EWBs',
    v.last_seen ? `🕐 ${new Date(v.last_seen).toLocaleString('en-IN')}` : '',
  ].filter(Boolean).join('\n');

  const cities    = [...new Set(pois.map(p => p.city).filter(Boolean))].sort();
  const cityPois  = selCity ? pois.filter(p => p.city === selCity) : [];
  const matchPois = orgQ.trim()
    ? cityPois.filter(p => (p.poi_name || '').toLowerCase().includes(orgQ.toLowerCase()))
    : cityPois;

  const forward = async (poi) => {
    const activeEwbs = v.active_ewbs || [];
    if (!activeEwbs.length) return;
    setFwding(poi.id);
    try {
      await Promise.all(activeEwbs.map(ewb =>
        apiClient.patch(`/api/eway-bills-hub/${ewb.id}`, { to_poi_id: String(poi.id), to_poi_name: poi.poi_name })
      ));
      setOpen(false); setSelCity(''); setOrgQ('');
    } finally { setFwding(null); }
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <div
        onClick={() => setOpen(o => !o)}
        title={tip}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: sc.bg, border: `1.5px solid ${open ? '#fff' : sc.border}`, color: '#fff',
          borderRadius: 7, padding: '4px 10px', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', whiteSpace: 'nowrap',
          boxShadow: open ? `0 0 0 2px ${sc.bg}, 0 4px 12px ${sc.bg}88` : `0 1px 3px ${sc.bg}55`,
          transition: 'box-shadow 0.15s',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
        {v.vehicle_no}
        {ewbs > 0 && (
          <span style={{
            background: '#fff', color: sc.bg,
            borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 800, lineHeight: '16px',
          }}>{ewbs}</span>
        )}
        <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 1000,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          boxShadow: '0 8px 28px rgba(0,0,0,0.18)', padding: 12, minWidth: 280,
        }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: '#111827', marginBottom: 10 }}>
            🚛 {v.vehicle_no} <span style={{ color: '#6b7280', fontWeight: 500 }}>→ Route to</span>
          </div>

          {/* Step 1: City */}
          <select
            value={selCity}
            onChange={e => { setSelCity(e.target.value); setOrgQ(''); }}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, marginBottom: 8, color: selCity ? '#111827' : '#9ca3af', background: '#fff', boxSizing: 'border-box' }}
          >
            <option value="">📍 Select City…</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Step 2: Org name filter */}
          {selCity && (
            <input
              autoFocus
              value={orgQ}
              onChange={e => setOrgQ(e.target.value)}
              placeholder="🔍 Filter by org name (e.g. Haier)"
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, marginBottom: 8, boxSizing: 'border-box', outline: 'none' }}
            />
          )}

          {/* POI list */}
          {matchPois.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 210, overflowY: 'auto' }}>
              {matchPois.map(poi => (
                <div key={poi.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0c4a6e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi.poi_name}</div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>{poi.city}{poi.pin_code ? ` · ${poi.pin_code}` : ''}</div>
                  </div>
                  <button
                    onClick={() => forward(poi)}
                    disabled={fwding != null}
                    style={{ padding: '5px 12px', background: fwding === poi.id ? '#d1d5db' : '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 800, cursor: fwding == null ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {fwding === poi.id ? '⏳' : '→ Forward'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {selCity && cityPois.length === 0 && (
            <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: 8 }}>No POIs in {selCity}</div>
          )}
          {selCity && cityPois.length > 0 && matchPois.length === 0 && orgQ && (
            <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: 8 }}>No match — try a different name</div>
          )}
          {selCity && !v.active_ewbs?.length && (
            <div style={{ fontSize: 11, color: '#f59e0b', textAlign: 'center', padding: '6px 4px', marginTop: 4, borderTop: '1px solid #fef3c7' }}>⚠️ No active EWBs on this vehicle</div>
          )}
        </div>
      )}
    </div>
  );
}

function SwimlaneRow({ label, labelBg, labelColor, labelBorder, icon, vehicles: vList, borderBottom, pois = [] }) {
  return (
    <>
      <div style={{
        background: labelBg, color: labelColor,
        fontWeight: 700, fontSize: 11, letterSpacing: 0.6,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '10px 6px', textAlign: 'center', gap: 3,
        borderRight: `2px solid ${labelBorder}`,
        borderBottom: borderBottom ? '1px solid #f3f4f6' : 'none',
        minHeight: 48,
      }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        {label}
      </div>
      <div style={{
        padding: '10px 14px',
        display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center',
        borderBottom: borderBottom ? '1px solid #f3f4f6' : 'none',
        minHeight: 48,
      }}>
        {vList.length === 0
          ? <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
          : vList.map(v => <VehicleChip key={v.vehicle_no} v={v} pois={pois} />)
        }
      </div>
    </>
  );
}

function VehicleMovementTab() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [pois, setPois] = useState([]);

  useEffect(() => {
    apiClient.get('/api/pois').then(d => setPois(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const fetch_ = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiClient.get(`${API}/vehicle-movement`);
      setVehicles(data.vehicles || []);
    } catch { setVehicles([]); }
    setLoading(false);
  };

  useEffect(() => { fetch_(); const t = setInterval(() => fetch_(true), 30000); return () => clearInterval(t); }, []);

  // Unique sizes for dropdown
  const sizes = [...new Set(vehicles.map(v => v.vehicle_size).filter(Boolean))].sort();

  const filtered = vehicles.filter(v => {
    if (search && !v.vehicle_no.toLowerCase().includes(search.toLowerCase())) return false;
    if (sizeFilter && v.vehicle_size !== sizeFilter) return false;
    return true;
  });

  // Group by current POI
  const inTransit = [], noGps = [];
  const groups = {};

  filtered.forEach(v => {
    if (v.load_status === 'in_transit_loaded' || v.load_status === 'in_transit_empty') {
      inTransit.push(v); return;
    }
    if (!v.current_poi_name) { noGps.push(v); return; }
    if (!groups[v.current_poi_name]) {
      groups[v.current_poi_name] = { loading: [], unloading: [], parked: [], poi_type: v.current_poi_type };
    }
    const g = groups[v.current_poi_name];
    if (v.load_status === 'unloading_at_delivery') g.unloading.push(v);
    else if (v.load_status === 'empty_at_delivery') g.parked.push(v);
    else g.loading.push(v);
  });

  const poiTypeIcon = t => ({ primary: '🏭', secondary: '🏪', tertiary: '🏬' }[t] || '📍');
  const poiTypeBg   = t => ({ primary: '#eff6ff', secondary: '#f0fdf4', tertiary: '#fdf4ff' }[t] || '#fafafa');

  const totalAt = (g) => g.loading.length + g.unloading.length + g.parked.length;

  const stats = {
    loading:   filtered.filter(v => v.load_status === 'empty_at_loading').length,
    transit:   inTransit.length,
    unloading: filtered.filter(v => v.load_status === 'unloading_at_delivery').length,
    parked:    filtered.filter(v => v.load_status === 'empty_at_delivery').length,
  };

  return (
    <div>
      {/* Combined toolbar + status bar — single row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="🔍 Filter vehicle…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 12, width: 150 }}
        />
        <select
          value={sizeFilter}
          onChange={e => setSizeFilter(e.target.value)}
          style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 12, color: sizeFilter ? '#111827' : '#9ca3af', background: '#fff' }}
        >
          <option value="">All Sizes</option>
          {sizes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={fetch_} style={{ padding: '5px 10px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 7, cursor: 'pointer', fontSize: 11 }}>🔄</button>
        <span style={{ fontSize: 10, color: '#9ca3af' }}>auto 30s</span>
        {/* Status pills inline */}
        <div style={{ display: 'flex', gap: 6, marginLeft: 4, flexWrap: 'wrap' }}>
          {[
            { label: '📦 Load',    val: stats.loading,   bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
            { label: '🚛 Transit', val: stats.transit,   bg: '#f0fdf4', color: '#166534', border: '#86efac' },
            { label: '🔽 Unlod',   val: stats.unloading, bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd' },
            { label: '🅿 Park',    val: stats.parked,    bg: '#f9fafb', color: '#4b5563', border: '#d1d5db' },
          ].map(s => (
            <div key={s.label} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: s.bg, border: `1px solid ${s.border}`, color: s.color,
              borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700,
            }}>
              {s.label} <span style={{ fontWeight: 800, fontSize: 13 }}>{s.val}</span>
            </div>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#374151' }}>{filtered.length} veh</span>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading vehicle positions…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Hub groups */}
          {Object.entries(groups).sort((a, b) => totalAt(b[1]) - totalAt(a[1])).map(([poi, g]) => {
            const hasLoadUnload = g.loading.length > 0 || g.unloading.length > 0;
            // If only parked vehicles exist, show them inline on row 1 — no separate park row
            const inlineParked = !hasLoadUnload && g.parked.length > 0;
            const separateParked = hasLoadUnload && g.parked.length > 0;
            return (
            <div key={poi} style={{ background: '#fff', borderRadius: 10, border: '1px solid #3b82f6', overflow: 'hidden', boxShadow: '0 1px 4px rgba(59,130,246,0.10)' }}>
              {/* Row 1: POI name + LOAD + UNLOAD chips inline (or PARK chips if no load/unload) */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 0,
                background: poiTypeBg(g.poi_type),
                borderBottom: separateParked ? '1px solid #bfdbfe' : 'none',
              }}>
                {/* POI label */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  padding: '7px 12px', borderRight: '1px solid #bfdbfe', width: 180, minWidth: 180,
                }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{poiTypeIcon(g.poi_type)}</span>
                  <span style={{ fontWeight: 800, fontSize: 12, color: '#111827', lineHeight: 1.3, wordBreak: 'break-word' }}>{poi}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, color: '#fff',
                    background: g.poi_type === 'primary' ? '#2563eb' : g.poi_type === 'secondary' ? '#059669' : '#7c3aed',
                    border: `1.5px solid ${g.poi_type === 'primary' ? '#1d4ed8' : g.poi_type === 'secondary' ? '#047857' : '#6d28d9'}`,
                    padding: '1px 7px', borderRadius: 7, flexShrink: 0, marginLeft: 2, whiteSpace: 'nowrap',
                  }}>
                    {totalAt(g)}
                  </span>
                </div>
                {/* LOAD chips */}
                {g.loading.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRight: g.unloading.length > 0 ? '1px solid #fde68a' : 'none', background: '#fffbeb', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#92400e', background: '#fde68a', border: '1.5px solid #f59e0b', borderRadius: 7, padding: '3px 9px', whiteSpace: 'nowrap' }}>📦 LOAD</span>
                    {g.loading.map(v => <VehicleChip key={v.vehicle_no} v={v} pois={pois} />)}
                  </div>
                )}
                {/* UNLOAD chips */}
                {g.unloading.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#eff6ff', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8', background: '#bfdbfe', border: '1.5px solid #3b82f6', borderRadius: 7, padding: '3px 9px', whiteSpace: 'nowrap' }}>🔽 UNLOAD</span>
                    {g.unloading.map(v => <VehicleChip key={v.vehicle_no} v={v} pois={pois} />)}
                  </div>
                )}
                {/* If only parked: show inline on row 1 */}
                {inlineParked && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#f9fafb', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#4b5563', background: '#e5e7eb', border: '1.5px solid #9ca3af', borderRadius: 7, padding: '3px 9px', whiteSpace: 'nowrap' }}>🅿 PARK</span>
                    {g.parked.map(v => <VehicleChip key={v.vehicle_no} v={v} pois={pois} />)}
                  </div>
                )}
              </div>
              {/* Row 2: PARK only if there are also LOAD/UNLOAD vehicles */}
              {separateParked && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: '#f9fafb', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#4b5563', background: '#e5e7eb', border: '1.5px solid #9ca3af', borderRadius: 7, padding: '3px 9px', whiteSpace: 'nowrap' }}>🅿 PARK</span>
                  {g.parked.map(v => <VehicleChip key={v.vehicle_no} v={v} pois={pois} />)}
                </div>
              )}
            </div>
            );
          })}

          {/* In Transit */}
          {inTransit.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #86efac', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '9px 16px', background: '#f0fdf4', borderBottom: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15 }}>🚛</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#111827', flex: 1 }}>In Transit</span>
                <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                  {inTransit.length} veh
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr' }}>
                <SwimlaneRow
                  label="LOADED" icon="📦"
                  labelBg="#f0fdf4" labelColor="#166534" labelBorder="#86efac"
                  vehicles={inTransit.filter(v => v.load_status === 'in_transit_loaded')}
                  borderBottom={inTransit.some(v => v.load_status === 'in_transit_empty')}
                  pois={pois}
                />
                {inTransit.some(v => v.load_status === 'in_transit_empty') && (
                  <SwimlaneRow
                    label="EMPTY" icon="🔲"
                    labelBg="#fafafa" labelColor="#6b7280" labelBorder="#e5e7eb"
                    vehicles={inTransit.filter(v => v.load_status === 'in_transit_empty')}
                    borderBottom={false}
                    pois={pois}
                  />
                )}
              </div>
            </div>
          )}

          {/* No GPS */}
          {noGps.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ padding: '9px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#9ca3af', flex: 1 }}>📵 No GPS Signal</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{noGps.length} veh</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {noGps.map(v => <VehicleChip key={v.vehicle_no} v={v} pois={pois} />)}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No vehicles found.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── WARNINGS TAB ─────────────────────────────────────────────────────────────
function WarningsTab() {
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiClient.get(`${API}/warnings`);
      setWarnings(data.warnings || []);
    } catch { setWarnings([]); }
    setLoading(false);
  };

  useEffect(() => { fetch_(); const t = setInterval(() => fetch_(true), 60000); return () => clearInterval(t); }, []);

  const grouped = { HIGH: [], MEDIUM: [], LOW: [], INFO: [] };
  warnings.forEach(w => { (grouped[w.severity] || grouped.INFO).push(w); });

  const severityOrder = ['HIGH', 'MEDIUM', 'LOW', 'INFO'];

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: '#374151' }}>⚠️ Live Warnings</div>
        <button onClick={fetch_} style={{ padding: '5px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontSize: 11 }}>🔄 Refresh</button>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>Auto-refreshes every 60s</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: warnings.filter(w => w.severity === 'HIGH').length > 0 ? '#dc2626' : '#6b7280' }}>
          {warnings.length} total ({warnings.filter(w => w.severity === 'HIGH').length} HIGH)
        </span>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading warnings…</div>
        : warnings.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
            <div style={{ color: '#166534', fontWeight: 600 }}>All clear — no warnings right now</div>
          </div>
        ) : (
          severityOrder.map(sev => {
            const ws = grouped[sev];
            if (!ws.length) return null;
            const wc = WARN_COLORS[sev];
            return (
              <div key={sev} style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: wc.color, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {sev} ({ws.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ws.map((w, i) => (
                    <div key={i} style={{ background: wc.bg, border: `1px solid ${wc.border}`, borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 600, color: wc.color, fontSize: 13 }}>{w.message}</div>
                          <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                            {w.vehicle_no && <span style={{ fontSize: 12, color: '#374151' }}>🚛 {w.vehicle_no}</span>}
                            {w.ewb_no && <span style={{ fontSize: 12, color: '#374151' }}>📄 EWB {w.ewb_no}</span>}
                            {w.poi_name && <span style={{ fontSize: 12, color: '#374151' }}>📍 {w.poi_name}</span>}
                            {w.valid_upto && <span style={{ fontSize: 12, color: '#374151' }}>⏰ {w.valid_upto}</span>}
                          </div>
                        </div>
                        <Badge text={w.warning_type?.replace(/_/g, ' ')} color={wc.color} bg={wc.border} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
    </div>
  );
}

// ─── SUMMARY TAB ─────────────────────────────────────────────────────────────
function SummaryTab() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get(`${API}/summary`).then(d => { setSummary(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading summary…</div>;
  if (!summary) return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>Failed to load summary.</div>;

  const totalBills = Object.values(summary.by_movement || {}).reduce((a, b) => a + (b.total || 0), 0);
  const totalValue = Object.values(summary.by_movement || {}).reduce((a, b) => a + (b.total_value || 0), 0);

  return (
    <div>
      {/* Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Bills', value: totalBills, icon: '📄', color: '#1d4ed8' },
          { label: 'Total Value', value: '₹' + (totalValue / 100000).toFixed(1) + 'L', icon: '💰', color: '#166534' },
          { label: 'Expiring Soon', value: summary.expiring_soon || 0, icon: '⏳', color: '#92400e' },
          { label: 'Expired (active)', value: summary.expired_active || 0, icon: '🔴', color: '#991b1b' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 28 }}>{k.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color, marginTop: 4 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Movement Breakdown */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, color: '#374151', marginBottom: 14 }}>📊 Movement Breakdown</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              {['Movement Type', 'Active', 'Delivered', 'Expired', 'Total', 'Total Value'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: h === 'Movement Type' ? 'left' : 'right', fontWeight: 600, color: '#6b7280' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(summary.by_movement || {}).map(([type, stats]) => {
              const mv = MOVEMENT_LABELS[type] || MOVEMENT_LABELS.unclassified;
              return (
                <tr key={type} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px' }}><Badge text={mv.label} color={mv.color} bg={mv.bg} /></td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#166534', fontWeight: 600 }}>{stats.active || 0}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1d4ed8' }}>{stats.delivered || 0}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#991b1b' }}>{stats.expired || 0}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{stats.total || 0}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>₹{((stats.total_value || 0) / 100000).toFixed(2)}L</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {summary.unclassified_count > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400e' }}>
          ⚠️ {summary.unclassified_count} unclassified bills — go to Bills List and click "Re-classify All" or update manually.
        </div>
      )}

      {/* Hub Cards */}
      {summary.by_hub && summary.by_hub.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 12, fontSize: 14 }}>🏭 By Hub (Origin)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {summary.by_hub.map(hub => (
              <div key={hub.name} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', borderLeft: '4px solid #3b82f6' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a8a', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={hub.name}>
                  {hub.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                  <span>Total</span><span style={{ fontWeight: 700, color: '#111827' }}>{hub.total}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                  <span>Active</span><span style={{ fontWeight: 600, color: '#166534' }}>{hub.active}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                  <span>Delivered</span><span style={{ color: '#1d4ed8' }}>{hub.delivered}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280' }}>
                  <span>Destinations</span><span>{hub.destinations}</span>
                </div>
                {hub.total_value > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280', borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>
                    ₹{(hub.total_value / 100000).toFixed(2)}L value
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Distributor / Dealer Cards */}
      {summary.by_distributor && summary.by_distributor.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 12, fontSize: 14 }}>🏪 By Distributor / Dealer (Destination)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {summary.by_distributor.map(dist => (
              <div key={dist.name} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', borderLeft: '4px solid #10b981' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={dist.name}>
                  {dist.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                  <span>Total</span><span style={{ fontWeight: 700, color: '#111827' }}>{dist.total}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                  <span>Active</span><span style={{ fontWeight: 600, color: '#166534' }}>{dist.active}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                  <span>Delivered</span><span style={{ color: '#1d4ed8' }}>{dist.delivered}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280' }}>
                  <span>Sources</span><span>{dist.sources}</span>
                </div>
                {dist.total_value > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280', borderTop: '1px solid #f3f4f6', paddingTop: 6 }}>
                    ₹{(dist.total_value / 100000).toFixed(2)}L value
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── UNMATCHED POIS TAB ──────────────────────────────────────────────────────
function PoiPicker({ suggestions, placeholder, onSelect, value }) {
  const [query, setQuery] = useState(value?.poi_name || '');
  const [results, setResults] = useState(suggestions || []);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = async (q) => {
    setQuery(q);
    if (!q.trim()) { setResults(suggestions || []); return; }
    setFetching(true);
    try {
      const data = await apiClient.get(`${API}/suggest-pois?q=${encodeURIComponent(q)}`);
      setResults(data.pois || []);
    } catch { setResults([]); }
    setFetching(false);
  };

  const pick = (poi) => {
    setQuery(poi.poi_name);
    setOpen(false);
    onSelect(poi);
  };

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 180 }}>
      <input
        value={query}
        onChange={e => { search(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
      />
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 200, overflowY: 'auto' }}>
          {fetching && <div style={{ padding: '6px 10px', fontSize: 12, color: '#9ca3af' }}>Searching…</div>}
          {!fetching && results.length === 0 && <div style={{ padding: '6px 10px', fontSize: 12, color: '#9ca3af' }}>No POIs found</div>}
          {results.map(p => (
            <div key={p.id} onClick={() => pick(p)}
              style={{ padding: '7px 10px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: 12 }}
              onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <span style={{ fontWeight: 600, color: '#1d4ed8' }}>{p.poi_name}</span>
              {p.city && <span style={{ color: '#6b7280', marginLeft: 6 }}>{p.city}</span>}
              {p.pin_code && <span style={{ color: '#9ca3af', marginLeft: 4 }}>- {p.pin_code}</span>}
              {p.type && <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px', background: '#e0e7ff', color: '#3730a3', borderRadius: 4 }}>{p.type}</span>}
              {p.score > 0 && <span style={{ marginLeft: 6, fontSize: 10, color: '#6b7280' }}>score:{p.score}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UnmatchedPoisTab() {
  const [bills, setBills] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(5);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState({});
  const [assigns, setAssigns] = useState({});   // { [billId]: { from?: poi, to?: poi } }
  const [rematching, setRematching] = useState(false);
  const [rematchResult, setRematchResult] = useState(null);
  // POI discovery: inline create form state keyed by `${billId}:${side}`
  const [createForms, setCreateForms] = useState({});  // { [key]: { name, city, pin, submitting, error } }
  const PER_PAGE = 25;

  const fetchBills = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ threshold, page, per_page: PER_PAGE });
    try {
      const data = await apiClient.get(`${API}/unmatched-pois?${params}`);
      setBills(data.bills || []);
      setTotal(data.total || 0);
    } catch { setBills([]); }
    setLoading(false);
  }, [threshold, page]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const setAssign = (billId, side, poi) => {
    setAssigns(a => ({ ...a, [billId]: { ...(a[billId] || {}), [side]: poi } }));
  };

  const save = async (bill) => {
    const asgn = assigns[bill.id] || {};
    const fromPoi = asgn.from;
    const toPoi   = asgn.to;
    if (!fromPoi && !toPoi) return;

    const payload = {};
    if (fromPoi) { payload.from_poi_id = fromPoi.id; payload.from_poi_name = fromPoi.poi_name; }
    if (toPoi)   { payload.to_poi_id   = toPoi.id;   payload.to_poi_name   = toPoi.poi_name; }

    setSaving(s => ({ ...s, [bill.id]: true }));
    try {
      await apiClient.patch(`${API}/${bill.id}`, payload);
      setAssigns(a => { const n = { ...a }; delete n[bill.id]; return n; });
      fetchBills();
    } catch { /* handled silently */ }
    setSaving(s => ({ ...s, [bill.id]: false }));
  };

  const rematchAll = async () => {
    setRematching(true);
    setRematchResult(null);
    try {
      const data = await apiClient.post(`${API}/rematch-pois`, { threshold });
      setRematchResult(data);
      fetchBills();
    } catch { setRematchResult({ error: 'Request failed' }); }
    setRematching(false);
  };

  const isDirty = (billId) => !!(assigns[billId]?.from || assigns[billId]?.to);

  const openCreate = (bill, side) => {
    const key = `${bill.id}:${side}`;
    const tradeName = side === 'from' ? bill.from_trade_name : bill.to_trade_name;
    const place     = side === 'from' ? bill.from_place      : bill.to_place;
    const pin       = side === 'from' ? bill.from_pincode    : bill.to_pincode;

    // If another row with the same trade+pin already has the form open, skip
    const alreadyOpen = bills.some(b => {
      const bTrade = side === 'from' ? b.from_trade_name : b.to_trade_name;
      const bPin   = side === 'from' ? b.from_pincode    : b.to_pincode;
      return b.id !== bill.id && bTrade === tradeName && bPin === pin && createForms[`${b.id}:${side}`];
    });
    if (alreadyOpen) return;

    const suggested = tradeName
      ? `${tradeName.trim().toUpperCase()}${place ? ', ' + place.trim() : ''}`
      : (place || '');
    setCreateForms(f => ({ ...f, [key]: { name: suggested, city: place || '', pin: pin || '', submitting: false, error: null } }));
  };

  const cancelCreate = (billId, side) => {
    const key = `${billId}:${side}`;
    setCreateForms(f => { const n = { ...f }; delete n[key]; return n; });
  };

  const submitCreate = async (bill, side) => {
    const key = `${bill.id}:${side}`;
    const form = createForms[key];
    if (!form?.name?.trim()) return;
    setCreateForms(f => ({ ...f, [key]: { ...f[key], submitting: true, error: null } }));
    try {
      const data = await apiClient.post(`${API}/create-poi`, { poi_name: form.name.trim(), city: form.city.trim(), pin_code: form.pin.trim(), type: 'secondary' });
      if (!data.success) throw new Error(data.error || 'Create failed');
      const newPoi = data.poi;

      // Auto-assign the new POI to ALL bills in the current list with the same
      // trade name + pincode on the same side (not just this one row)
      const tradeName = side === 'from' ? bill.from_trade_name : bill.to_trade_name;
      const pincode   = side === 'from' ? bill.from_pincode    : bill.to_pincode;
      setAssigns(prev => {
        const next = { ...prev };
        bills.forEach(b => {
          const bTrade = side === 'from' ? b.from_trade_name : b.to_trade_name;
          const bPin   = side === 'from' ? b.from_pincode    : b.to_pincode;
          const bPoiId = side === 'from' ? b.from_poi_id     : b.to_poi_id;
          if (!bPoiId && bTrade === tradeName && bPin === pincode) {
            next[b.id] = { ...(next[b.id] || {}), [side]: newPoi };
          }
        });
        return next;
      });

      // Close all open create forms for this same trade+pin combo
      setCreateForms(f => {
        const n = { ...f };
        bills.forEach(b => {
          const bTrade = side === 'from' ? b.from_trade_name : b.to_trade_name;
          const bPin   = side === 'from' ? b.from_pincode    : b.to_pincode;
          if (bTrade === tradeName && bPin === pincode) delete n[`${b.id}:${side}`];
        });
        return n;
      });
    } catch (e) {
      setCreateForms(f => ({ ...f, [key]: { ...f[key], submitting: false, error: e.message } }));
    }
  };

  // Render: PoiPicker + 📍 New button, expands to inline create form
  const renderPoiCell = (bill, side, suggestions, selectedPoi) => {
    const key  = `${bill.id}:${side}`;
    const form = createForms[key];
    if (form) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, padding: '7px 9px' }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <input
                value={form.name}
                onChange={e => setCreateForms(f => ({ ...f, [key]: { ...f[key], name: e.target.value } }))}
                placeholder="POI name"
                style={{ flex: 1, fontSize: 11, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 5, fontWeight: 600 }}
              />
              <button onClick={() => cancelCreate(bill.id, side)}
                style={{ padding: '3px 7px', fontSize: 11, border: 'none', background: '#f3f4f6', borderRadius: 5, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                value={form.city}
                onChange={e => setCreateForms(f => ({ ...f, [key]: { ...f[key], city: e.target.value } }))}
                placeholder="City"
                style={{ flex: 1, fontSize: 11, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 5 }}
              />
              <input
                value={form.pin}
                onChange={e => setCreateForms(f => ({ ...f, [key]: { ...f[key], pin: e.target.value } }))}
                placeholder="PIN"
                style={{ width: 64, fontSize: 11, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 5 }}
              />
            </div>
            {form.error && <div style={{ fontSize: 10, color: '#dc2626', marginTop: 3 }}>{form.error}</div>}
            <button
              onClick={() => submitCreate(bill, side)}
              disabled={form.submitting || !form.name.trim()}
              style={{ marginTop: 5, width: '100%', padding: '5px 0', fontSize: 11, fontWeight: 700, background: form.submitting ? '#d1d5db' : '#166534', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
              {form.submitting ? '⏳ Creating…' : '📍 Create & Assign'}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <PoiPicker
          key={`${bill.id}-${side}-picker`}
          suggestions={suggestions || []}
          placeholder="Search or pick POI…"
          value={selectedPoi || null}
          onSelect={poi => setAssign(bill.id, side, poi)}
        />
        <button
          onClick={() => openCreate(bill, side)}
          style={{ alignSelf: 'flex-start', padding: '3px 8px', fontSize: 10, fontWeight: 600, background: '#f0fdf4', color: '#166534', border: '1px solid #86efac', borderRadius: 5, cursor: 'pointer' }}>
          📍 New POI
        </button>
      </div>
    );
  };

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 16px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Match Threshold</span>
          <input type="range" min="0" max="25" value={threshold} onChange={e => { setThreshold(Number(e.target.value)); setPage(1); }}
            style={{ width: 120, cursor: 'pointer' }} />
          <span style={{ fontWeight: 700, color: '#1d4ed8', minWidth: 22, textAlign: 'center' }}>{threshold}</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>(lower = more suggestions)</span>
        </div>

        <button onClick={rematchAll} disabled={rematching}
          style={{ padding: '9px 18px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {rematching ? '⏳ Re-matching…' : `🔄 Auto Re-match All (score ≥ ${threshold})`}
        </button>

        <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: total > 0 ? '#dc2626' : '#166534' }}>
          {total} unmatched {total > 0 ? '⚠️' : '✅'}
        </div>
      </div>

      {rematchResult && (
        <div style={{ marginBottom: 12, padding: '10px 14px', background: rematchResult.error ? '#fee2e2' : '#f0fdf4', border: `1px solid ${rematchResult.error ? '#fca5a5' : '#86efac'}`, borderRadius: 8, fontSize: 13 }}>
          {rematchResult.error
            ? <span style={{ color: '#991b1b' }}>Error: {rematchResult.error}</span>
            : <span style={{ color: '#166534' }}>✅ Scanned {rematchResult.scanned} bills — {rematchResult.updated} updated at threshold {rematchResult.threshold}</span>}
        </div>
      )}

      {/* Table */}
      <div style={{ overflow: 'auto', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['EWB No', 'Doc Date', 'From Place', 'From POI (assign)', 'To Place', 'To POI (assign)', 'Value', 'Save'].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading…</td></tr>
            ) : bills.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                  <div style={{ color: '#166534', fontWeight: 600 }}>All bills have POI assignments!</div>
                  <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>Try lowering the threshold to see near-miss suggestions.</div>
                </td>
              </tr>
            ) : bills.map(bill => {
              const dirty = isDirty(bill.id);
              const asgn  = assigns[bill.id] || {};
              return (
                <tr key={bill.id} style={{ background: dirty ? '#fffbeb' : '#fff', borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1d4ed8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{bill.ewb_no || '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{bill.doc_date ? bill.doc_date.slice(0, 10) : '—'}</td>

                  {/* FROM */}
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{bill.from_place || '—'}</div>
                    {bill.from_pincode && <div style={{ fontSize: 10, color: '#9ca3af' }}>{bill.from_pincode}</div>}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {bill.from_poi_id
                      ? <span style={{ fontSize: 12, color: '#166534', fontWeight: 500 }}>✅ {bill.from_poi_name}</span>
                      : renderPoiCell(bill, 'from', bill.from_suggestions, asgn.from)
                    }
                  </td>

                  {/* TO */}
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{bill.to_place || '—'}</div>
                    {bill.to_pincode && <div style={{ fontSize: 10, color: '#9ca3af' }}>{bill.to_pincode}</div>}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {bill.to_poi_id
                      ? <span style={{ fontSize: 12, color: '#166534', fontWeight: 500 }}>✅ {bill.to_poi_name}</span>
                      : renderPoiCell(bill, 'to', bill.to_suggestions, asgn.to)
                    }
                  </td>

                  <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {bill.total_value ? '₹' + Number(bill.total_value).toLocaleString('en-IN') : '—'}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <button
                      onClick={() => save(bill)}
                      disabled={!dirty || saving[bill.id]}
                      style={{
                        padding: '5px 12px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: dirty ? 'pointer' : 'not-allowed',
                        background: dirty ? '#1d4ed8' : '#e5e7eb', color: dirty ? '#fff' : '#9ca3af',
                      }}>
                      {saving[bill.id] ? '…' : '✅ Save'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PER_PAGE && (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>← Prev</button>
          <span style={{ padding: '6px 8px', fontSize: 13, color: '#6b7280' }}>Page {page} of {Math.ceil(total / PER_PAGE)}</span>
          <button disabled={page * PER_PAGE >= total} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ─── ROOT COMPONENT ────────────────────────────────────────────────────────────
// ─── NIC LIVE EWB TAB ─────────────────────────────────────────────────────────
const EWB_API = API_BASE + '/api/ewb';

const EXTEND_REASONS = [
  { value: '1', label: 'Natural Calamity' },
  { value: '2', label: 'Law & Order Problem' },
  { value: '3', label: 'Transshipment' },
  { value: '4', label: 'Accident' },
  { value: '5', label: 'Others' },
];

function hoursColor(h) {
  if (h == null) return { color: '#6b7280', bg: '#f3f4f6' };
  if (h < 0)  return { color: '#991b1b', bg: '#fee2e2' };
  if (h < 12) return { color: '#92400e', bg: '#fef3c7' };
  if (h < 24) return { color: '#1d4ed8', bg: '#dbeafe' };
  return { color: '#166534', bg: '#dcfce7' };
}

function ExtendModal({ ewb, onClose, onExtended }) {
  const [form, setForm] = React.useState({
    from_place: '', from_state: '06', remaining_distance: '100',
    exten_reason: '5', exten_remarks: '', trans_doc_no: '',
  });
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleExtend = async () => {
    if (!form.from_place.trim()) { alert('Enter current location (From Place)'); return; }
    setLoading(true); setResult(null);
    try {
      const data = await apiClient.post(`${EWB_API}/extend-validity`, {
        ewb_no: ewb.ewb_no,
        vehicle_no: ewb.vehicle_no,
        from_place: form.from_place,
        from_state: form.from_state,
        remaining_distance: parseInt(form.remaining_distance) || 100,
        exten_reason: form.exten_reason,
        exten_remarks: form.exten_remarks,
        trans_doc_no: form.trans_doc_no,
      });
      setResult(data);
      if (data.status === 'success') onExtended && onExtended(ewb.ewb_no, data.new_validity);
    } catch (e) {
      setResult({ status: 'error', message: e.message });
    }
    setLoading(false);
  };

  const labelStyle = { fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 3, display: 'block' };
  const inputStyle = { width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 460, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>⏳ Extend EWB Validity</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>

        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#374151' }}>
          <b>EWB:</b> {ewb.ewb_no} &nbsp;|&nbsp; <b>Vehicle:</b> {ewb.vehicle_no} &nbsp;|&nbsp;
          <b>To:</b> {ewb.consignee_name || ewb.to_place} &nbsp;|&nbsp;
          <b>Valid upto:</b> <span style={{ color: '#dc2626', fontWeight: 700 }}>{ewb.valid_upto}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Current Location (From Place) *</label>
            <input style={inputStyle} placeholder="e.g. Gurgaon" value={form.from_place} onChange={e => set('from_place', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Remaining Distance (km)</label>
              <input style={inputStyle} type="number" min="1" value={form.remaining_distance} onChange={e => set('remaining_distance', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>State Code</label>
              <input style={inputStyle} value={form.from_state} onChange={e => set('from_state', e.target.value)} placeholder="06" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Reason for Extension</label>
            <select style={inputStyle} value={form.exten_reason} onChange={e => set('exten_reason', e.target.value)}>
              {EXTEND_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Remarks</label>
            <input style={inputStyle} placeholder="Brief reason..." value={form.exten_remarks} onChange={e => set('exten_remarks', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Transport Doc No (optional)</label>
            <input style={inputStyle} placeholder="LR / Challan number" value={form.trans_doc_no} onChange={e => set('trans_doc_no', e.target.value)} />
          </div>
        </div>

        {result && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: result.status === 'success' ? '#dcfce7' : '#fee2e2', color: result.status === 'success' ? '#166534' : '#991b1b', fontSize: 13 }}>
            {result.status === 'success'
              ? `✅ Extended! New validity: ${result.new_validity}`
              : `❌ ${result.message}`}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 11 }}>Cancel</button>
          <button onClick={handleExtend} disabled={loading}
            style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: loading ? '#93c5fd' : '#2563eb', color: '#fff', fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontSize: 11 }}>
            {loading ? 'Extending...' : 'Extend Validity'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CompleteModal({ ewb, onClose, onCompleted }) {
  const [munshis, setMunshis] = React.useState([]);
  const [selMunshi, setSelMunshi] = React.useState(ewb.munshi_id ? String(ewb.munshi_id) : '');
  const [exp, setExp] = React.useState({ km: '', toll: '', exp_admin: '', exp_munshi: '', exp_cash_fuel: '', exp_unloading: '', exp_other: '' });
  const [notes, setNotes] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    apiClient.get('/api/munshis').then(d => setMunshis(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const selM = munshis.find(m => String(m.id) === selMunshi);
  const sE = (k, v) => setExp(e => ({ ...e, [k]: v }));

  const handleSave = async () => {
    if (!selMunshi) { setErr('Please select a Munshi'); return; }
    setLoading(true); setErr('');
    try {
      // 1. Mark EWB delivered + assign munshi
      const pd = await apiClient.patch(`${API}/${ewb.id}`, { status: 'delivered', munshi_id: selMunshi, munshi_name: selM?.name || '' });
      if (pd.error) throw new Error(pd.error);

      // 2. Create munshi trip with linked expense
      await apiClient.post('/api/munshi-trips', {
        vehicle_no: ewb.vehicle_no || '',
        ewb_no: ewb.ewb_no,
        from_poi_name: ewb.from_poi_name || ewb.from_place || '',
        to_poi_name: ewb.to_poi_name || ewb.to_place || '',
        trip_date: new Date().toISOString().slice(0, 10),
        munshi_id: selMunshi,
        munshi_name: selM?.name || '',
        km: parseFloat(exp.km) || 0,
        toll: parseFloat(exp.toll) || 0,
        exp_admin: parseFloat(exp.exp_admin) || 0,
        exp_munshi: parseFloat(exp.exp_munshi) || 0,
        exp_cash_fuel: parseFloat(exp.exp_cash_fuel) || 0,
        exp_unloading: parseFloat(exp.exp_unloading) || 0,
        exp_other: parseFloat(exp.exp_other) || 0,
        notes,
        status: 'open',
      });
      setDone(true);
      setTimeout(() => { onCompleted && onCompleted(ewb.ewb_no, selM?.name || ''); }, 1400);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };

  const lS = { fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 3, display: 'block' };
  const iS = { width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 500, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>✅ Mark EWB Delivered</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>

        <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#374151', border: '1px solid #bbf7d0' }}>
          <b>EWB:</b> {ewb.ewb_no} &nbsp;|&nbsp; <b>Vehicle:</b> {ewb.vehicle_no || '—'} &nbsp;|&nbsp;
          <b>To:</b> {ewb.consignee_name || ewb.to_place || '—'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={lS}>Munshi *</label>
            <select style={iS} value={selMunshi} onChange={e => setSelMunshi(e.target.value)}>
              <option value="">— Select Munshi —</option>
              {munshis.map(m => <option key={m.id} value={String(m.id)}>{m.name}{m.phone ? ` (${m.phone})` : ''}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              ['km', 'KM Travelled'],
              ['toll', 'Toll (₹)'],
              ['exp_admin', 'Admin Exp (₹)'],
              ['exp_munshi', 'Munshi Exp (₹)'],
              ['exp_cash_fuel', 'Cash Fuel (₹)'],
              ['exp_unloading', 'Unloading (₹)'],
              ['exp_other', 'Other Exp (₹)'],
            ].map(([k, label]) => (
              <div key={k}>
                <label style={lS}>{label}</label>
                <input style={iS} type="number" min="0" step="0.01" placeholder="0"
                  value={exp[k]} onChange={e => sE(k, e.target.value)} />
              </div>
            ))}
          </div>

          <div>
            <label style={lS}>Notes (optional)</label>
            <input style={iS} placeholder="e.g. delivered at warehouse gate" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {err && <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, background: '#fee2e2', color: '#991b1b', fontSize: 13 }}>❌ {err}</div>}
        {done && <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, background: '#dcfce7', color: '#166534', fontSize: 13, fontWeight: 700 }}>✅ EWB marked delivered & trip expense saved!</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 11 }}>Cancel</button>
          <button onClick={handleSave} disabled={loading || done}
            style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: loading || done ? '#86efac' : '#16a34a', color: '#fff', fontWeight: 700, cursor: loading || done ? 'default' : 'pointer', fontSize: 11 }}>
            {loading ? 'Saving…' : done ? '✅ Done' : '✅ Save & Mark Delivered'}
          </button>
        </div>
      </div>
    </div>
  );
}

function NicLiveTab() {
  const [activeList, setActiveList] = React.useState([]);
  const [listLoading, setListLoading] = React.useState(false);
  const [listError, setListError] = React.useState('');

  const [searchNo, setSearchNo] = React.useState('');
  const [searchResult, setSearchResult] = React.useState(null);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState('');

  const [extendTarget, setExtendTarget] = React.useState(null);
  const [completeTarget, setCompleteTarget] = React.useState(null);
  const [filterMode, setFilterMode] = React.useState('all'); // all | expiring | expired
  const [syncing, setSyncing] = React.useState(false);
  const [syncMsg, setSyncMsg] = React.useState('');

  const loadList = React.useCallback(async () => {
    setListLoading(true); setListError('');
    try {
      const data = await apiClient.get(`${EWB_API}/active-list`);
      setActiveList(data);
    } catch (e) { setListError(e.message); }
    setListLoading(false);
  }, []);

  const handleSyncLastDays = React.useCallback(async (days = 5) => {
    setSyncing(true); setSyncMsg('');
    try {
      const data = await apiClient.post(`${EWB_API}/sync-last-days`, { days });
      if (data.status === 'error') throw new Error(data.message);
      setSyncMsg(`✅ Synced ${data.synced} EWBs (last ${days} days since ${data.since})`);
      await loadList();
    } catch (e) { setSyncMsg(`❌ ${e.message}`); }
    setSyncing(false);
  }, [loadList]);

  const handleFetchToday = React.useCallback(async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const data = await apiClient.post(`${EWB_API}/fetch-today`, { days_back: 1 });
      if (data.error) throw new Error(data.error);
      const msg = data.new > 0
        ? `✅ ${data.new} new EWB(s) added from Masters India`
        : `✅ No new EWBs — ${data.seen} seen, all already in list`;
      setSyncMsg(msg);
      if (data.new > 0) await loadList();
    } catch (e) { setSyncMsg(`❌ ${e.message}`); }
    setSyncing(false);
  }, [loadList]);

  // On tab open: if list is empty → one-time full month load; otherwise just load list
  React.useEffect(() => {
    const init = async () => {
      setListLoading(true);
      try {
        const data = await apiClient.get(`${EWB_API}/active-list`);
        if (data.length === 0) {
          // First time — load entire current month
          setSyncing(true); setSyncMsg("⏳ First load: syncing this month's EWBs…");
          const d2 = await apiClient.post(`${EWB_API}/sync-this-month`, {});
          setSyncMsg(`✅ Loaded ${d2.synced} EWBs for this month (since ${d2.since})`);
          setSyncing(false);
          await loadList();
        } else {
          setActiveList(data);
        }
      } catch (e) { setListError(e.message); }
      setListLoading(false);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async () => {
    const no = searchNo.trim();
    if (!no) return;
    setSearchLoading(true); setSearchError(''); setSearchResult(null);
    try {
      const data = await apiClient.get(`${EWB_API}/details/${encodeURIComponent(no)}`);
      if (data.status === 'error') { setSearchError(data.message); }
      else { setSearchResult(data.data); }
    } catch (e) { setSearchError(e.message); }
    setSearchLoading(false);
  };

  const handleExtended = (ewbNo, newValidity) => {
    setActiveList(list => list.map(e => e.ewb_no === ewbNo ? { ...e, valid_upto: newValidity, hours_left: null, expiring_soon: false } : e));
    setExtendTarget(null);
  };

  const handleCompleted = (ewbNo, munshiName) => {
    setActiveList(list => list.map(e => e.ewb_no === ewbNo ? { ...e, status: 'DEL', delivered_at: new Date().toISOString(), munshi_name: munshiName } : e));
    setCompleteTarget(null);
  };

  const handleGpsConfirm = async (e) => {
    const r = await apiClient.patch(`${API}/${e.id}`, { status: 'delivered' });
    if (r && !r.error) setActiveList(list => list.map(x => x.ewb_no === e.ewb_no ? { ...x, status: 'DEL' } : x));
  };

  const [statusFilter, setStatusFilter] = React.useState('all'); // all | ACT | DEL
  const [nicFetching, setNicFetching] = React.useState(false);
  const [nicMsg, setNicMsg] = React.useState('');
  const [nicDate, setNicDate] = React.useState(() => {
    const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  });

  const handleFetchFromNic = async () => {
    setNicFetching(true); setNicMsg('');
    try {
      const data = await apiClient.post(`${EWB_API}/fetch-from-nic`, { date: nicDate, status: 'ACT' });
      if (data.status === 'error') throw new Error(data.message);
      if (data.status === 'nic_error') {
        setNicMsg(`⚠️ NIC: ${data.message}`);
      } else {
        setNicMsg(`✅ Fetched ${data.fetched} EWBs from NIC (${data.new_in_master} new added)`);
        await loadList();
      }
    } catch (e) { setNicMsg(`❌ ${e.message}`); }
    setNicFetching(false);
  };

  const displayed = activeList.filter(e => {
    if (statusFilter === 'ACT') return e.status === 'ACT' || e.status === 'active';
    if (statusFilter === 'DEL') return e.status === 'DEL' || e.status === 'delivered';
    if (statusFilter === 'arrived') return e.status === 'at_destination';
    if (filterMode === 'expired') return e.is_expired;
    if (filterMode === 'expiring') return e.expiring_soon;
    return true;
  });

  const arrivedCount  = activeList.filter(e => e.status === 'at_destination').length;
  const expiredCount  = activeList.filter(e => e.is_expired).length;
  const expiringCount = activeList.filter(e => e.expiring_soon).length;
  const actCount = activeList.filter(e => e.status === 'ACT' || e.status === 'active').length;
  const delCount = activeList.filter(e => e.status === 'DEL' || e.status === 'delivered').length;

  const rowStyle = { display: 'grid', gridTemplateColumns: '130px 1fr 1fr 90px 110px 170px', gap: 8, alignItems: 'center', padding: '8px 12px', fontSize: 12 };

  return (
    <div>
      {/* Pull from NIC */}
      <div style={{ background: '#fff', border: '2px solid #2563eb', borderRadius: 10, padding: 16, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: '#1e40af' }}>📡 Pull EWBs from NIC (Your GSTIN: 06AAGCB1286Q006)</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Date:</span>
          <input
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, width: 120 }}
            value={nicDate}
            onChange={e => setNicDate(e.target.value)}
            placeholder="DD/MM/YYYY"
          />
          <button onClick={handleFetchFromNic} disabled={nicFetching}
            style={{ padding: '7px 22px', borderRadius: 6, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {nicFetching ? '⏳ Fetching…' : '📡 Pull from NIC'}
          </button>
          <span style={{ fontSize: 11, color: '#6b7280' }}>Pulls active EWBs for your GSTIN from NIC sandbox API</span>
        </div>
        {nicMsg && <div style={{ marginTop: 8, fontSize: 12, color: nicMsg.startsWith('✅') ? '#15803d' : nicMsg.startsWith('⚠️') ? '#92400e' : '#dc2626', fontWeight: 600 }}>{nicMsg}</div>}
      </div>

      {/* Search by EWB No */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>🔍 Fetch EWB from NIC</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
            placeholder="Enter EWB Number (e.g. 481234567890)"
            value={searchNo}
            onChange={e => setSearchNo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} disabled={searchLoading}
            style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {searchLoading ? '...' : 'Fetch'}
          </button>
        </div>
        {searchError && <div style={{ marginTop: 8, color: '#dc2626', fontSize: 12 }}>❌ {searchError}</div>}
        {searchResult && (
          <div style={{ marginTop: 12, background: '#f8fafc', borderRadius: 8, padding: 14, fontSize: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              ['EWB No', searchResult.ewbNo || searchResult.EwbNo],
              ['Vehicle', searchResult.vehicleNo || searchResult.VehicleNo],
              ['Valid Upto', searchResult.validUpto || searchResult.ValidUpto],
              ['Status', searchResult.status || searchResult.Status],
              ['From', searchResult.fromAddr || searchResult.fromTrdName],
              ['To', searchResult.toAddr || searchResult.toTrdName],
              ['From Place', searchResult.fromPlace],
              ['To Place', searchResult.toPlace],
              ['Doc No', searchResult.docNo || searchResult.DocNo],
              ['Doc Date', searchResult.docDate],
              ['Item Value', searchResult.totInvValue != null ? `₹${Number(searchResult.totInvValue).toLocaleString('en-IN')}` : null],
              ['Distance', searchResult.actDist != null ? `${searchResult.actDist} km` : null],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><span style={{ color: '#6b7280', fontWeight: 600 }}>{k}:</span> <span style={{ fontWeight: 500 }}>{v}</span></div>
            ))}
          </div>
        )}
      </div>

      {/* Active EWB List */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>📋 This Month's EWBs — {activeList.length} total</span>
          {actCount > 0 && <Badge text={`🟢 ${actCount} Active`} color="#166534" bg="#dcfce7" />}
          {arrivedCount > 0 && <Badge text={`📍 ${arrivedCount} GPS Arrived`} color="#065f46" bg="#d1fae5" />}
          {delCount > 0 && <Badge text={`✅ ${delCount} Delivered`} color="#374151" bg="#f3f4f6" />}
          {expiredCount > 0 && <Badge text={`🔴 ${expiredCount} Expired`} color="#991b1b" bg="#fee2e2" />}
          {expiringCount > 0 && <Badge text={`⏳ ${expiringCount} Expiring <24h`} color="#92400e" bg="#fef3c7" />}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[['all', 'All'], ['ACT', '🟢 Active'], ['arrived', '📍 GPS Arrived'], ['DEL', '✅ Delivered'], ['expiring', '⏳ Expiring'], ['expired', '🔴 Expired']].map(([k, l]) => {
              const isActive = statusFilter !== 'all' ? statusFilter === k : filterMode === k || k === 'all';
              return (
                <button key={k} onClick={() => { if (k === 'expiring' || k === 'expired') { setStatusFilter('all'); setFilterMode(k); } else if (k === 'arrived') { setStatusFilter('arrived'); setFilterMode('all'); } else { setStatusFilter(k); setFilterMode('all'); } }}
                  style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid', fontSize: 12, cursor: 'pointer',
                    background: isActive ? '#2563eb' : '#fff',
                    color: isActive ? '#fff' : '#374151',
                    borderColor: isActive ? '#2563eb' : '#d1d5db' }}>
                  {l}
                </button>
              );
            })}
            <button onClick={loadList} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 11, cursor: 'pointer', background: '#fff' }}>🔄 Refresh</button>
            <button onClick={handleFetchToday} disabled={syncing}
              style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid #2563eb', fontSize: 12, cursor: 'pointer', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}>
              {syncing ? '⏳ Fetching…' : '📥 Fetch Today\'s EWBs'}
            </button>
            <button onClick={() => handleSyncLastDays(5)} disabled={syncing}
              style={{ padding: '4px 14px', borderRadius: 6, border: '1px solid #16a34a', fontSize: 12, cursor: 'pointer', background: '#f0fdf4', color: '#15803d', fontWeight: 700 }}>
              {syncing ? '⏳ Syncing…' : '⬇️ Sync Last 5 Days'}
            </button>
          </div>
        </div>

        {syncMsg && <div style={{ fontSize: 12, marginBottom: 8, color: syncMsg.startsWith('✅') ? '#15803d' : '#dc2626' }}>{syncMsg}</div>}
        {listError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>❌ {listError} — <button onClick={loadList} style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 11 }}>Retry</button></div>}
        {listLoading && <div style={{ color: '#6b7280', fontSize: 12 }}>Loading...</div>}

        {!listLoading && activeList.length === 0 && (
          <div style={{ color: '#6b7280', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
            No active EWBs in local DB. Use <b>Sync</b> to pull from NIC, or import from Excel.
          </div>
        )}

        {displayed.length > 0 && (
          <>
            <div style={{ ...rowStyle, background: '#f1f5f9', borderRadius: 6, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
              <span>EWB No</span><span>Vehicle</span><span>Consignee → Place</span><span>Doc Date</span><span>Status</span><span>Action</span>
            </div>
            {displayed.map(e => {
              const isDel = e.status === 'DEL';
              const hc = isDel ? { background: '#f3f4f6', color: '#9ca3af' } : hoursColor(e.hours_left);
              return (
                <div key={e.ewb_no} style={{ ...rowStyle, borderBottom: '1px solid #f1f5f9', opacity: isDel ? 0.65 : 1 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 11, textDecoration: isDel ? 'line-through' : 'none', color: isDel ? '#9ca3af' : '#111827' }}>{e.ewb_no}</span>
                  <span style={{ fontWeight: 600, color: isDel ? '#9ca3af' : '#111827' }}>{e.vehicle_no || '—'}</span>
                  <span style={{ color: isDel ? '#9ca3af' : '#374151' }}>
                    {e.consignee_name ? <><b>{e.consignee_name}</b><br /></> : null}
                    <span style={{ color: '#6b7280' }}>{e.to_place || '—'}</span>
                  </span>
                  <span style={{ fontSize: 11, color: '#374151' }}>{e.doc_date || '—'}</span>
                  <span>
                    {isDel
                      ? <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>✅ Delivered</span>
                      : e.status === 'at_destination'
                        ? <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>📍 GPS Arrived</span>
                        : e.hours_left != null
                          ? <span style={{ ...hc, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                              {e.is_expired ? 'EXPIRED' : `${e.hours_left}h`}
                            </span>
                          : <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>Active</span>}
                  </span>
                  <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {!isDel && e.status === 'at_destination' && (
                      <>
                        <button onClick={() => handleGpsConfirm(e)}
                          style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #16a34a', background: '#f0fdf4', color: '#166534', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          ✅ GPS Confirm
                        </button>
                        <button onClick={() => setCompleteTarget(e)}
                          style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #6b7280', background: '#f9fafb', color: '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          + Expense
                        </button>
                      </>
                    )}
                    {!isDel && e.status !== 'at_destination' && (
                      <>
                        <button onClick={() => setExtendTarget(e)}
                          style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #2563eb', background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          Extend
                        </button>
                        <button onClick={() => setCompleteTarget(e)}
                          style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #16a34a', background: '#f0fdf4', color: '#166534', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          ✅ Done
                        </button>
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {extendTarget && (
        <ExtendModal ewb={extendTarget} onClose={() => setExtendTarget(null)} onExtended={handleExtended} />
      )}
      {completeTarget && (
        <CompleteModal ewb={completeTarget} onClose={() => setCompleteTarget(null)} onCompleted={handleCompleted} />
      )}
    </div>
  );
}

// ─── By POI Tab ─────────────────────────────────────────────────────────────
function ByPoiTab() {
  const [pois, setPois]           = useState([]);
  const [selPoi, setSelPoi]       = useState('');
  const [ewbs, setEwbs]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [dirFilter, setDirFilter] = useState('all'); // 'all'|'outbound'|'inbound'|'active'

  useEffect(() => {
    apiClient.get('/api/pois')
      .then(d => setPois(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selPoi) { setEwbs([]); return; }
    setLoading(true);
    Promise.all([
      apiClient.get(`/api/ewaybills?from_poi_id=${encodeURIComponent(selPoi)}`).catch(() => []),
      apiClient.get(`/api/ewaybills?to_poi_id=${encodeURIComponent(selPoi)}`).catch(() => []),
    ]).then(([from, to]) => {
      const fromArr = (Array.isArray(from) ? from : from.bills || []).map(e => ({ ...e, _dir: 'outbound' }));
      const toArr   = (Array.isArray(to)   ? to   : to.bills   || []).map(e => ({ ...e, _dir: 'inbound'  }));
      const seen = new Set();
      const merged = [...fromArr, ...toArr].filter(e => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setEwbs(merged);
    }).finally(() => setLoading(false));
  }, [selPoi]);

  const closeEwb = async (id) => {
    await apiClient.put(`/api/ewaybills/${id}/close`, {}).catch(() => {});
    setEwbs(prev => prev.map(e => e.id === id ? { ...e, status: 'delivered' } : e));
  };

  const filtered = ewbs.filter(e => {
    if (dirFilter === 'outbound') return e._dir === 'outbound';
    if (dirFilter === 'inbound')  return e._dir === 'inbound';
    if (dirFilter === 'active')   return e.status === 'active';
    return true;
  });

  const chipStyle = (key) => ({
    padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
    background: dirFilter === key ? '#2563eb' : '#1e293b',
    color: dirFilter === key ? '#fff' : '#94a3b8',
  });

  const selPOI = pois.find(p => String(p.id) === String(selPoi));

  return (
    <div style={{ padding: '16px 20px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 14 }}>
        <select value={selPoi} onChange={e => { setSelPoi(e.target.value); setDirFilter('all'); }}
          style={{ width: '100%', padding: '9px 14px', borderRadius: 8, border: '1px solid #334155', background: '#1e293b', color: '#f1f5f9', fontSize: 13, boxSizing: 'border-box' }}>
          <option value="">— Select a POI —</option>
          {pois.map(p => <option key={p.id} value={p.id}>{p.name} ({p.city || p.state || ''})</option>)}
        </select>
      </div>

      {selPoi && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {[['all','All'],['outbound','Outbound'],['inbound','Inbound'],['active','Active']].map(([k,lbl]) => (
              <button key={k} style={chipStyle(k)} onClick={() => setDirFilter(k)}>{lbl}</button>
            ))}
            <span style={{ fontSize: 11, color: '#64748b', marginLeft: 6 }}>{filtered.length} records</span>
          </div>

          {loading && <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading…</div>}

          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: '#64748b', fontSize: 13 }}>
              No EWBs found for this POI with the selected filter.
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#94a3b8', textAlign: 'left' }}>
                    {['EWB No','Vehicle','Date','From → To','Type','Dir','Value','Status',''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', fontWeight: 700, borderBottom: '1px solid #334155', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => {
                    const ml = MOVEMENT_LABELS[e.movement_type] || { label: e.movement_type || '—', color: '#6b7280', bg: '#f3f4f6' };
                    return (
                      <tr key={e.id} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700 }}>{e.ewb_no}</td>
                        <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 11 }}>{e.vehicle_no || '—'}</td>
                        <td style={{ padding: '7px 10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {e.created_at ? new Date(e.created_at).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td style={{ padding: '7px 10px', fontSize: 11, color: '#cbd5e1' }}>
                          {e.from_place || '—'} → {e.to_place || '—'}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          <span style={{ background: ml.bg, color: ml.color, padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {ml.label}
                          </span>
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: e._dir === 'inbound' ? '#22d3ee' : '#a78bfa' }}>
                            {e._dir === 'inbound' ? '⬇ In' : '⬆ Out'}
                          </span>
                        </td>
                        <td style={{ padding: '7px 10px', color: '#f59e0b', fontWeight: 700 }}>
                          {e.total_value ? '₹' + Number(e.total_value).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—'}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: e.status === 'active' ? '#4ade80' : '#94a3b8' }}>
                            {e.status || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          {e.status === 'active' && (
                            <button onClick={() => closeEwb(e.id)}
                              style={{ background: '#1e293b', border: '1px solid #475569', color: '#94a3b8', borderRadius: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}
                            >🔒 Close</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── ASSIGN VEHICLE (PART B) TAB ─────────────────────────────────────────────
function AssignVehicleTab() {
  const [ewbNo, setEwbNo] = useState('');
  const [fetching, setFetching] = useState(false);
  const [ewbData, setEwbData] = useState(null);
  const [fetchErr, setFetchErr] = useState('');

  const [vehicles, setVehicles] = useState([]);
  const [vehicleNo, setVehicleNo] = useState('');
  const [place, setPlace] = useState('');
  const [state, setState] = useState('Rajasthan');
  const [transDocNo, setTransDocNo] = useState('');
  const [transDocDate, setTransDocDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [submitErr, setSubmitErr] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/vehicles?client_id=CLIENT_001&limit=200`)
      .then(r => r.json())
      .then(d => {
        const list = d.vehicles || d.data || d || [];
        setVehicles(Array.isArray(list) ? list : []);
      }).catch(() => {});
  }, []);

  const handleFetch = async () => {
    if (!ewbNo.trim()) return;
    setFetching(true); setFetchErr(''); setEwbData(null); setSubmitResult(null); setSubmitErr('');
    try {
      const res = await fetch(`${API_BASE}/api/ewb/details/${encodeURIComponent(ewbNo.trim())}?client_id=CLIENT_001`);
      const d = await res.json();
      if (d.status === 'ok') {
        setEwbData(d.data);
        // Pre-fill place from consignor info if available
        if (d.data.place_of_consignor) setPlace(d.data.place_of_consignor);
        if (d.data.state_of_consignor) setState(d.data.state_of_consignor);
      } else {
        setFetchErr(d.message || 'EWB not found. Make sure the EWB number is correct and belongs to your GSTIN.');
      }
    } catch (e) { setFetchErr('Network error: ' + e.message); }
    setFetching(false);
  };

  const handleSubmit = async () => {
    if (!vehicleNo) { setSubmitErr('Please select a vehicle'); return; }
    if (!place.trim()) { setSubmitErr('Please enter the current place/location'); return; }
    setSubmitting(true); setSubmitErr(''); setSubmitResult(null);
    try {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2,'0');
      const mm = String(today.getMonth()+1).padStart(2,'0');
      const yyyy = today.getFullYear();
      const res = await fetch(`${API_BASE}/api/ewb/update-vehicle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: 'CLIENT_001',
          ewb_no: ewbNo.trim(),
          vehicle_number: vehicleNo,
          place_of_consignor: place.trim(),
          state_of_consignor: state,
          mode_of_transport: 1,
          reason_code: 'Others',
          transporter_document_number: transDocNo.trim() || '',
          transporter_document_date: transDocDate
            ? (() => { const [y,m,d2] = transDocDate.split('-'); return `${d2}/${m}/${y}`; })()
            : `${dd}/${mm}/${yyyy}`,
        })
      });
      const d = await res.json();
      if (d.status === 'success') {
        setSubmitResult(d);
        // refresh EWB data
        handleFetch();
      } else {
        setSubmitErr(d.message || 'Failed to update vehicle. Check EWB validity.');
      }
    } catch (e) { setSubmitErr('Network error: ' + e.message); }
    setSubmitting(false);
  };

  const infoRow = (label, value, bold) => value ? (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 13 }}>
      <span style={{ color: '#6b7280', minWidth: 160 }}>{label}</span>
      <span style={{ color: '#111827', fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  ) : null;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      {/* Step 1 — Enter EWB number */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#111827' }}>🔍 Step 1 — Enter EWB Number</h3>
        <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 13 }}>
          Customer shares an EWB number with you. Enter it below to fetch Part A details.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={ewbNo}
            onChange={e => setEwbNo(e.target.value.replace(/\D/g,''))}
            onKeyDown={e => e.key === 'Enter' && handleFetch()}
            placeholder="Enter 12-digit EWB number (e.g. 321009218808)"
            maxLength={12}
            style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none' }}
          />
          <button
            onClick={handleFetch}
            disabled={fetching || !ewbNo.trim()}
            style={{ padding: '10px 24px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: fetching ? 'wait' : 'pointer', opacity: !ewbNo.trim() ? 0.5 : 1 }}
          >
            {fetching ? '⏳ Fetching...' : '🔍 Fetch Details'}
          </button>
        </div>
        {fetchErr && <div style={{ marginTop: 10, padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>{fetchErr}</div>}
      </div>

      {/* Step 2 — Part A details */}
      {ewbData && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#111827' }}>📋 Part A — EWB Details</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {ewbData.eway_bill_status && (
                <Badge
                  text={ewbData.eway_bill_status}
                  color={ewbData.eway_bill_status === 'Active' ? '#166534' : '#991b1b'}
                  bg={ewbData.eway_bill_status === 'Active' ? '#dcfce7' : '#fee2e2'}
                />
              )}
              {ewbData.hours_left != null && (
                <Badge
                  text={ewbData.hours_left > 0 ? `⏳ ${ewbData.hours_left}h left` : '🔴 Expired'}
                  color={ewbData.hours_left > 24 ? '#166534' : ewbData.hours_left > 0 ? '#92400e' : '#991b1b'}
                  bg={ewbData.hours_left > 24 ? '#dcfce7' : ewbData.hours_left > 0 ? '#fef3c7' : '#fee2e2'}
                />
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#374151', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>EWB Info</div>
              {infoRow('EWB Number', ewbData.eway_bill_number || ewbNo, true)}
              {infoRow('EWB Date', ewbData.eway_bill_date)}
              {infoRow('Valid Upto', ewbData.eway_bill_valid_date, true)}
              {infoRow('Document No.', ewbData.document_number)}
              {infoRow('Document Date', ewbData.document_date)}
              {infoRow('Invoice Value', ewbData.total_invoice_value != null ? `₹${Number(ewbData.total_invoice_value).toLocaleString('en-IN')}` : null)}
              {infoRow('Distance', ewbData.transportation_distance ? `${ewbData.transportation_distance} km` : null)}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#374151', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Consignor → Consignee</div>
              {infoRow('From', ewbData.legal_name_of_consignor, true)}
              {infoRow('', `${ewbData.place_of_consignor || ''}${ewbData.state_of_consignor ? ', '+ewbData.state_of_consignor : ''}`)}
              {infoRow('GSTIN (Consignor)', ewbData.gstin_of_consignor)}
              {infoRow('To', ewbData.legal_name_of_consignee, true)}
              {infoRow('', `${ewbData.place_of_consignee || ''}${ewbData.state_of_supply ? ', '+ewbData.state_of_supply : ''}`)}
              {infoRow('GSTIN (Consignee)', ewbData.gstin_of_consignee)}
            </div>
          </div>

          {/* Items */}
          {ewbData.itemList && ewbData.itemList.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, color: '#374151', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Goods</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Product', 'HSN', 'Qty', 'Unit', 'Taxable Amount'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#6b7280', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ewbData.itemList.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '6px 10px', color: '#111827' }}>{item.product_name}</td>
                      <td style={{ padding: '6px 10px', color: '#6b7280' }}>{item.hsn_code}</td>
                      <td style={{ padding: '6px 10px', color: '#374151' }}>{item.quantity}</td>
                      <td style={{ padding: '6px 10px', color: '#374151' }}>{item.unit_of_product}</td>
                      <td style={{ padding: '6px 10px', color: '#111827', fontWeight: 600 }}>₹{Number(item.taxable_amount).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Current vehicle assignment if any */}
          {ewbData.VehiclListDetails && ewbData.VehiclListDetails.length > 0 && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 4 }}>Currently Assigned Vehicle</div>
              <div style={{ fontSize: 13, color: '#166534' }}>
                🚛 <strong>{ewbData.VehiclListDetails[0].vehicle_number}</strong>
                {ewbData.VehiclListDetails[0].place_of_consignor && ` — from ${ewbData.VehiclListDetails[0].place_of_consignor}`}
                <span style={{ color: '#6b7280', marginLeft: 8, fontSize: 12 }}>{ewbData.VehiclListDetails[0].vehicle_number_update_date}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Assign vehicle (Part B) */}
      {ewbData && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #bfdbfe', padding: 24 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#1d4ed8' }}>🚛 Step 2 — Assign Vehicle (Part B)</h3>
          <p style={{ margin: '0 0 18px', color: '#6b7280', fontSize: 13 }}>
            This will update Part B on the NIC / Masters India system directly.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Vehicle */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Vehicle Number *</label>
              <select
                value={vehicleNo}
                onChange={e => setVehicleNo(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}
              >
                <option value="">— Select vehicle —</option>
                {vehicles.map(v => {
                  const vno = v.vehicle_no || v.vehicle_number || '';
                  return <option key={vno} value={vno}>{vno}{v.driver_name ? ` (${v.driver_name})` : ''}</option>;
                })}
                <option value="__manual__">✏️ Type manually...</option>
              </select>
              {vehicleNo === '__manual__' && (
                <input
                  placeholder="e.g. RJ14GC5678"
                  onChange={e => setVehicleNo(e.target.value.toUpperCase())}
                  style={{ width: '100%', marginTop: 8, padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
                />
              )}
            </div>

            {/* Current place */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Current Place / Loading Point *</label>
              <input
                value={place}
                onChange={e => setPlace(e.target.value)}
                placeholder="e.g. Jaipur"
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            {/* State */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>State</label>
              <select
                value={state}
                onChange={e => setState(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, background: '#fff' }}
              >
                {['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu and Kashmir','Ladakh'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Transporter Doc No (optional) */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Transporter Doc No <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                value={transDocNo}
                onChange={e => setTransDocNo(e.target.value)}
                placeholder="e.g. LR/2026/0401"
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            {/* Transporter Doc Date (optional) */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Transporter Doc Date <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                type="date"
                value={transDocDate}
                onChange={e => setTransDocDate(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {submitErr && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
              ❌ {submitErr}
            </div>
          )}

          {submitResult && (
            <div style={{ marginTop: 16, padding: '14px 18px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, color: '#166534', fontSize: 13 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>✅ Part B updated successfully!</div>
              <div>Vehicle <strong>{vehicleNo}</strong> assigned to EWB <strong>{ewbNo}</strong> on Masters India.</div>
              {submitResult.api_response?.results?.message?.vehUpdDate && (
                <div style={{ marginTop: 4, color: '#15803d' }}>Updated at: {submitResult.api_response.results.message.vehUpdDate}</div>
              )}
              <div style={{ marginTop: 6, color: '#15803d', fontSize: 12 }}>📋 EWB saved to Bills List — visible in the Bills tab.</div>
            </div>
          )}

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSubmit}
              disabled={submitting || !vehicleNo || vehicleNo === '__manual__' || !place.trim()}
              style={{
                padding: '12px 32px', background: submitting ? '#93c5fd' : '#1d4ed8', color: '#fff',
                border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15,
                cursor: submitting ? 'wait' : 'pointer',
                opacity: (!vehicleNo || vehicleNo === '__manual__' || !place.trim()) ? 0.5 : 1
              }}
            >
              {submitting ? '⏳ Updating...' : '🚛 Assign Vehicle (Update Part B)'}
            </button>
        </div>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { key: 'assign',    label: '🚛 Assign Vehicle (Part B)' },
  { key: 'vehicles',  label: '📍 Vehicle Movement' },
  { key: 'summary',   label: '📊 Summary' },
  { key: 'bills',     label: '📋 Bills List' },
  { key: 'byPoi',    label: '📍 By POI' },
  { key: 'import',    label: '📥 Import' },
  { key: 'warnings',  label: '⚠️ Warnings' },
  { key: 'unmatched', label: '🔗 Unmatched POIs' },
  { key: 'live',      label: '🔴 Live EWB' },
];

export default function EwayBillHub({ defaultTab = 'assign' }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [summary, setSummary] = useState(null);
  const [unmatchedCount, setUnmatchedCount] = useState(0);

  const fetchSummary = useCallback(() => {
    fetch(`${API}/summary`).then(r => r.json()).then(d => setSummary(d)).catch(() => {});
  }, []);

  const fetchUnmatchedCount = useCallback(() => {
    fetch(`${API}/unmatched-pois?per_page=1`)
      .then(r => r.json()).then(d => setUnmatchedCount(d.total || 0)).catch(() => {});
  }, []);

  useEffect(() => { fetchSummary(); fetchUnmatchedCount(); }, [fetchSummary, fetchUnmatchedCount]);

  const tabLabel = (t) => {
    if (t.key === 'unmatched' && unmatchedCount > 0)
      return `${t.label} (${unmatchedCount})`;
    return t.label;
  };

  return (
    <div style={{ minHeight: 0 }}>
      {/* Header + Tab nav combined row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0, borderBottom: '2px solid #e5e7eb', paddingBottom: 0 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: '#111827', whiteSpace: 'nowrap', paddingRight: 8, borderRight: '1px solid #e5e7eb', marginRight: 4 }}>📄 E-Way Bills</span>
        {summary && (
          <div style={{ display: 'flex', gap: 4, marginRight: 8 }}>
            {summary.expiring_soon > 0 && <Badge text={`⏳ ${summary.expiring_soon}`} color="#92400e" bg="#fef3c7" />}
            {summary.expired_active > 0 && <Badge text={`🔴 ${summary.expired_active}`} color="#991b1b" bg="#fee2e2" />}
            {unmatchedCount > 0 && <Badge text={`🔗 ${unmatchedCount}`} color="#6d28d9" bg="#ede9fe" />}
          </div>
        )}
      <div style={{ display: 'flex', gap: 2, flex: 1 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '6px 14px', border: 'none', borderBottom: activeTab === t.key ? '2px solid #1d4ed8' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontWeight: activeTab === t.key ? 700 : 400,
              color: activeTab === t.key ? '#1d4ed8'
                : (t.key === 'unmatched' && unmatchedCount > 0 ? '#7c3aed' : '#6b7280'),
              fontSize: 12, marginBottom: -2, transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {tabLabel(t)}
          </button>
        ))}
      </div>
      </div>

      {/* Tab content */}
      <div style={{ marginTop: 12 }}>
      {activeTab === 'assign'    && <AssignVehicleTab />}
      {activeTab === 'import'    && <ImportTab onImported={() => { fetchSummary(); fetchUnmatchedCount(); }} />}
      {activeTab === 'bills'     && <BillsListTab />}
      {activeTab === 'vehicles'  && <VehicleMovementTab />}
      {activeTab === 'warnings'  && <WarningsTab />}
      {activeTab === 'summary'   && <SummaryTab />}
      {activeTab === 'unmatched' && <UnmatchedPoisTab onSaved={fetchUnmatchedCount} />}
      {activeTab === 'live'      && <NicLiveTab />}
      {activeTab === 'byPoi'     && <ByPoiTab />}
      </div>
    </div>
  );
}
