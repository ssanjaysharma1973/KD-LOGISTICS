import React, { useState, useEffect, useCallback } from 'react';

const API = '/api';

export default function EwayBillManagement() {
  const [ewaybills, setEwaybills] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedEwb, setExpandedEwb] = useState(null);
  const [vehicleHistory, setVehicleHistory] = useState([]);
  const [showVehicleChange, setShowVehicleChange] = useState(null);
  const [vehicleChangeForm, setVehicleChangeForm] = useState({ new_vehicle_number: '', change_reason: '' });

  const defaultForm = {
    client_id: 'CLIENT_001',
    vehicle_number: '',
    ewb_number: '',
    consignment_value: '',
    from_location: '',
    to_location: '',
    issue_date: new Date().toISOString().split('T')[0],
    validity_days: 1,
    job_card_id: '',
    notes: '',
    transporter_id: '',
    transport_mode: 'Road',
    distance_km: '',
    vehicle_type: 'Regular',
    generated_by: 'customer',
  };
  const [form, setForm] = useState(defaultForm);

  const fetchEwaybills = useCallback(async () => {
    try {
      const url = statusFilter ? `${API}/ewaybills?status=${statusFilter}` : `${API}/ewaybills`;
      const res = await fetch(url);
      const data = await res.json();
      setEwaybills(data.ewaybills || []);
    } catch (err) {
      console.error('Failed to fetch e-way bills:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchEwaybills(); }, [fetchEwaybills]);

  useEffect(() => {
    fetch(`${API}/vehicles-master/dropdown?client_id=CLIENT_001`).then(r => r.json())
      .then(vData => { setVehicles(vData.vehicles || []); })
      .catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/ewaybills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        setForm(defaultForm);
        fetchEwaybills();
      } else {
        alert('Error: ' + (data.error || 'Unknown'));
      }
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  const handleExtend = async (ewbId) => {
    if (!window.confirm('Extend this e-way bill by 1 day?')) return;
    try {
      const res = await fetch(`${API}/ewaybills/${ewbId}/extend`, { method: 'PUT' });
      const data = await res.json();
      if (data.success) fetchEwaybills();
      else alert('Error: ' + (data.error || 'Unknown'));
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  const handleVehicleChange = async (ewbId) => {
    if (!vehicleChangeForm.new_vehicle_number) return alert('Select a new vehicle');
    try {
      const res = await fetch(`${API}/ewaybills/${ewbId}/update-part-b`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_number: vehicleChangeForm.new_vehicle_number,
          change_reason: vehicleChangeForm.change_reason || 'Vehicle changed',
          changed_by: 'admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowVehicleChange(null);
        setVehicleChangeForm({ new_vehicle_number: '', change_reason: '' });
        fetchEwaybills();
      } else alert('Error: ' + (data.error || 'Unknown'));
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  const loadVehicleHistory = async (ewbId) => {
    if (expandedEwb === ewbId) { setExpandedEwb(null); return; }
    try {
      const res = await fetch(`${API}/ewaybills/${ewbId}/vehicle-history`);
      const data = await res.json();
      setVehicleHistory(data.changes || []);
      setExpandedEwb(ewbId);
    } catch { setVehicleHistory([]); }
  };

  const statusColors = {
    issued: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
    extended: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
    finalized: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
    expired: { bg: '#fecaca', color: '#991b1b', border: '#fca5a5' },
  };
  const getStatusStyle = (s) => statusColors[s] || statusColors.issued;

  const isExpired = (d, status) => {
    if (!d || status === 'finalized') return false;
    return new Date(d) < new Date();
  };
  const isExpiringSoon = (d, status) => {
    if (!d || status === 'finalized') return false;
    const diff = (new Date(d) - new Date()) / (1000 * 3600 * 24);
    return diff <= 1 && diff >= 0;
  };

  const inputStyle = { width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db', outline: 'none', background: '#fff' };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 3, display: 'block' };
  const sectionLabel = (text, icon) => (
    <div style={{ gridColumn: '1 / -1', fontSize: 13, fontWeight: 700, color: '#4338ca', borderBottom: '2px solid #e0e7ff', paddingBottom: 4, marginTop: 4 }}>
      {icon} {text}
    </div>
  );

  // Counts
  const counts = { all: ewaybills.length };
  ewaybills.forEach(e => { counts[e.status] = (counts[e.status] || 0) + 1; });
  const partBPending = ewaybills.filter(e => !e.part_b_updated && e.status !== 'finalized').length;

  return (
    <div style={{ padding: '0 8px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>📄 E-Way Bill Management</h2>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Customer issues Part A → You manage Part B (vehicle, distance, transport)</span>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '7px 14px', fontSize: 13, fontWeight: 600, borderRadius: 6,
          background: showForm ? '#6b7280' : '#4338ca', color: '#fff', border: 'none', cursor: 'pointer',
        }}>
          {showForm ? '✕ Cancel' : '+ New EWB (Part A received)'}
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: counts.all || 0, bg: '#f1f5f9', border: '#cbd5e1' },
          { label: 'Issued', value: counts.issued || 0, bg: '#dbeafe', border: '#93c5fd' },
          { label: 'Extended', value: counts.extended || 0, bg: '#fef3c7', border: '#fcd34d' },
          { label: 'Finalized', value: counts.finalized || 0, bg: '#d1fae5', border: '#6ee7b7' },
          { label: '⚠️ Part B Pending', value: partBPending, bg: '#fef2f2', border: '#fca5a5' },
        ].map(c => (
          <div key={c.label} style={{
            padding: '8px 14px', borderRadius: 8, background: c.bg,
            border: `1.5px solid ${c.border}`, minWidth: 90, textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{c.value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Create Form — Part A (customer data) + Part B (your data) */}
      {showForm && (
        <form onSubmit={handleCreate} style={{
          background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 14,
          border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10,
        }}>
          {sectionLabel('Part A — Customer provides', '📋')}
          <div>
            <label style={labelStyle}>EWB Number *</label>
            <input required value={form.ewb_number} onChange={e => setForm({ ...form, ewb_number: e.target.value })} style={inputStyle} placeholder="EWB-123456789" />
          </div>
          <div>
            <label style={labelStyle}>Consignment Value (₹)</label>
            <input type="number" value={form.consignment_value} onChange={e => setForm({ ...form, consignment_value: e.target.value })} style={inputStyle} placeholder="50000" />
          </div>
          <div>
            <label style={labelStyle}>From Location</label>
            <input value={form.from_location} onChange={e => setForm({ ...form, from_location: e.target.value })} style={inputStyle} placeholder="Delhi" />
          </div>
          <div>
            <label style={labelStyle}>To Location</label>
            <input value={form.to_location} onChange={e => setForm({ ...form, to_location: e.target.value })} style={inputStyle} placeholder="Bangalore" />
          </div>
          <div>
            <label style={labelStyle}>Issue Date</label>
            <input type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Validity (days)</label>
            <input type="number" min="1" value={form.validity_days} onChange={e => setForm({ ...form, validity_days: e.target.value })} style={inputStyle} />
          </div>

          {sectionLabel('Part B — You fill (transport details)', '🚛')}
          <div>
            <label style={labelStyle}>Vehicle *</label>
            <select required value={form.vehicle_number} onChange={e => setForm({ ...form, vehicle_number: e.target.value })} style={inputStyle}>
              <option value="">Select Vehicle</option>
              {vehicles.map(v => <option key={v.vehicle_no} value={v.vehicle_no}>{v.vehicle_no}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Distance (km)</label>
            <input type="number" value={form.distance_km} onChange={e => setForm({ ...form, distance_km: e.target.value })} style={{ ...inputStyle, background: form.distance_km ? '#f0fdf4' : '#fff' }} placeholder="Enter distance" />
          </div>
          <div>
            <label style={labelStyle}>Transport Mode</label>
            <select value={form.transport_mode} onChange={e => setForm({ ...form, transport_mode: e.target.value })} style={inputStyle}>
              {['Road', 'Rail', 'Air', 'Ship'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Vehicle Type</label>
            <select value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value })} style={inputStyle}>
              {['Regular', 'Over Dimensional Cargo (ODC)'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Transporter GSTIN</label>
            <input value={form.transporter_id} onChange={e => setForm({ ...form, transporter_id: e.target.value })} style={inputStyle} placeholder="22AAAAA0000A1Z5" />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="submit" style={{
              padding: '8px 22px', fontSize: 13, fontWeight: 700, borderRadius: 6,
              background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer',
            }}>
              ✓ Create E-Way Bill
            </button>
          </div>
        </form>
      )}

      {/* Status Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {['', 'issued', 'extended', 'finalized'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
            background: statusFilter === s ? '#4338ca' : '#f3f4f6',
            color: statusFilter === s ? '#fff' : '#4b5563',
            border: `1px solid ${statusFilter === s ? '#4338ca' : '#d1d5db'}`,
          }}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>Loading...</div>
      ) : ewaybills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#6b7280', background: '#f9fafb', borderRadius: 8 }}>
          No e-way bills found. Click "+ New EWB" to create one.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                {['EWB Number', 'Vehicle', 'From → To', 'Dist', 'Value', 'Validity', 'Ext', 'Part B', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ewaybills.map(ewb => {
                const ss = getStatusStyle(ewb.status);
                const expired = isExpired(ewb.current_validity_date, ewb.status);
                const expiring = isExpiringSoon(ewb.current_validity_date, ewb.status);
                const partBDone = ewb.part_b_updated;
                return (
                  <React.Fragment key={ewb.id}>
                    <tr style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: expired ? '#fef2f2' : expiring ? '#fffbeb' : '#fff',
                    }}>
                      <td style={{ padding: '7px 8px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>{ewb.ewb_number}</td>
                      <td style={{ padding: '7px 8px', fontWeight: 600 }}>{ewb.vehicle_number}</td>
                      <td style={{ padding: '7px 8px', color: '#4b5563', fontSize: 12 }}>
                        {ewb.from_location || '?'} → {ewb.to_location || '?'}
                      </td>
                      <td style={{ padding: '7px 8px', fontSize: 12 }}>
                        {ewb.distance_km ? `${ewb.distance_km} km` : '-'}
                      </td>
                      <td style={{ padding: '7px 8px', fontWeight: 600 }}>
                        {ewb.consignment_value ? `₹${Number(ewb.consignment_value).toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td style={{ padding: '7px 8px', fontWeight: 600, color: expired ? '#dc2626' : expiring ? '#d97706' : '#111', whiteSpace: 'nowrap' }}>
                        {ewb.current_validity_date || '-'}
                        {expired && <span style={{ marginLeft: 3, fontSize: 9, color: '#dc2626', fontWeight: 800 }}>EXPIRED</span>}
                        {expiring && <span style={{ marginLeft: 3, fontSize: 10 }}>⚠️</span>}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 700 }}>{ewb.extended_count || 0}</td>
                      <td style={{ padding: '7px 8px' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                          background: partBDone ? '#d1fae5' : '#fef2f2',
                          color: partBDone ? '#065f46' : '#991b1b',
                          border: `1px solid ${partBDone ? '#6ee7b7' : '#fca5a5'}`,
                        }}>
                          {partBDone ? '✓ Done' : '⏳ Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '7px 8px' }}>
                        <span style={{
                          padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                          background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`,
                          textTransform: 'uppercase',
                        }}>{ewb.status}</span>
                      </td>
                      <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(ewb.status === 'issued' || ewb.status === 'extended') && (
                            <>
                              <button onClick={() => handleExtend(ewb.id)} title="Extend +1 day" style={{
                                padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4,
                                background: '#f59e0b', color: '#fff', border: 'none', cursor: 'pointer',
                              }}>+1d</button>
                              <button onClick={() => { setShowVehicleChange(showVehicleChange === ewb.id ? null : ewb.id); setVehicleChangeForm({ new_vehicle_number: '', change_reason: '' }); }} title="Change vehicle" style={{
                                padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 4,
                                background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer',
                              }}>🚛 Change</button>
                            </>
                          )}
                          <button onClick={() => loadVehicleHistory(ewb.id)} title="Vehicle change history" style={{
                            padding: '3px 8px', fontSize: 10, fontWeight: 600, borderRadius: 4,
                            background: expandedEwb === ewb.id ? '#e0e7ff' : '#f3f4f6', color: '#4338ca',
                            border: '1px solid #c7d2fe', cursor: 'pointer',
                          }}>📋</button>
                        </div>
                      </td>
                    </tr>

                    {/* Vehicle Change Inline Form */}
                    {showVehicleChange === ewb.id && (
                      <tr style={{ background: '#eef2ff' }}>
                        <td colSpan={10} style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#4338ca' }}>🔄 Change Vehicle:</span>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>Current: <b>{ewb.vehicle_number}</b> →</span>
                            <select value={vehicleChangeForm.new_vehicle_number} onChange={e => setVehicleChangeForm(p => ({ ...p, new_vehicle_number: e.target.value }))} style={{ ...inputStyle, width: 140 }}>
                              <option value="">New Vehicle</option>
                              {vehicles.filter(v => v.vehicle_no !== ewb.vehicle_number).map(v => (
                                <option key={v.vehicle_no} value={v.vehicle_no}>{v.vehicle_no}</option>
                              ))}
                            </select>
                            <select value={vehicleChangeForm.change_reason} onChange={e => setVehicleChangeForm(p => ({ ...p, change_reason: e.target.value }))} style={{ ...inputStyle, width: 160 }}>
                              <option value="">Reason</option>
                              <option value="Breakdown">Breakdown</option>
                              <option value="Transshipment">Transshipment</option>
                              <option value="Maintenance">Maintenance</option>
                              <option value="Re-assignment">Re-assignment</option>
                              <option value="Other">Other</option>
                            </select>
                            <button onClick={() => handleVehicleChange(ewb.id)} style={{
                              padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 5,
                              background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer',
                            }}>✓ Update Part B</button>
                            <button onClick={() => setShowVehicleChange(null)} style={{
                              padding: '6px 10px', fontSize: 12, borderRadius: 5,
                              background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer',
                            }}>✕</button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Vehicle History Expansion */}
                    {expandedEwb === ewb.id && (
                      <tr style={{ background: '#f8fafc' }}>
                        <td colSpan={10} style={{ padding: '6px 12px' }}>
                          {vehicleHistory.length === 0 ? (
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>No vehicle changes recorded</span>
                          ) : (
                            <div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Vehicle Change History:</span>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                                {vehicleHistory.map(h => (
                                  <div key={h.id} style={{
                                    padding: '4px 10px', borderRadius: 6, fontSize: 11,
                                    background: '#fff', border: '1px solid #e2e8f0',
                                  }}>
                                    <b>{h.old_vehicle_number}</b> → <b style={{ color: '#16a34a' }}>{h.new_vehicle_number}</b>
                                    <span style={{ color: '#9ca3af', marginLeft: 6 }}>{h.change_reason}</span>
                                    <span style={{ color: '#9ca3af', marginLeft: 6 }}>{h.changed_at?.split('T')[0]}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
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
    </div>
  );
}
