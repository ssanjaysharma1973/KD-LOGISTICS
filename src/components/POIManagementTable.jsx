import React, { useState, useEffect } from 'react';

const POIManagementTable = () => {
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');
  const [cities, setCities] = useState([]);
  const [states, setStates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    poi_name: '',
    state: '',
    city: '',
    address: '',
    latitude: '',
    longitude: '',
    pin_code: '',
    radius_meters: '1500',
    type: 'primary',
  });

  const CLIENT_ID = 'CLIENT_001';
  const API_URL = 'http://localhost:3000';

  // Fetch all POIs on mount
  useEffect(() => {
    fetchPOIs();
  }, []);

  const fetchPOIs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/pois?clientId=${CLIENT_ID}`);
      if (response.ok) {
        const data = await response.json();
        setPois(data);
        
        // Extract unique cities and states
        const uniqueCities = [...new Set(data.map(p => p.city).filter(Boolean))].sort();
        const uniqueStates = [...new Set(data.map(p => p.state).filter(Boolean))].sort();
        
        setCities(uniqueCities);
        setStates(uniqueStates);
      }
    } catch (err) {
      setError(`Error fetching POIs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter POIs based on search and filters
  const filteredPOIs = pois.filter(poi => {
    const poiName = poi.poi_name || poi.name || '';
    const city = poi.city || '';
    const address = poi.address || '';
    const state = poi.state || '';
    const type = poi.type || 'primary';
    
    const matchSearch = poiName.toLowerCase().includes(search.toLowerCase()) ||
                       city.toLowerCase().includes(search.toLowerCase()) ||
                       address.toLowerCase().includes(search.toLowerCase());
    const matchCity = !filterCity || city === filterCity;
    const matchState = !filterState || state === filterState;
    const matchType = !formData.type || type === formData.type;
    return matchSearch && matchCity && matchState && matchType;
  });

  // Pagination
  const totalPages = Math.ceil(filteredPOIs.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const displayedPOIs = filteredPOIs.slice(startIdx, startIdx + itemsPerPage);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  // ...existing code...

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.poi_name || !formData.city || !formData.state) {
      setError('POI Name, State, and City are required');
      return;
    }

    const submitData = {
      ...formData,
      clientId: CLIENT_ID,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      radius_meters: parseInt(formData.radius_meters || 1500),
    };

    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId 
        ? `${API_URL}/api/pois/${editingId}`
        : `${API_URL}/api/pois`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        setError('');
        setShowForm(false);
        setEditingId(null);
        setFormData({
          poi_name: '', state: '', city: '', address: '',
          latitude: '', longitude: '', pin_code: '', radius_meters: '1500', type: 'primary',
        });
        fetchPOIs();
      } else {
        setError(`Error: ${response.status}`);
      }
    } catch (err) {
      setError(`Submit error: ${err.message}`);
    }
  };

  const handleEdit = (poi) => {
    setEditingId(poi.id);
    setFormData({
      poi_name: poi.poi_name || poi.name || '',
      state: poi.state || '',
      city: poi.city || '',
      address: poi.address || '',
      latitude: poi.latitude || '',
      longitude: poi.longitude || '',
      pin_code: poi.pin_code || '',
      radius_meters: poi.radius_meters || '1500',
      type: poi.type || 'primary',
    });
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete POI "${name || 'Unknown'}"?`)) return;

    try {
      const response = await fetch(`${API_URL}/api/pois/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setError('');
        fetchPOIs();
      } else {
        setError(`Delete failed: ${response.status}`);
      }
    } catch (err) {
      setError(`Delete error: ${err.message}`);
    }
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    formDataUpload.append('clientId', CLIENT_ID);

    try {
      const response = await fetch(`${API_URL}/api/poi/import-csv`, {
        method: 'POST',
        body: formDataUpload,
      });

      if (response.ok) {
        const result = await response.json();
        setError(`Success: ${result.imported} POIs imported, ${result.skipped} skipped`);
        fetchPOIs();
      } else {
        setError(`Upload failed: ${response.status}`);
      }
    } catch (err) {
      setError(`Upload error: ${err.message}`);
    }

    e.target.value = '';
  };

  const handleCSVExport = () => {
    const headers = ['ID', 'State', 'City', 'POI Name', 'Address', 'Latitude', 'Longitude', 'Pin Code'];
    const rows = filteredPOIs.map(poi => [
      poi.id,
      poi.state || '',
      poi.city || '',
      poi.poi_name || '',
      poi.address || '',
      poi.latitude || '',
      poi.longitude || '',
      poi.pin_code || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `POIs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>POI Management System</h1>

      {error && (
        <div style={{
          padding: '10px',
          marginBottom: '15px',
          backgroundColor: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '4px',
          color: '#c62828'
        }}>
          {error}
        </div>
      )}

      {/* Action Bar */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              poi_name: '', state: '', city: '', address: '',
              latitude: '', longitude: '', pin_code: '', radius_meters: '1500',
            });
            setShowForm(!showForm);
          }}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          {showForm ? 'Cancel' : '+ Add New POI'}
        </button>

        <label style={{ cursor: 'pointer' }}>
          <input
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            style={{ display: 'none' }}
          />
          <span style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            borderRadius: '4px',
            display: 'inline-block',
            fontSize: '14px',
            fontWeight: 'bold',
          }}>
            Upload CSV
          </span>
        </label>

        <button
          onClick={handleCSVExport}
          style={{
            padding: '10px 20px',
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          Download CSV
        </button>
        <label>
          Type:
          <select name="type" value={formData.type} onChange={handleInputChange}>
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
          </select>
        </label>

        <span style={{ marginLeft: 'auto', color: '#666', fontSize: '14px' }}>
          Total: {filteredPOIs.length} POIs
        </span>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div style={{
          border: '1px solid #ddd',
          padding: '20px',
          marginBottom: '20px',
          borderRadius: '4px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3>{editingId ? 'Edit POI' : 'Add New POI'}</h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
            <input
              type="text"
              name="state"
              placeholder="State"
              value={formData.state}
              onChange={handleInputChange}
              required
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <input
              type="text"
              name="city"
              placeholder="City"
              value={formData.city}
              onChange={handleInputChange}
              required
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <input
              type="text"
              name="poi_name"
              placeholder="POI Name"
              value={formData.poi_name}
              onChange={handleInputChange}
              required
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <input
              type="text"
              name="address"
              placeholder="Address"
              value={formData.address}
              onChange={handleInputChange}
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', gridColumn: 'span 2' }}
            />
            <input
              type="number"
              name="latitude"
              placeholder="Latitude"
              step="0.0001"
              value={formData.latitude}
              onChange={handleInputChange}
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <input
              type="number"
              name="longitude"
              placeholder="Longitude"
              step="0.0001"
              value={formData.longitude}
              onChange={handleInputChange}
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <input
              type="text"
              name="pin_code"
              placeholder="Pin Code"
              value={formData.pin_code}
              onChange={handleInputChange}
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <input
              type="number"
              name="radius_meters"
              placeholder="Radius (meters)"
              value={formData.radius_meters}
              onChange={handleInputChange}
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <button
              type="submit"
              style={{
                gridColumn: 'span 2',
                padding: '10px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              {editingId ? 'Update POI' : 'Create POI'}
            </button>
          </form>
        </div>
      )}

      {/* Filter Bar */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder="Search POI name, city, address..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          style={{
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            flex: '1',
            minWidth: '200px',
          }}
        />

        <select
          value={filterState}
          onChange={(e) => {
            setFilterState(e.target.value);
            setCurrentPage(1);
          }}
          style={{
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            minWidth: '150px',
          }}
        >
          <option value="">All States</option>
          {states.map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>

        <select
          value={filterCity}
          onChange={(e) => {
            setFilterCity(e.target.value);
            setCurrentPage(1);
          }}
          style={{
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            minWidth: '150px',
          }}
        >
          <option value="">All Cities</option>
          {cities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      {/* POI Table */}
      <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: 'white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <thead style={{ backgroundColor: '#f5f5f5' }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', fontWeight: 'bold' }}>ID</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', fontWeight: 'bold' }}>State</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', fontWeight: 'bold' }}>City</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', fontWeight: 'bold' }}>POI Name</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', fontWeight: 'bold' }}>Address</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', fontWeight: 'bold' }}>Pin Code</th>
              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd', fontWeight: 'bold' }}>Type</th>
              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd', fontWeight: 'bold' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedPOIs.map(poi => (
              <tr key={poi.id} style={{ borderBottom: '1px solid #eee', '&:hover': { backgroundColor: '#f9f9f9' } }}>
                <td style={{ padding: '12px' }}>{poi.id}</td>
                <td style={{ padding: '12px' }}>{poi.state || '-'}</td>
                <td style={{ padding: '12px' }}>{poi.city || '-'}</td>
                <td style={{ padding: '12px', fontWeight: '500' }}>{poi.poi_name || poi.name || '-'}</td>
                <td style={{ padding: '12px', fontSize: '12px', color: '#666' }}>{(poi.address || '').substring(0, 40)}...</td>
                <td style={{ padding: '12px' }}>{poi.pin_code || '-'}</td>
                <td style={{ padding: '12px' }}>{poi.type || 'primary'}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button
                    onClick={() => handleEdit(poi)}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      marginRight: '5px',
                      fontSize: '12px',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(poi.id, poi.poi_name || poi.name)}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && <p style={{ textAlign: 'center', color: '#666' }}>Loading...</p>}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '5px',
          marginTop: '20px',
        }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              style={{
                padding: '8px 12px',
                backgroundColor: currentPage === page ? '#2196F3' : '#f0f0f0',
                color: currentPage === page ? 'white' : '#333',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontWeight: currentPage === page ? 'bold' : 'normal',
              }}
            >
              {page}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default POIManagementTable;
