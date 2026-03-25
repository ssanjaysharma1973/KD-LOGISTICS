import React, { useState, useEffect, useCallback, useRef } from 'react';

const API = 'http://localhost:3000/api';

const CATEGORY_STYLES = {
  PRIMARY:   { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', icon: '🏭', label: 'Primary (From Hub)' },
  SECONDARY: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', icon: '🔄', label: 'Secondary (Both)' },
  TERTIARY:  { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7', icon: '📦', label: 'Tertiary (To Only)' },
  OTHER:     { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db', icon: '📍', label: 'Other' },
};

export default function PointDiscovery() {
  const [points, setPoints] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedUpload, setSelectedUpload] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAll, setShowAll] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const fileRef = useRef(null);

  const fetchPoints = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API}/discovered-points?client_id=CLIENT_001`;
      if (categoryFilter) url += `&category=${categoryFilter}`;
      if (selectedUpload) url += `&upload_id=${selectedUpload}`;
      if (showAll) url += `&show_all=true`;
      const res = await fetch(url);
      const data = await res.json();
      setPoints(data.points || []);
    } catch (err) {
      console.error('Fetch points error:', err);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, selectedUpload, showAll]);

  const fetchUploads = useCallback(async () => {
    try {
      const res = await fetch(`${API}/csv-uploads?client_id=CLIENT_001`);
      const data = await res.json();
      setUploads(data.uploads || []);
    } catch {}
  }, []);

  useEffect(() => { fetchPoints(); }, [fetchPoints]);
  useEffect(() => { fetchUploads(); }, [fetchUploads]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return alert('Select a file first');
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) return alert('File must be .csv, .xlsx, or .xls');

    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('client_id', 'CLIENT_001');
      fd.append('geocode', 'true');

      const res = await fetch(`${API}/csv-upload/discover-points`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        setUploadResult(data.summary);
        fetchPoints();
        fetchUploads();
        fileRef.current.value = '';
      } else {
        setUploadResult({ error: data.error, found_columns: data.found_columns });
      }
    } catch (err) {
      setUploadResult({ error: err.message });
    } finally {
      setUploading(false);
    }
  };

  const handlePromote = async (id, name) => {
    if (!window.confirm(`Promote "${name}" to POI? This will add it to your Points of Interest.`)) return;
    try {
      const res = await fetch(`${API}/discovered-points/${id}/promote-to-poi`, { method: 'POST' });
      const data = await res.json();
      if (data.success) fetchPoints();
      else alert('Error: ' + (data.error || 'Unknown'));
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  const handleEdit = (pt) => {
    setEditingId(pt.id);
    setEditForm({ category: pt.category, city: pt.city || '', pin_code: pt.pin_code || '', latitude: pt.latitude || '', longitude: pt.longitude || '' });
  };

  const handleSaveEdit = async (id) => {
    try {
      const body = { ...editForm };
      if (body.latitude) body.latitude = parseFloat(body.latitude);
      if (body.longitude) body.longitude = parseFloat(body.longitude);
      const res = await fetch(`${API}/discovered-points/${id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) { setEditingId(null); fetchPoints(); }
      else alert('Error: ' + (data.error || 'Unknown'));
    } catch (err) { alert('Failed: ' + err.message); }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch(`${API}/discovered-points/sync-from-pois`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: 'CLIENT_001' }),
      });
      const d = await res.json();
      setSyncMsg(d.message || `${d.synced} POIs synced`);
      fetchPoints();
    } catch (err) {
      setSyncMsg('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Filter out promoted points unless showAll is enabled
  const displayPoints = showAll ? points : points.filter(p => !p.promoted_to_poi);
  
  // Counts
  const counts = {};
  displayPoints.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
  const totalPoints = displayPoints.length;

  const inputStyle = { padding: '5px 8px', fontSize: 12, borderRadius: 5, border: '1px solid #d1d5db', outline: 'none', width: '100%' };

  return (
    <div style={{ padding: '0 8px', maxWidth: 1500, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>📊 Point Discovery</h2>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Upload client trip data (CSV / XLSX / XLS) → auto-extract & classify From/To points</span>
        </div>
      </div>

      {/* Upload Section */}
      <div style={{
        background: '#f0f9ff', borderRadius: 10, padding: 14, marginBottom: 14,
        border: '2px dashed #93c5fd', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ fontSize: 13 }} />
        <button onClick={handleUpload} disabled={uploading} style={{
          padding: '8px 20px', fontSize: 14, fontWeight: 700, borderRadius: 8,
          background: uploading ? '#9ca3af' : '#4338ca', color: '#fff', border: 'none',
          cursor: uploading ? 'not-allowed' : 'pointer', minWidth: 200,
        }}>
          {uploading ? '⏳ Processing... (geocoding takes time)' : '🚀 Upload & Discover Points'}
        </button>
        <span style={{ fontSize: 11, color: '#6b7280' }}>
          CSV needs "from" & "to" columns (or from_location, to_location, origin, destination, loading_point, unloading_point)
        </span>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div style={{
          padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13,
          background: uploadResult.error ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${uploadResult.error ? '#fca5a5' : '#86efac'}`,
        }}>
          {uploadResult.error ? (
            <div>
              <b style={{ color: '#dc2626' }}>Error:</b> {uploadResult.error}
              {uploadResult.found_columns && (
                <div style={{ marginTop: 4, fontSize: 11, color: '#6b7280' }}>
                  Found columns: {uploadResult.found_columns.join(', ')}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <span>✅ <b>{uploadResult.unique_points}</b> points from <b>{uploadResult.total_rows}</b> trips</span>
              <span>🌍 <b>{uploadResult.geocoded}</b> geocoded</span>
              <span>📋 From: <code>{uploadResult.from_col_detected}</code> | To: <code>{uploadResult.to_col_detected}</code></span>
              {uploadResult.categories && Object.entries(uploadResult.categories).map(([cat, cnt]) => (
                <span key={cat} style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                  ...CATEGORY_STYLES[cat] ? { background: CATEGORY_STYLES[cat].bg, color: CATEGORY_STYLES[cat].color, border: `1px solid ${CATEGORY_STYLES[cat].border}` } : {},
                }}>
                  {CATEGORY_STYLES[cat]?.icon} {cat}: {cnt}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Category Summary Cards */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setCategoryFilter('')} style={{
          padding: '6px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
          background: !categoryFilter ? '#4338ca' : '#f1f5f9', color: !categoryFilter ? '#fff' : '#475569',
          border: `1.5px solid ${!categoryFilter ? '#4338ca' : '#cbd5e1'}`, fontWeight: 700, fontSize: 13,
        }}>
          All ({totalPoints})
        </button>
        {Object.entries(CATEGORY_STYLES).map(([cat, s]) => (
          <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)} style={{
            padding: '6px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
            background: categoryFilter === cat ? s.color : s.bg, color: categoryFilter === cat ? '#fff' : s.color,
            border: `1.5px solid ${s.border}`, fontWeight: 700, fontSize: 12,
          }}>
            {s.icon} {s.label} ({counts[cat] || 0})
          </button>
        ))}
      </div>

      {/* Sync Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={handleSync} disabled={syncing} style={{
          padding: '6px 14px', borderRadius: 8, cursor: syncing ? 'not-allowed' : 'pointer',
          background: syncing ? '#9ca3af' : '#d97706', color: '#fff',
          border: '1.5px solid #b45309', fontWeight: 700, fontSize: 12,
        }}>
          {syncing ? '⏳ Syncing...' : '🔄 Sync POIs from Master'}
        </button>
        <button onClick={() => setShowAll(v => !v)} style={{
          padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
          background: showAll ? '#4338ca' : '#f1f5f9', color: showAll ? '#fff' : '#475569',
          border: `1.5px solid ${showAll ? '#4338ca' : '#cbd5e1'}`, fontWeight: 700, fontSize: 12,
        }}>
          {showAll ? '👁 Showing ALL (incl. POIs)' : '👁 Show All POIs'}
        </button>
        {syncMsg && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{syncMsg}</span>}
      </div>

      {/* Upload History Filter */}
      {uploads.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Upload:</span>
          <select value={selectedUpload} onChange={e => setSelectedUpload(e.target.value)} style={{ ...inputStyle, width: 300 }}>
            <option value="">All uploads</option>
            {uploads.map(u => (
              <option key={u.id} value={u.id}>{u.filename} ({u.unique_points} pts, {u.uploaded_at?.split('T')[0] || u.uploaded_at?.split(' ')[0]})</option>
            ))}
          </select>
        </div>
      )}

      {/* Points Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>Loading...</div>
      ) : displayPoints.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', background: '#f9fafb', borderRadius: 8 }}>
          No points discovered yet. Upload a CSV to get started.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                {['Point Name', 'City', 'Pin', 'From#', 'To#', 'Total', 'From%', 'To%', 'Category', 'Geo', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayPoints.map(pt => {
                const cs = CATEGORY_STYLES[pt.category] || CATEGORY_STYLES.OTHER;
                const isEditing = editingId === pt.id;
                return (
                  <React.Fragment key={pt.id}>
                    <tr style={{ borderBottom: '1px solid #f1f5f9', background: pt.promoted_to_poi ? '#f0fdf4' : '#fff' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600, color: '#1e293b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pt.point_name}>
                        {pt.point_name}
                        {pt.promoted_to_poi ? <span style={{ marginLeft: 4, fontSize: 9, color: '#16a34a' }}>✓ POI</span> : null}
                      </td>
                      <td style={{ padding: '6px 8px', color: '#4b5563' }}>{pt.city || '-'}</td>
                      <td style={{ padding: '6px 8px', color: '#4b5563', fontSize: 11 }}>{pt.pin_code || '-'}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#2563eb' }}>{pt.from_count}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#059669' }}>{pt.to_count}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 800 }}>{pt.total_count}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ background: '#dbeafe', borderRadius: 3, overflow: 'hidden', height: 14, width: 50, position: 'relative' }}>
                          <div style={{ background: '#3b82f6', height: '100%', width: `${pt.from_pct}%` }} />
                          <span style={{ position: 'absolute', top: 0, left: 2, fontSize: 9, fontWeight: 700, color: '#1e3a5f' }}>{pt.from_pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ background: '#d1fae5', borderRadius: 3, overflow: 'hidden', height: 14, width: 50, position: 'relative' }}>
                          <div style={{ background: '#10b981', height: '100%', width: `${pt.to_pct}%` }} />
                          <span style={{ position: 'absolute', top: 0, left: 2, fontSize: 9, fontWeight: 700, color: '#064e3b' }}>{pt.to_pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{
                          padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                          background: cs.bg, color: cs.color, border: `1px solid ${cs.border}`,
                        }}>
                          {cs.icon} {pt.category}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                          background: pt.geocoded ? '#d1fae5' : '#fef2f2',
                          color: pt.geocoded ? '#065f46' : '#991b1b',
                        }}>
                          {pt.geocoded ? '✓' : '✗'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 3 }}>
                          <button onClick={() => isEditing ? setEditingId(null) : handleEdit(pt)} style={{
                            padding: '2px 7px', fontSize: 10, borderRadius: 3,
                            background: isEditing ? '#e0e7ff' : '#f3f4f6', color: '#4338ca',
                            border: '1px solid #c7d2fe', cursor: 'pointer', fontWeight: 600,
                          }}>✏️</button>
                          {!pt.promoted_to_poi && pt.geocoded ? (
                            <button onClick={() => handlePromote(pt.id, pt.point_name)} style={{
                              padding: '2px 7px', fontSize: 10, borderRadius: 3,
                              background: '#d1fae5', color: '#065f46',
                              border: '1px solid #6ee7b7', cursor: 'pointer', fontWeight: 600,
                            }}>→ POI</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {/* Inline Edit Row */}
                    {isEditing && (
                      <tr style={{ background: '#eef2ff' }}>
                        <td colSpan={11} style={{ padding: '6px 10px' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                              <span style={{ fontSize: 10, fontWeight: 600 }}>Category:</span>
                              <select value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))} style={{ ...inputStyle, width: 110 }}>
                                {Object.keys(CATEGORY_STYLES).map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <span style={{ fontSize: 10, fontWeight: 600 }}>City:</span>
                              <input value={editForm.city} onChange={e => setEditForm(p => ({ ...p, city: e.target.value }))} style={{ ...inputStyle, width: 120 }} />
                            </div>
                            <div>
                              <span style={{ fontSize: 10, fontWeight: 600 }}>Pin:</span>
                              <input value={editForm.pin_code} onChange={e => setEditForm(p => ({ ...p, pin_code: e.target.value }))} style={{ ...inputStyle, width: 80 }} />
                            </div>
                            <div>
                              <span style={{ fontSize: 10, fontWeight: 600 }}>Lat:</span>
                              <input value={editForm.latitude} onChange={e => setEditForm(p => ({ ...p, latitude: e.target.value }))} style={{ ...inputStyle, width: 100 }} placeholder="28.6139" />
                            </div>
                            <div>
                              <span style={{ fontSize: 10, fontWeight: 600 }}>Lng:</span>
                              <input value={editForm.longitude} onChange={e => setEditForm(p => ({ ...p, longitude: e.target.value }))} style={{ ...inputStyle, width: 100 }} placeholder="77.2090" />
                            </div>
                            <button onClick={() => handleSaveEdit(pt.id)} style={{
                              padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 4,
                              background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer',
                            }}>✓ Save</button>
                            <button onClick={() => setEditingId(null)} style={{
                              padding: '5px 8px', fontSize: 11, borderRadius: 4,
                              background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer',
                            }}>✕</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: 14, padding: 10, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11, color: '#6b7280' }}>
        <b>Classification Logic:</b>{' '}
        🏭 <b>PRIMARY</b> = &gt;90% used as FROM (warehouses/hubs → use for route making) |{' '}
        🔄 <b>SECONDARY</b> = frequent in both FROM & TO (distribution centers) |{' '}
        📦 <b>TERTIARY</b> = &gt;90% used as TO (delivery points) |{' '}
        📍 <b>OTHER</b> = low frequency / mixed
      </div>
    </div>
  );
}
