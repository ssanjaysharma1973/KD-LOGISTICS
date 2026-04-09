import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://kd-logistics-production.up.railway.app';

export default function CentralControlCenter() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const res = await fetch(`${API_BASE}/api/clients`);
      const data = await res.json();
      // Filter out CLIENT_000 (DevAdmin) - show only regular clients
      const regularClients = (data.clients || []).filter(c => c.client_code !== 'CLIENT_000');
      setClients(regularClients);
    } catch (e) {
      console.error('Error loading clients:', e);
    } finally {
      setLoading(false);
    }
  }

  async function updateClient(id, field, value) {
    try {
      // Update via direct API or database
      const updateData = {};
      updateData[field] = value;
      
      const res = await fetch(`${API_BASE}/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (res.ok) {
        loadClients(); // Reload
        setEditingId(null);
      }
    } catch (e) {
      console.error('Error updating client:', e);
    }
  }

  async function toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await updateClient(id, 'status', newStatus);
  }

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{
      padding: '20px',
      background: '#0f172a',
      color: '#f1f5f9',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
          🎛️ CENTRAL CONTROL CENTER
        </h1>
        <p style={{ color: '#94a3b8', margin: '0' }}>Manage all 5-10 clients from one dashboard</p>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '30px'
      }}>
        <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#60a5fa' }}>{clients.length}</div>
          <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Total Clients</div>
        </div>
        <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#34d399' }}>
            {clients.filter(c => c.status === 'active').length}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Active</div>
        </div>
        <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f87171' }}>
            {clients.filter(c => c.status === 'inactive').length}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>Inactive</div>
        </div>
      </div>

      {/* Clients Table */}
      <div style={{
        background: '#1e293b',
        borderRadius: '12px',
        border: '1px solid #334155',
        overflow: 'hidden'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse'
        }}>
          <thead>
            <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>ID</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Code</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>PIN</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Company Name</th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client, idx) => (
              <tr key={client.id} style={{
                borderBottom: '1px solid #334155',
                background: idx % 2 === 0 ? 'transparent' : 'rgba(15, 23, 42, 0.5)'
              }}>
                <td style={{ padding: '12px', fontSize: '13px' }}>
                  <span style={{ background: '#334155', padding: '4px 8px', borderRadius: '4px' }}>
                    {client.id}
                  </span>
                </td>
                <td style={{ padding: '12px', fontSize: '13px', fontWeight: '600', color: '#60a5fa' }}>
                  {client.client_code}
                </td>
                <td style={{ padding: '12px', fontSize: '13px' }}>
                  <code style={{ background: '#0f172a', padding: '4px 8px', borderRadius: '4px' }}>
                    {client.pin}
                  </code>
                </td>
                <td style={{ padding: '12px', fontSize: '13px' }}>
                  {editingId === client.id ? (
                    <input
                      type="text"
                      defaultValue={client.name}
                      onChange={(e) => setEditData({ name: e.target.value })}
                      onBlur={() => updateClient(client.id, 'name', editData.name)}
                      autoFocus
                      style={{
                        background: '#0f172a',
                        border: '1px solid #60a5fa',
                        color: '#f1f5f9',
                        padding: '6px',
                        borderRadius: '4px',
                        width: '100%'
                      }}
                    />
                  ) : (
                    client.name
                  )}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button
                    onClick={() => toggleStatus(client.id, client.status)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: client.status === 'active' ? '#10b981' : '#ef4444',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {client.status === 'active' ? '✅ Active' : '❌ Inactive'}
                  </button>
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button
                    onClick={() => setEditingId(editingId === client.id ? null : client.id)}
                    style={{
                      padding: '6px 12px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    {editingId === client.id ? 'Save' : 'Edit'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div style={{
        marginTop: '20px',
        background: '#1e3a8a',
        border: '1px solid #3b82f6',
        borderRadius: '8px',
        padding: '16px'
      }}>
        <div style={{ fontSize: '12px', color: '#dbeafe', lineHeight: '1.6' }}>
          <strong>💡 SYSTEM STRUCTURE:</strong><br/>
          🔐 CLIENT_000 = DevAdmin Master (System Admin) - INDEPENDENT<br/>
          📊 Below Table = Regular Clients Only (CLIENT_001, 004-010)<br/>
          • Click Status button to toggle Active/Inactive<br/>
          • Click Edit to modify company name<br/>
          • Each client has their own PIN for login
        </div>
      </div>
    </div>
  );
}
