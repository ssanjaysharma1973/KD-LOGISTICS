import React, { useState, useEffect } from 'react';

export default function TripManagementDashboard() {
  const [trips, setTrips] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    vehicle_id: '',
    driver_id: '',
    origin: '',
    destination: '',
    load_type: '',
    weight: '',
    status: 'pending',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch trips
      const tripRes = await fetch('/api/trips/list');
      const tripData = await tripRes.json();
      setTrips(tripData.trips || generateDummyTrips());

      // Fetch drivers
      const driverRes = await fetch('/api/drivers/list');
      const driverData = await driverRes.json();
      setDrivers(driverData.drivers || []);

      // Fetch vehicles
      const vehicleRes = await fetch('/api/vehicles/list');
      const vehicleData = await vehicleRes.json();
      setVehicles(vehicleData.success ? vehicleData.vehicles || [] : []);

      // Fetch clients
      const clientRes = await fetch('/api/clients');
      const clientData = await clientRes.json();
      setClients(clientData.clients || []);

      setError(null);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setTrips(generateDummyTrips());
    } finally {
      setLoading(false);
    }
  };

  const generateDummyTrips = () => {
    return [
      { id: 1, vehicle_id: 1, driver_id: 1, origin: 'Mumbai', destination: 'Bangalore', load_type: 'General Cargo', weight: '15000', status: 'completed', distance: 850, created_at: '2024-03-20', completed_at: '2024-03-22' },
      { id: 2, vehicle_id: 2, driver_id: 2, origin: 'Delhi', destination: 'Jaipur', load_type: 'Electronics', weight: '5000', status: 'in-progress', distance: 280, created_at: '2024-03-25', eta: '2024-03-26' },
      { id: 3, vehicle_id: 3, driver_id: 3, origin: 'Chennai', destination: 'Hyderabad', load_type: 'Textiles', weight: '8000', status: 'pending', distance: 590, created_at: '2024-03-26' },
      { id: 4, vehicle_id: 4, driver_id: 4, origin: 'Pune', destination: 'Nagpur', load_type: 'Food Items', weight: '12000', status: 'completed', distance: 330, created_at: '2024-03-18', completed_at: '2024-03-19' },
      { id: 5, vehicle_id: 5, driver_id: 5, origin: 'Kolkata', destination: 'Assam', load_type: 'Machinery', weight: '20000', status: 'in-progress', distance: 450, created_at: '2024-03-24', eta: '2024-03-27' },
      { id: 6, vehicle_id: 6, driver_id: 6, origin: 'Ahmedabad', destination: 'Surat', load_type: 'Chemicals', weight: '10000', status: 'pending', distance: 290, created_at: '2024-03-26' },
    ];
  };

  const handleAddTrip = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/trips/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.success) {
        setTrips([...trips, data.trip]);
        setFormData({
          vehicle_id: '',
          driver_id: '',
          origin: '',
          destination: '',
          load_type: '',
          weight: '',
          status: 'pending',
        });
        setShowAddForm(false);
      } else {
        setError(data.message || 'Failed to create trip');
      }
    } catch (err) {
      setError('Error creating trip: ' + err.message);
    }
  };

  const handleUpdateStatus = async (tripId, newStatus) => {
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, completed_at: newStatus === 'completed' ? new Date().toISOString() : null }),
      });
      const data = await res.json();

      if (data.success) {
        setTrips(trips.map(t => t.id === tripId ? { ...t, status: newStatus } : t));
      }
    } catch (err) {
      setError('Failed to update trip status');
    }
  };

  const filteredTrips = trips.filter(t => {
    const matchesStatus = selectedStatus === 'all' || t.status === selectedStatus;
    const matchesSearch = t.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         t.load_type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: trips.length,
    pending: trips.filter(t => t.status === 'pending').length,
    active: trips.filter(t => t.status === 'in-progress').length,
    completed: trips.filter(t => t.status === 'completed').length,
    totalDistance: trips.reduce((sum, t) => sum + (t.distance || 0), 0),
  };

  const getDriverName = (driverId) => drivers.find(d => d.id === driverId)?.name || 'N/A';
  const getVehicleNumber = (vehicleId) => vehicles.find(v => v.id === vehicleId)?.vehicle_number || 'N/A';

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return { bg: '#fef3c7', text: '#92400e', icon: '⏳' };
      case 'in-progress': return { bg: '#dbeafe', text: '#0c4a6e', icon: '🚚' };
      case 'completed': return { bg: '#d1fae5', text: '#065f46', icon: '✅' };
      default: return { bg: '#f1f5f9', text: '#334155', icon: '❓' };
    }
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
            📋 Trip Management
          </h2>
          <p style={{
            fontSize: 12,
            color: '#64748b',
            margin: 0,
          }}>
            Track and manage all fleet trips
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
          }}
          onMouseOver={(e) => e.target.style.background = '#059669'}
          onMouseOut={(e) => e.target.style.background = '#10b981'}
        >
          ➕ Create Trip
        </button>
      </div>

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

      {/* Add Trip Form */}
      {showAddForm && (
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}>
          <h3 style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#1e293b',
            margin: '0 0 12px 0',
          }}>
            ➕ Create New Trip
          </h3>
          <form onSubmit={handleAddTrip} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                Vehicle
              </label>
              <select
                value={formData.vehicle_id}
                onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
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
                <option value="">Select vehicle</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.vehicle_number}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                Driver
              </label>
              <select
                value={formData.driver_id}
                onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
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
                <option value="">Select driver</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                Origin
              </label>
              <input type="text" value={formData.origin} onChange={(e) => setFormData({ ...formData, origin: e.target.value })} placeholder="Starting location" required style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                Destination
              </label>
              <input type="text" value={formData.destination} onChange={(e) => setFormData({ ...formData, destination: e.target.value })} placeholder="Final destination" required style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                Load Type
              </label>
              <input type="text" value={formData.load_type} onChange={(e) => setFormData({ ...formData, load_type: e.target.value })} placeholder="e.g., Electronics" required style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                Weight (kg)
              </label>
              <input type="number" value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: e.target.value })} placeholder="0" required style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button type="submit" style={{ flex: 1, padding: '8px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Create
              </button>
              <button type="button" onClick={() => setShowAddForm(false)} style={{ flex: 1, padding: '8px 14px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{stats.total}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Total Trips</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{stats.pending}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Pending</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{stats.active}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>In Progress</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{stats.completed}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Completed</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }}>{stats.totalDistance.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Total km</div>
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
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="🔍 Search origin, destination, or load..." style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
        </div>
        <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, minWidth: 140 }}>
          <option value="all">All Status</option>
          <option value="pending">⏳ Pending</option>
          <option value="in-progress">🚚 In Progress</option>
          <option value="completed">✅ Completed</option>
        </select>
      </div>

      {/* Trips Table */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            Loading trips...
          </div>
        ) : filteredTrips.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            No trips found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>Route</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>Vehicle</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>Driver</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>Load Type</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>Weight</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#64748b' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrips.map((trip, idx) => {
                  const colors = getStatusColor(trip.status);
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b', borderRight: '1px solid #e2e8f0' }}>
                        {trip.origin} → {trip.destination}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569', borderRight: '1px solid #e2e8f0', fontSize: 11 }}>
                        {getVehicleNumber(trip.vehicle_id)}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569', borderRight: '1px solid #e2e8f0', fontSize: 11 }}>
                        {getDriverName(trip.driver_id)}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                        {trip.load_type}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                        {trip.weight}kg
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: colors.bg, color: colors.text }}>
                          {colors.icon} {trip.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <select value={trip.status} onChange={(e) => handleUpdateStatus(trip.id, e.target.value)} style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                          <option value="pending">Pending</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
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
