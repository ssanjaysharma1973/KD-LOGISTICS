import React, { useState, useEffect } from 'react';

export default function VehicleManagementDashboard() {
  const [vehicles, setVehicles] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    client_id: '',
    vehicle_number: '',
    model: '',
    status: 'active',
  });

  useEffect(() => {
    fetchVehicles();
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      if (data.success) {
        setClients(data.clients || []);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  };

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/vehicles/list');
      const data = await res.json();
      
      if (data.success && data.vehicles) {
        setVehicles(data.vehicles);
      } else {
        // Use dummy data if API fails
        setVehicles(generateDummyVehicles());
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
      setVehicles(generateDummyVehicles());
    } finally {
      setLoading(false);
    }
  };

  const generateDummyVehicles = () => {
    return [
      { id: 1, client_id: 2, vehicle_number: 'MH01AB1234', model: 'Tata 1109', status: 'active', created_at: '2024-01-15' },
      { id: 2, client_id: 2, vehicle_number: 'MH02XY5678', model: 'Ashok Leyland', status: 'active', created_at: '2024-01-16' },
      { id: 3, client_id: 3, vehicle_number: 'MH03CD9999', model: 'Mahindra Truck', status: 'inactive', created_at: '2024-02-10' },
      { id: 4, client_id: 4, vehicle_number: 'MH04EF2345', model: 'Tata Ace', status: 'active', created_at: '2024-02-20' },
      { id: 5, client_id: 2, vehicle_number: 'MH05GH6789', model: 'Isuzu', status: 'active', created_at: '2024-03-01' },
      { id: 6, client_id: 3, vehicle_number: 'MH06IJ0123', model: 'Canter', status: 'active', created_at: '2024-03-05' },
      { id: 7, client_id: 2, vehicle_number: 'MH07KL4567', model: 'Tata Ace Plus', status: 'maintenance', created_at: '2024-03-10' },
      { id: 8, client_id: 4, vehicle_number: 'MH08MN8901', model: 'Force Truck', status: 'active', created_at: '2024-03-15' },
    ];
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/vehicles/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.success) {
        setVehicles([...vehicles, data.vehicle]);
        setFormData({ client_id: '', vehicle_number: '', model: '', status: 'active' });
        setShowAddForm(false);
      } else {
        setError(data.message || 'Failed to add vehicle');
      }
    } catch (err) {
      setError('Error adding vehicle: ' + err.message);
    }
  };

  const handleUpdateStatus = async (vehicleId, newStatus) => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();

      if (data.success) {
        setVehicles(vehicles.map(v => v.id === vehicleId ? { ...v, status: newStatus } : v));
      }
    } catch (err) {
      setError('Failed to update vehicle status');
    }
  };

  // Filter vehicles
  const filteredVehicles = vehicles.filter(v => {
    const matchesClient = selectedClient === 'all' || v.client_id === parseInt(selectedClient);
    const matchesSearch = v.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (v.model && v.model.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;
    return matchesClient && matchesSearch && matchesStatus;
  });

  const stats = {
    total: vehicles.length,
    active: vehicles.filter(v => v.status === 'active').length,
    inactive: vehicles.filter(v => v.status === 'inactive').length,
    maintenance: vehicles.filter(v => v.status === 'maintenance').length,
  };

  return (
    <div style={{
      padding: '20px',
      background: '#f8fafc',
      minHeight: '100vh',
    }}>
      {/* Header */}
      <div style={{
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h2 style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#1e293b',
            margin: '0 0 4px 0',
          }}>
            🚗 Vehicle Management
          </h2>
          <p style={{
            fontSize: 12,
            color: '#64748b',
            margin: 0,
          }}>
            Manage and track all vehicles in the fleet
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            border: 'none',
            background: '#10b981',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => e.target.style.background = '#059669'}
          onMouseOut={(e) => e.target.style.background = '#10b981'}
        >
          ➕ Add Vehicle
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '12px',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: 6,
          color: '#991b1b',
          marginBottom: 16,
          fontSize: 12,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Add Vehicle Form */}
      {showAddForm && (
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <h3 style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#1e293b',
            margin: '0 0 12px 0',
          }}>
            ➕ Add New Vehicle
          </h3>
          <form onSubmit={handleAddVehicle} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                Client
              </label>
              <select
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              >
                <option value="">Select a client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.client_code})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                Vehicle Number
              </label>
              <input
                type="text"
                value={formData.vehicle_number}
                onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value.toUpperCase() })}
                placeholder="e.g., MH01AB1234"
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                Model
              </label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="e.g., Tata 1109"
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button type="submit" style={{
                flex: 1,
                padding: '8px 14px',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}>
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                style={{
                  flex: 1,
                  padding: '8px 14px',
                  background: '#e2e8f0',
                  color: '#475569',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}>
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 12,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{stats.total}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Total Vehicles</div>
        </div>
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 12,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{stats.active}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Active</div>
        </div>
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 12,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{stats.maintenance}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Maintenance</div>
        </div>
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 12,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{stats.inactive}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Inactive</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Search vehicle number or model..."
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: 12,
              boxSizing: 'border-box',
            }}
          />
        </div>
        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          style={{
            padding: '8px 10px',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            fontSize: 12,
            minWidth: 150,
          }}
        >
          <option value="all">All Clients</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: '8px 10px',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            fontSize: 12,
            minWidth: 130,
          }}
        >
          <option value="all">All Status</option>
          <option value="active">🟢 Active</option>
          <option value="maintenance">🟡 Maintenance</option>
          <option value="inactive">🔴 Inactive</option>
        </select>
      </div>

      {/* Vehicles Table */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            Loading vehicles...
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            No vehicles found matching your filters
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12,
            }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: '#64748b',
                    borderRight: '1px solid #e2e8f0',
                  }}>Vehicle #</th>
                  <th style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: '#64748b',
                    borderRight: '1px solid #e2e8f0',
                  }}>Model</th>
                  <th style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: '#64748b',
                    borderRight: '1px solid #e2e8f0',
                  }}>Client</th>
                  <th style={{
                    padding: '10px 14px',
                    textAlign: 'center',
                    fontWeight: 600,
                    color: '#64748b',
                    borderRight: '1px solid #e2e8f0',
                  }}>Status</th>
                  <th style={{
                    padding: '10px 14px',
                    textAlign: 'center',
                    fontWeight: 600,
                    color: '#64748b',
                  }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((vehicle, idx) => {
                  const client = clients.find(c => c.id === vehicle.client_id);
                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: idx % 2 === 0 ? '#fff' : '#f8fafc',
                      }}
                    >
                      <td style={{
                        padding: '10px 14px',
                        fontWeight: 600,
                        color: '#1e293b',
                        borderRight: '1px solid #e2e8f0',
                      }}>
                        {vehicle.vehicle_number}
                      </td>
                      <td style={{
                        padding: '10px 14px',
                        color: '#475569',
                        borderRight: '1px solid #e2e8f0',
                      }}>
                        {vehicle.model || 'N/A'}
                      </td>
                      <td style={{
                        padding: '10px 14px',
                        color: '#475569',
                        borderRight: '1px solid #e2e8f0',
                      }}>
                        {client?.name || 'N/A'}
                      </td>
                      <td style={{
                        padding: '10px 14px',
                        textAlign: 'center',
                        borderRight: '1px solid #e2e8f0',
                      }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          background:
                            vehicle.status === 'active'
                              ? '#d1fae5'
                              : vehicle.status === 'maintenance'
                              ? '#fef3c7'
                              : '#fee2e2',
                          color:
                            vehicle.status === 'active'
                              ? '#065f46'
                              : vehicle.status === 'maintenance'
                              ? '#92400e'
                              : '#991b1b',
                        }}>
                          {vehicle.status === 'active'
                            ? '🟢'
                            : vehicle.status === 'maintenance'
                            ? '🟡'
                            : '🔴'}{' '}
                          {vehicle.status}
                        </span>
                      </td>
                      <td style={{
                        padding: '10px 14px',
                        textAlign: 'center',
                      }}>
                        <select
                          value={vehicle.status}
                          onChange={(e) => handleUpdateStatus(vehicle.id, e.target.value)}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #e2e8f0',
                            borderRadius: 4,
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="active">Set Active</option>
                          <option value="maintenance">Set Maintenance</option>
                          <option value="inactive">Set Inactive</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
