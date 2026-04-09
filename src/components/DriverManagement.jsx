import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Phone, FileText } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://kd-logistics-production.up.railway.app';

export default function DriverManagement() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    license: '',
    notes: ''
  });

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/drivers?limit=100`);
      if (!res.ok) throw new Error('Failed to fetch drivers');
      const data = await res.json();
      setDrivers(data.drivers || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/drivers/${editingId}` : '/api/drivers';
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: 'CLIENT_001',
          ...formData
        })
      });

      if (!res.ok) throw new Error('Failed to save driver');
      
      setFormData({ name: '', phone: '', license: '', notes: '' });
      setEditingId(null);
      setShowForm(false);
      await fetchDrivers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this driver?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/drivers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete driver');
      await fetchDrivers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>👨‍🚗 Driver Management</h1>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ name: '', phone: '', license: '', notes: '' }); }}
          style={{
            background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px',
            borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <Plus size={18} /> Add Driver
        </button>
      </div>

      {error && (
        <div style={{
          background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '6px', marginBottom: '16px'
        }}>
          ❌ {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={{
          background: '#f3f4f6', padding: '16px', borderRadius: '8px', marginBottom: '20px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <input
              type="text" placeholder="Driver Name *" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
            <input
              type="tel" placeholder="Phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
            <input
              type="text" placeholder="License #" value={formData.license} onChange={(e) => setFormData({ ...formData, license: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
            <input
              type="text" placeholder="Notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" style={{
              background: '#10b981', color: '#fff', border: 'none', padding: '8px 16px',
              borderRadius: '4px', cursor: 'pointer', fontWeight: 600
            }}>
              {editingId ? 'Update' : 'Create'} Driver
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} style={{
              background: '#6b7280', color: '#fff', border: 'none', padding: '8px 16px',
              borderRadius: '4px', cursor: 'pointer'
            }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>Loading drivers...</div>
      ) : drivers.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No drivers found</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>ID</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Phone</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>License</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Notes</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px' }}>{driver.id}</td>
                  <td style={{ padding: '12px', fontWeight: 500 }}>{driver.name}</td>
                  <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {driver.phone && <Phone size={14} color="#6b7280" />}
                    {driver.phone}
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px', color: '#6b7280' }}>
                    {driver.license && <FileText size={14} style={{ display: 'inline', marginRight: '4px' }} />}
                    {driver.license}
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px', color: '#6b7280' }}>{driver.notes}</td>
                  <td style={{ padding: '12px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <button
                      onClick={() => { setEditingId(driver.id); setFormData(driver); setShowForm(true); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7, fontSize: '14px' }}
                    >
                      <Edit2 size={16} color="#3b82f6" />
                    </button>
                    <button
                      onClick={() => handleDelete(driver.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7, fontSize: '14px' }}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
