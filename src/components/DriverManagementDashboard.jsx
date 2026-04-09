import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://kd-logistics-production.up.railway.app';

export default function DriverManagementDashboard() {
  const [drivers, setDrivers] = useState([]);
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
    name: '',
    phone: '',
    license_number: '',
    vehicle_id: '',
    pin: '',
    status: 'active',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch drivers
      const driverRes = await fetch(`${API_BASE}/api/drivers/list`);
      const driverData = await driverRes.json();
      setDrivers(driverData.drivers || generateDummyDrivers());

      // Fetch vehicles
      const vehicleRes = await fetch(`${API_BASE}/api/vehicles/list`);
      const vehicleData = await vehicleRes.json();
      setVehicles(vehicleData.success ? vehicleData.vehicles || [] : generateDummyVehicles());

      // Fetch clients
      const clientRes = await fetch(`${API_BASE}/api/clients`);
      const clientData = await clientRes.json();
      setClients(clientData.clients || []);

      setError(null);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setDrivers(generateDummyDrivers());
    } finally {
      setLoading(false);
    }
  };

  const generateDummyDrivers = () => {
    return [
      { id: 1, client_id: 2, name: 'Hoshiyar Singh', phone: '9876543210', license_number: 'DL123456', vehicle_id: 1, status: 'active', pin: '1234' },
      { id: 2, client_id: 2, name: 'Pradeep Kumar', phone: '9876543211', license_number: 'DL123457', vehicle_id: 2, status: 'active', pin: '5678' },
      { id: 3, client_id: 3, name: 'Rajesh Verma', phone: '9876543212', license_number: 'DL123458', vehicle_id: 3, status: 'inactive', pin: '9012' },
      { id: 4, client_id: 4, name: 'Amit Patel', phone: '9876543213', license_number: 'DL123459', vehicle_id: 4, status: 'active', pin: '3456' },
      { id: 5, client_id: 2, name: 'Suresh Yadav', phone: '9876543214', license_number: 'DL123460', vehicle_id: 5, status: 'active', pin: '7890' },
      { id: 6, client_id: 3, name: 'Mohan Singh', phone: '9876543215', license_number: 'DL123461', vehicle_id: 6, status: 'active', pin: '2345' },
    ];
  };

  const generateDummyVehicles = () => {
    return [
      { id: 1, vehicle_number: 'MH01AB1234', model: 'Tata 1109' },
      { id: 2, vehicle_number: 'MH02XY5678', model: 'Ashok Leyland' },
      { id: 3, vehicle_number: 'MH03CD9999', model: 'Mahindra Truck' },
      { id: 4, vehicle_number: 'MH04EF2345', model: 'Tata Ace' },
      { id: 5, vehicle_number: 'MH05GH6789', model: 'Isuzu' },
      { id: 6, vehicle_number: 'MH06IJ0123', model: 'Canter' },
    ];
  };

  const handleAddDriver = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/drivers/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.success) {
        setDrivers([...drivers, data.driver]);
        setFormData({
          client_id: '',
          name: '',
          phone: '',
          license_number: '',
          vehicle_id: '',
          pin: '',
          status: 'active',
        });
        setShowAddForm(false);
      } else {
        setError(data.message || 'Failed to add driver');
      }
    } catch (err) {
      setError('Error adding driver: ' + err.message);
    }
  };

  const handleAssignVehicle = async (driverId, vehicleId) => {
    try {
      const res = await fetch(`${API_BASE}/api/drivers/${driverId}/assign-vehicle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_id: vehicleId }),
      });
      const data = await res.json();

      if (data.success) {
        setDrivers(drivers.map(d => d.id === driverId ? { ...d, vehicle_id: vehicleId } : d));
      }
    } catch (err) {
      setError('Failed to assign vehicle');
    }
  };

  const handleUpdateStatus = async (driverId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/api/drivers/${driverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();

      if (data.success) {
        setDrivers(drivers.map(d => d.id === driverId ? { ...d, status: newStatus } : d));
      }
    } catch (err) {
      setError('Failed to update driver status');
    }
  };

  // Filter drivers
  const filteredDrivers = drivers.filter(d => {
    const matchesClient = selectedClient === 'all' || d.client_id === parseInt(selectedClient);
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         d.phone.includes(searchTerm) ||
                         (d.license_number && d.license_number.includes(searchTerm));
    const matchesStatus = filterStatus === 'all' || d.status === filterStatus;
    return matchesClient && matchesSearch && matchesStatus;
  });

  const stats = {
    total: drivers.length,
    active: drivers.filter(d => d.status === 'active').length,
    inactive: drivers.filter(d => d.status === 'inactive').length,
    assigned: drivers.filter(d => d.vehicle_id).length,
    unassigned: drivers.filter(d => !d.vehicle_id).length,
  };

  const getVehicleInfo = (vehicleId) => {
    return vehicles.find(v => v.id === vehicleId);
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
            👥 Driver Management
          </h2>
          <p style={{
            fontSize: 12,
            color: '#64748b',
            margin: 0,
          }}>
            Manage drivers and vehicle assignments
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
          ➕ Add Driver
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

      {/* Add Driver Form */}
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
            ➕ Add New Driver
          </h3>
          <form onSubmit={handleAddDriver} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
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
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                Driver Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter driver name"
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
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="10-digit number"
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
                License Number
              </label>
              <input
                type="text"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                placeholder="e.g., DL123456"
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
                PIN
              </label>
              <input
                type="password"
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                placeholder="4-6 digits"
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
          <div style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }}>{stats.total}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Total Drivers</div>
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
          <div style={{ fontSize: 20, fontWeight: 700, color: '#06b6d4' }}>{stats.assigned}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Assigned</div>
        </div>
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 12,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{stats.unassigned}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Unassigned</div>
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
            placeholder="🔍 Search by name, phone, or license..."
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
          <option value="inactive">🔴 Inactive</option>
        </select>
      </div>

      {/* Drivers Table */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            Loading drivers...
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            No drivers found matching your filters
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
                  }}>Driver Name</th>
                  <th style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: '#64748b',
                    borderRight: '1px solid #e2e8f0',
                  }}>Contact</th>
                  <th style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontWeight: 600,
                    color: '#64748b',
                    borderRight: '1px solid #e2e8f0',
                  }}>License</th>
                  <th style={{
                    padding: '10px 14px',
                    textAlign: 'center',
                    fontWeight: 600,
                    color: '#64748b',
                    borderRight: '1px solid #e2e8f0',
                  }}>Assigned Vehicle</th>
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
                  }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((driver, idx) => {
                  const vehicle = getVehicleInfo(driver.vehicle_id);
                  const client = clients.find(c => c.id === driver.client_id);
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
                        {driver.name}
                      </td>
                      <td style={{
                        padding: '10px 14px',
                        color: '#475569',
                        borderRight: '1px solid #e2e8f0',
                      }}>
                        {driver.phone}
                      </td>
                      <td style={{
                        padding: '10px 14px',
                        color: '#475569',
                        borderRight: '1px solid #e2e8f0',
                        fontSize: 11,
                      }}>
                        {driver.license_number}
                      </td>
                      <td style={{
                        padding: '10px 14px',
                        textAlign: 'center',
                        borderRight: '1px solid #e2e8f0',
                      }}>
                        {vehicle ? (
                          <div style={{ fontSize: 11 }}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>
                              {vehicle.vehicle_number}
                            </div>
                            <div style={{ color: '#64748b' }}>{vehicle.model}</div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 11 }}>❌ Unassigned</span>
                        )}
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
                          background: driver.status === 'active' ? '#d1fae5' : '#fee2e2',
                          color: driver.status === 'active' ? '#065f46' : '#991b1b',
                        }}>
                          {driver.status === 'active' ? '🟢' : '🔴'} {driver.status}
                        </span>
                      </td>
                      <td style={{
                        padding: '10px 14px',
                        textAlign: 'center',
                      }}>
                        <select
                          value={driver.status}
                          onChange={(e) => handleUpdateStatus(driver.id, e.target.value)}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #e2e8f0',
                            borderRadius: 4,
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
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
