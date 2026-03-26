/**
 * VehicleSizeImport – read an XLSX/XLS file, detect vehicle type from the
 * spreadsheet's "Type" column (e.g. "34 FT", "24 FT", "Bolero"), let the user
 * review + confirm, then bulk-save vehicle_size via the API.
 */
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

const API = '/api';
const CLIENT_ID = 'CLIENT_001';

// Map spreadsheet type values → DB category keys
// Handles values like "34 FT", "34FT", "34ft", "32 FT", "22 FT", "24 FT",
// "20 FT", "19 FT", "14 FT", "Bolero", "Tempo", etc.
function mapTypeToCategory(raw) {
  if (!raw) return '';
  const t = String(raw).replace(/\s+/g, '').toUpperCase();
  if (/^(32|34)FT$/.test(t)) return 'category_1_32ft_34ft';
  if (/^(22|24)FT$/.test(t)) return 'category_2_22ft_24ft';
  if (/^(8|10|12|14|16|17|18|19|20|21)FT$/.test(t)) return 'category_3_small';
  if (/BOLERO|TEMPO|TATA|ACE|PICKUP|SMALL|VAN/.test(t)) return 'category_3_small';
  return ''; // unknown
}

const CATEGORY_LABEL = {
  category_1_32ft_34ft: '32 / 34 FT (Large)',
  category_2_22ft_24ft: '22 / 24 FT (Medium)',
  category_3_small: 'Small / Bolero / Tempo',
  '': 'Unknown – skip',
};

const BADGE = {
  category_1_32ft_34ft: { bg: '#dbeafe', color: '#1d4ed8' },
  category_2_22ft_24ft: { bg: '#fef9c3', color: '#92400e' },
  category_3_small:     { bg: '#dcfce7', color: '#166534' },
  '':                   { bg: '#f1f5f9', color: '#94a3b8' },
};

export default function VehicleSizeImport({ vehicles, onDone, onClose }) {
  const fileRef = useRef(null);
  const [rows, setRows] = useState(null);       // parsed + matched rows
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);   // { saved, skipped, notFound }
  const [error, setError] = useState('');

  // ---------- parse xlsx ----------
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setRows(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!data.length) { setError('File appears empty.'); return; }

        // Detect column names (case-insensitive)
        const keys = Object.keys(data[0]);
        const findCol = (...candidates) =>
          keys.find(k => candidates.some(c => k.toLowerCase().includes(c.toLowerCase())));

        const vehicleCol = findCol('vehicle no', 'vehicle_no', 'veh no', 'vehicle number', 'reg no', 'registration');
        const typeCol    = findCol('type', 'size', 'vehicle type', 'truck type');

        if (!vehicleCol) { setError(`Could not find a "Vehicle No" column. Found: ${keys.join(', ')}`); return; }
        if (!typeCol)    { setError(`Could not find a "Type" or "Size" column. Found: ${keys.join(', ')}`); return; }

        const parsed = data.map(r => {
          const rawNo   = String(r[vehicleCol] || '').trim().toUpperCase();
          const rawType = String(r[typeCol]    || '').trim();
          const category = mapTypeToCategory(rawType);
          const matched = vehicles.find(v => v.vehicle_no?.toUpperCase() === rawNo);
          return { rawNo, rawType, category, id: matched?.id, alreadySet: matched?.vehicle_size };
        }).filter(r => r.rawNo); // drop blank rows

        setRows(parsed);
      } catch (err) {
        setError('Failed to read file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // allow user to change a row's mapped category
  const setCategory = (idx, cat) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, category: cat } : r));
  };

  // ---------- save ----------
  const handleSave = async () => {
    const toSave = rows.filter(r => r.id && r.category);
    if (!toSave.length) { setError('Nothing to save — no matched rows with a known category.'); return; }

    setSaving(true);
    setError('');
    let saved = 0, failed = 0;

    // find the full vehicle object for each row so we can send all the required fields
    for (const row of toSave) {
      const vehicle = vehicles.find(v => v.id === row.id);
      try {
        const res = await fetch(`${API}/vehicles-master/${row.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...vehicle, vehicle_size: row.category, clientId: CLIENT_ID }),
        });
        if (res.ok) saved++; else failed++;
      } catch { failed++; }
    }

    setSaving(false);
    const skipped = rows.filter(r => !r.id || !r.category).length;
    setResult({ saved, failed, skipped });
    if (saved > 0 && onDone) onDone();
  };

  const toSaveCount  = rows ? rows.filter(r => r.id && r.category).length : 0;
  const unknownCount = rows ? rows.filter(r => r.id && !r.category).length : 0;
  const notFoundCount= rows ? rows.filter(r => !r.id).length : 0;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>
      {/* Drop zone */}
      {!rows && !result && (
        <div>
          <p style={{ color: '#64748b', marginBottom: 12 }}>
            Upload the Excel file that has <strong>Vehicle No</strong> and <strong>Type</strong> columns
            (e.g. "34 FT", "24 FT", "Bolero"). Sizes will be matched and bulk-saved.
          </p>
          <div
            onClick={() => fileRef.current.click()}
            style={{
              border: '2px dashed #93c5fd', borderRadius: 8, padding: '40px 0',
              textAlign: 'center', cursor: 'pointer', background: '#f0f9ff',
              color: '#2563eb', fontWeight: 600, fontSize: 15,
            }}
          >
            📂 Click to choose XLSX / XLS file
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', marginTop: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 6, border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* Preview table */}
      {rows && !result && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#1e293b' }}>{rows.length} rows parsed</span>
            <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 10px', borderRadius: 12, fontSize: 12 }}>✔ {toSaveCount} will be saved</span>
            {unknownCount > 0 && <span style={{ background: '#fef9c3', color: '#92400e', padding: '2px 10px', borderRadius: 12, fontSize: 12 }}>⚠ {unknownCount} unknown type</span>}
            {notFoundCount > 0 && <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 10px', borderRadius: 12, fontSize: 12 }}>✗ {notFoundCount} not in DB</span>}
          </div>

          <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1e293b', color: '#fff', position: 'sticky', top: 0 }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Vehicle No</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Type in File</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>Mapped Category</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>DB Match</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const badge = BADGE[row.category] || BADGE[''];
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '7px 12px', fontWeight: 600, color: '#1e293b' }}>{row.rawNo}</td>
                      <td style={{ padding: '7px 12px', color: '#475569' }}>{row.rawType || '—'}</td>
                      <td style={{ padding: '7px 12px' }}>
                        <select
                          value={row.category}
                          onChange={e => setCategory(idx, e.target.value)}
                          disabled={!row.id}
                          style={{
                            fontSize: 12, padding: '3px 6px', borderRadius: 4,
                            border: `1px solid ${badge.color}`,
                            background: badge.bg, color: badge.color,
                            cursor: row.id ? 'pointer' : 'not-allowed',
                          }}
                        >
                          <option value="">Unknown – skip</option>
                          <option value="category_1_32ft_34ft">32 / 34 FT (Large)</option>
                          <option value="category_2_22ft_24ft">22 / 24 FT (Medium)</option>
                          <option value="category_3_small">Small / Bolero / Tempo</option>
                        </select>
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                        {row.id
                          ? <span style={{ color: '#166534', fontWeight: 600 }}>✔</span>
                          : <span style={{ color: '#dc2626', fontSize: 11 }}>Not found</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={onClose} style={{ padding: '8px 20px', background: '#e2e8f0', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
            <button
              onClick={() => { setRows(null); setError(''); if (fileRef.current) fileRef.current.value = ''; }}
              style={{ padding: '8px 20px', background: '#f0f9ff', color: '#2563eb', border: '1px solid #93c5fd', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
            >
              ↩ Change File
            </button>
            <button
              onClick={handleSave}
              disabled={saving || toSaveCount === 0}
              style={{
                padding: '8px 24px', background: toSaveCount > 0 ? '#2563eb' : '#94a3b8',
                color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700,
                cursor: toSaveCount > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? 'Saving…' : `💾 Save Size for ${toSaveCount} Vehicles`}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#166534', marginBottom: 8 }}>
            {result.saved} vehicle{result.saved !== 1 ? 's' : ''} updated successfully
          </div>
          {result.failed > 0 && <div style={{ color: '#dc2626', marginBottom: 4 }}>{result.failed} failed to save</div>}
          {result.skipped > 0 && <div style={{ color: '#92400e', marginBottom: 4 }}>{result.skipped} skipped (unknown type or not in DB)</div>}
          <button
            onClick={onClose}
            style={{ marginTop: 16, padding: '8px 28px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
