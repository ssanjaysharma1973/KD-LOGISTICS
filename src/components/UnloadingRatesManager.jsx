import React, { useState, useEffect, useCallback } from 'react';

const API = '/api';
const CLIENT_ID = 'CLIENT_001';

export default function UnloadingRatesManager() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState(''); // ALL, secondary, tertiary, other
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPois, setSelectedPois] = useState(new Set());
  const [bulkCharges, setBulkCharges] = useState({
    category_1_32ft_34ft: '',
    category_2_22ft_24ft: '',
    category_3_small: ''
  });
  const itemsPerPage = 15;

  // Fetch unloading rates
  const fetchRates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/poi-unloading-rates?clientId=${CLIENT_ID}`);
      if (response.ok) {
        const data = await response.json();
        setRates(data.rates || []);
        setError('');
      } else {
        setError(`Failed to fetch rates: ${response.status}`);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Filter and search
  const filteredRates = rates.filter(rate => {
    const matchSearch = !search || 
      rate.poi_name.toLowerCase().includes(search.toLowerCase()) ||
      rate.city.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || rate.type === filterType;
    return matchSearch && matchType;
  });

  const totalPages = Math.ceil(filteredRates.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const displayedRates = filteredRates.slice(startIdx, startIdx + itemsPerPage);

  // Handle edit
  const handleEdit = (rate) => {
    setEditingId(rate.id);
    setEditData({
      category_1_32ft_34ft: rate.category_1_32ft_34ft || 0,
      category_2_22ft_24ft: rate.category_2_22ft_24ft || 0,
      category_3_small: rate.category_3_small || 0,
      notes: rate.notes || ''
    });
  };

  // Handle save
  const handleSave = async (poiId) => {
    try {
      const response = await fetch(`${API}/poi-unloading-rates/${poiId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: CLIENT_ID,
          ...editData
        })
      });

      if (response.ok) {
        const result = await response.json();
        setError(`✓ ${result.message}`);
        setEditingId(null);
        fetchRates();
      } else {
        setError(`Save failed: ${response.status}`);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  // Bulk operations
  const togglePoiSelection = (poiId) => {
    const newSelected = new Set(selectedPois);
    if (newSelected.has(poiId)) {
      newSelected.delete(poiId);
    } else {
      newSelected.add(poiId);
    }
    setSelectedPois(newSelected);
  };

  const toggleSelectAll = () => {
    const pageIds = new Set(displayedRates.map(r => r.poi_id || r.id));
    if (displayedRates.length > 0 && displayedRates.every(r => selectedPois.has(r.poi_id || r.id))) {
      const filtered = new Set(selectedPois);
      pageIds.forEach(id => filtered.delete(id));
      setSelectedPois(filtered);
    } else {
      const newSel = new Set(selectedPois);
      pageIds.forEach(id => newSel.add(id));
      setSelectedPois(newSel);
    }
  };

  const applyBulkCharges = async () => {
    if (selectedPois.size === 0) {
      setError('Please select at least one POI');
      return;
    }
    if (!bulkCharges.category_1_32ft_34ft || !bulkCharges.category_2_22ft_24ft || !bulkCharges.category_3_small) {
      setError('Please enter all charge amounts');
      return;
    }

    try {
      setLoading(true);
      const cat1 = parseFloat(bulkCharges.category_1_32ft_34ft) || 0;
      const cat2 = parseFloat(bulkCharges.category_2_22ft_24ft) || 0;
      const cat3 = parseFloat(bulkCharges.category_3_small) || 0;

      const updatePromises = Array.from(selectedPois).map(poiId =>
        fetch(`${API}/poi-unloading-rates/${poiId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category_1_32ft_34ft: cat1,
            category_2_22ft_24ft: cat2,
            category_3_small: cat3,
            notes: '',
            clientId: CLIENT_ID
          })
        })
      );

      const responses = await Promise.all(updatePromises);
      const allSuccess = responses.every(r => r.ok);

      if (allSuccess) {
        setMessage(`✓ Successfully updated ${selectedPois.size} POI(s)`);
        setBulkCharges({ category_1_32ft_34ft: '', category_2_22ft_24ft: '', category_3_small: '' });
        setSelectedPois(new Set());
        await fetchRates();
        setTimeout(() => setMessage(''), 3000);
      } else {
        setError('Some updates failed. Please try again.');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Summary stats
  const stats = {
    secondary: rates.filter(r => r.type === 'secondary').length,
    tertiary: rates.filter(r => r.type === 'tertiary').length,
    other: rates.filter(r => r.type === 'other').length,
    configured: rates.filter(r => r.category_1_32ft_34ft > 0 || r.category_2_22ft_24ft > 0 || r.category_3_small > 0).length
  };

  return (
    <div style={{ padding: '0 8px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>
          💰 POI Unloading Charges by Vehicle Category
        </h2>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          Set unloading charges for SECONDARY, TERTIARY & OTHER destinations by vehicle size
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px',
          marginBottom: '15px',
          backgroundColor: error.includes('✓') ? '#f0fdf4' : '#ffebee',
          border: `1px solid ${error.includes('✓') ? '#86efac' : '#f88'}`,
          borderRadius: '4px',
          color: error.includes('✓') ? '#16a34a' : '#c62828'
        }}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>SECONDARY POINTS</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{stats.secondary}</div>
        </div>
        <div style={{ padding: '12px 16px', backgroundColor: '#fef3c7', borderRadius: 8, border: '1px solid #fcd34d' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e' }}>TERTIARY POINTS</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#92400e' }}>{stats.tertiary}</div>
        </div>
        <div style={{ padding: '12px 16px', backgroundColor: '#f1f5f9', borderRadius: 8, border: '1px solid #cbd5e1' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>OTHER POINTS</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#64748b' }}>{stats.other}</div>
        </div>
        <div style={{ padding: '12px 16px', backgroundColor: '#dbeafe', borderRadius: 8, border: '1px solid #93c5fd' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#1e40af' }}>CONFIGURED</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1e40af' }}>{stats.configured}</div>
        </div>
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search POI name or city..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          style={{
            padding: '8px 12px',
            fontSize: 12,
            borderRadius: 6,
            border: '1px solid #d1d5db',
            flex: 1,
            minWidth: 200
          }}
        />
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
          style={{
            padding: '8px 12px',
            fontSize: 12,
            borderRadius: 6,
            border: '1px solid #d1d5db',
            minWidth: 150
          }}
        >
          <option value="">All Types ({filteredRates.length})</option>
          <option value="secondary">🔄 Secondary ({rates.filter(r => r.type === 'secondary').length})</option>
          <option value="tertiary">📦 Tertiary ({rates.filter(r => r.type === 'tertiary').length})</option>
          <option value="other">📍 Other ({rates.filter(r => r.type === 'other').length})</option>
        </select>
      </div>

      {/* Bulk Operations Panel */}
      <div style={{
        backgroundColor: '#f0f9ff',
        border: '1px solid #93c5fd',
        borderRadius: 8,
        padding: 16,
        marginBottom: 20
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af', marginBottom: 12 }}>
          📋 Bulk Charge Entry ({selectedPois.size} selected)
        </div>
        
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
              32FT & 34FT (₹)
            </label>
            <input
              type="number"
              min="0"
              value={bulkCharges.category_1_32ft_34ft}
              onChange={(e) => setBulkCharges({...bulkCharges, category_1_32ft_34ft: e.target.value})}
              placeholder="Amount"
              style={{
                padding: '8px 12px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                width: 120
              }}
            />
          </div>
          
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
              22FT & 24FT (₹)
            </label>
            <input
              type="number"
              min="0"
              value={bulkCharges.category_2_22ft_24ft}
              onChange={(e) => setBulkCharges({...bulkCharges, category_2_22ft_24ft: e.target.value})}
              placeholder="Amount"
              style={{
                padding: '8px 12px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                width: 120
              }}
            />
          </div>
          
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
              Small/Vans (₹)
            </label>
            <input
              type="number"
              min="0"
              value={bulkCharges.category_3_small}
              onChange={(e) => setBulkCharges({...bulkCharges, category_3_small: e.target.value})}
              placeholder="Amount"
              style={{
                padding: '8px 12px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                width: 120
              }}
            />
          </div>

          <button
            onClick={applyBulkCharges}
            disabled={selectedPois.size === 0 || loading}
            style={{
              padding: '8px 16px',
              background: selectedPois.size === 0 ? '#cbd5e1' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: selectedPois.size === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            ✓ Apply to {selectedPois.size} POI(s)
          </button>
        </div>

        {message && (
          <div style={{
            fontSize: 12,
            color: '#16a34a',
            backgroundColor: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: 4,
            padding: 8,
            marginTop: 8
          }}>
            {message}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>Loading...</div>
      ) : displayedRates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', background: '#f9fafb', borderRadius: 8 }}>
          No POIs found. Try adjusting your filters.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 11, width: 40 }}>
                  <input
                    type="checkbox"
                    checked={displayedRates.length > 0 && displayedRates.every(r => selectedPois.has(r.poi_id || r.id))}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11 }}>POI NAME</th>
                <th style={{ padding: '10px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11 }}>CITY</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 11 }}>TYPE</th>
                <th style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 11 }}>🏭 32/34 FT</th>
                <th style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 11 }}>🚚 22/24 FT</th>
                <th style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: 11 }}>📦 SMALL</th>
                <th style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 11 }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {displayedRates.map(rate => (
                <tr key={rate.id} style={{ borderBottom: '1px solid #e2e8f0', background: selectedPois.has(rate.poi_id || rate.id) ? '#eff6ff' : 'white' }}>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedPois.has(rate.poi_id || rate.id)}
                      onChange={() => togglePoiSelection(rate.poi_id || rate.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '10px', fontWeight: 600, color: '#1e293b' }}>{rate.poi_name}</td>
                  <td style={{ padding: '10px', color: '#4b5563' }}>{rate.city}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      background: rate.type === 'secondary' ? '#fef3c7' : rate.type === 'tertiary' ? '#d1fae5' : '#f3f4f6',
                      color: rate.type === 'secondary' ? '#92400e' : rate.type === 'tertiary' ? '#065f46' : '#6b7280'
                    }}>
                      {rate.type === 'secondary' ? '🔄' : rate.type === 'tertiary' ? '📦' : '📍'} {rate.type}
                    </span>
                  </td>

                  {editingId === rate.id ? (
                    <>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={editData.category_1_32ft_34ft}
                          onChange={(e) => setEditData({...editData, category_1_32ft_34ft: parseFloat(e.target.value) || 0})}
                          style={{
                            width: '80px',
                            padding: '6px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            textAlign: 'right',
                            fontSize: 11
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={editData.category_2_22ft_24ft}
                          onChange={(e) => setEditData({...editData, category_2_22ft_24ft: parseFloat(e.target.value) || 0})}
                          style={{
                            width: '80px',
                            padding: '6px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            textAlign: 'right',
                            fontSize: 11
                          }}
                        />
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={editData.category_3_small}
                          onChange={(e) => setEditData({...editData, category_3_small: parseFloat(e.target.value) || 0})}
                          style={{
                            width: '80px',
                            padding: '6px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            textAlign: 'right',
                            fontSize: 11
                          }}
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>₹{(rate.category_1_32ft_34ft || 0).toFixed(0)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>₹{(rate.category_2_22ft_24ft || 0).toFixed(0)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>₹{(rate.category_3_small || 0).toFixed(0)}</td>
                    </>
                  )}

                  <td style={{ padding: '10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {editingId === rate.id ? (
                      <>
                        <button
                          onClick={() => handleSave(rate.id)}
                          style={{
                            padding: '4px 10px',
                            marginRight: 4,
                            fontSize: 11,
                            backgroundColor: '#22c55e',
                            color: 'white',
                            border: 'none',
                            borderRadius: 3,
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          ✓ Save
                        </button>
                        <button
                          onClick={handleCancel}
                          style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: 3,
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          ✕ Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleEdit(rate)}
                        style={{
                          padding: '4px 10px',
                          fontSize: 11,
                          backgroundColor: '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: 3,
                          cursor: 'pointer'
                        }}
                      >
                        ✏️ Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 15 }}>
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i + 1}
              onClick={() => setCurrentPage(i + 1)}
              style={{
                padding: '6px 10px',
                borderRadius: 4,
                border: '1px solid #ddd',
                background: currentPage === i + 1 ? '#4338ca' : '#fff',
                color: currentPage === i + 1 ? '#fff' : '#333',
                cursor: 'pointer',
                fontWeight: currentPage === i + 1 ? 700 : 400,
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
