import React, { useState } from 'react';
import { X, Edit2, Trash2, Search, MoreVertical, Plus } from 'lucide-react';

const API = 'http://localhost:3000/api';
const EMPTY_FORM = { poi_name: '', city: '', latitude: '', longitude: '', radius_meters: 1500 };

export default function POIListModal({ pois, onClose, onEdit, onDelete, onAdd }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState('');
  const [addOk, setAddOk] = useState('');

  const handleAdd = async () => {
    if (!addForm.poi_name.trim()) { setAddErr('POI Name is required.'); return; }
    if (!addForm.latitude || !addForm.longitude) { setAddErr('Latitude and Longitude are required.'); return; }
    setAdding(true); setAddErr(''); setAddOk('');
    try {
      const res = await fetch(`${API}/pois`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poi_name: addForm.poi_name.trim(),
          city: addForm.city.trim(),
          latitude: parseFloat(addForm.latitude),
          longitude: parseFloat(addForm.longitude),
          radius_meters: parseInt(addForm.radius_meters) || 1500,
          clientId: 'CLIENT_001',
        }),
      });
      const d = await res.json();
      if (d.success) {
        setAddOk(`✅ "${d.poi_name}" added (ID: ${d.poi_id})`);
        setAddForm(EMPTY_FORM);
        if (onAdd) onAdd({ id: d.poi_id, poi_name: d.poi_name, city: addForm.city.trim(), latitude: parseFloat(addForm.latitude), longitude: parseFloat(addForm.longitude), radius_meters: parseInt(addForm.radius_meters) || 1500 });
        // Notify other components (e.g. TripDispatchWizard) that a new POI was added
        window.dispatchEvent(new Event('poi-added'));
      } else {
        setAddErr(d.error || 'Failed to add POI.');
      }
    } catch (e) {
      setAddErr('Error: ' + e.message);
    } finally {
      setAdding(false);
    }
  };

  const filteredPOIs = pois.filter(poi =>
    (poi.poi_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (poi.city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (poi.address || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedPOIs = [...filteredPOIs].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.poi_name || '').localeCompare(b.poi_name || '');
      case 'city':
        return (a.city || '').localeCompare(b.city || '');
      case 'id':
        return a.id - b.id;
      default:
        return 0;
    }
  });

  const handleDelete = (poi) => {
    if (window.confirm(`Delete POI "${poi.poi_name}"?`)) {
      onDelete(poi.id, poi.poi_name);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
    >
      <div 
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          width: '100%',
          maxWidth: 'calc(100vw - 380px)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10000,
          position: 'relative',
          minWidth: '700px',
          overflow: 'hidden'
        }}
      >
        {/* ===== HEADER ===== */}
        <div 
          style={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #cccccc',
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}
        >
          <h2 style={{fontSize: '24px', fontWeight: 'bold', color: '#000000', margin: 0}}>
            📍 All POIs ({pois.length})
          </h2>
          <div style={{display:'flex', gap:8, alignItems:'center'}}>
            <button
              onClick={() => { setShowAddForm(v => !v); setAddErr(''); setAddOk(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', backgroundColor: showAddForm ? '#e0e7ff' : '#16a34a',
                color: showAddForm ? '#4338ca' : '#fff', border: 'none', borderRadius: 7,
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              <Plus size={16} /> {showAddForm ? 'Cancel' : '+ New POI'}
            </button>
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                color: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={28} />
            </button>
          </div>
        </div>

        {/* ===== ADD POI FORM ===== */}
        {showAddForm && (
          <div style={{ background: '#f0fdf4', borderBottom: '2px solid #86efac', padding: '16px 24px' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 180px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>POI Name *</label>
                <input value={addForm.poi_name} onChange={e => setAddForm(p => ({...p, poi_name: e.target.value}))} placeholder="e.g. HAIER WAREHOUSE KARNAL" style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #16a34a', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>City</label>
                <input value={addForm.city} onChange={e => setAddForm(p => ({...p, city: e.target.value}))} placeholder="e.g. Karnal" style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Latitude *</label>
                <input type="number" step="0.0001" value={addForm.latitude} onChange={e => setAddForm(p => ({...p, latitude: e.target.value}))} placeholder="28.6000" style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Longitude *</label>
                <input type="number" step="0.0001" value={addForm.longitude} onChange={e => setAddForm(p => ({...p, longitude: e.target.value}))} placeholder="77.2000" style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: '0 1 100px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Radius (m)</label>
                <input type="number" value={addForm.radius_meters} onChange={e => setAddForm(p => ({...p, radius_meters: e.target.value}))} placeholder="1500" style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <button onClick={handleAdd} disabled={adding} style={{ padding: '8px 20px', background: adding ? '#9ca3af' : '#16a34a', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: adding ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', height: 36 }}>
                {adding ? '⏳ Saving…' : '💾 Save POI'}
              </button>
            </div>
            {addErr && <div style={{ marginTop: 8, color: '#dc2626', fontSize: 12, fontWeight: 600 }}>{addErr}</div>}
            {addOk  && <div style={{ marginTop: 8, color: '#16a34a', fontSize: 12, fontWeight: 600 }}>{addOk}</div>}
          </div>
        )}

        {/* ===== SEARCH & FILTER ===== */}
        <div 
          style={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #cccccc',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            flexShrink: 0
          }}
        >
          {/* Search Input */}
          <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <Search size={18} style={{color: '#999999', flexShrink: 0}} />
            <input
              type="text"
              placeholder="Search by name, city, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #999999',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                color: '#000000'
              }}
            />
          </div>

          {/* Sort Dropdown */}
          <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
            <label style={{fontSize: '14px', fontWeight: '500', color: '#000000', whiteSpace: 'nowrap'}}>
              Sort by:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #999999',
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: '#ffffff',
                color: '#000000',
                cursor: 'pointer'
              }}
            >
              <option value="name">POI Name</option>
              <option value="city">City</option>
              <option value="id">ID</option>
            </select>
          </div>
        </div>

        {/* ===== TABLE CONTAINER ===== */}
        <div 
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'auto',
            backgroundColor: '#ffffff',
            minHeight: 0
          }}
        >
          {sortedPOIs.length === 0 ? (
            <div style={{padding: '32px 24px', textAlign: 'center'}}>
              <p style={{fontSize: '16px', fontWeight: '500', color: '#000000'}}>
                {pois.length === 0 ? 'No POIs created yet' : 'No POIs match your search'}
              </p>
            </div>
          ) : (
            <table style={{width: '100%', borderCollapse: 'collapse', minWidth: '1200px'}}>
              <thead style={{position: 'sticky', top: 0, zIndex: 10}}>
                <tr style={{backgroundColor: '#0066cc'}}>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#ffffff', borderBottom: '2px solid #004499', minWidth: '60px'}}>ID</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#ffffff', borderBottom: '2px solid #004499', minWidth: '220px'}}>POI Name</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#ffffff', borderBottom: '2px solid #004499', minWidth: '140px'}}>City</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#ffffff', borderBottom: '2px solid #004499', minWidth: '150px'}}>Latitude</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#ffffff', borderBottom: '2px solid #004499', minWidth: '150px'}}>Longitude</th>
                  <th style={{padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#ffffff', borderBottom: '2px solid #004499', minWidth: '120px'}}>Radius</th>
                  <th style={{padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: '#ffffff', borderBottom: '2px solid #004499', minWidth: '100px'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPOIs.map((poi, idx) => (
                  <tr
                    key={poi.id}
                    style={{
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f5f5f5',
                      borderBottom: '1px solid #dddddd'
                    }}
                  >
                    <td style={{padding: '12px 16px', fontSize: '13px', color: '#000000', minWidth: '60px'}}>
                      <span style={{display: 'inline-block', backgroundColor: '#e0e8ff', color: '#0033aa', padding: '4px 10px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px'}}>
                        {poi.id}
                      </span>
                    </td>
                    <td style={{padding: '12px 16px', fontSize: '13px', fontWeight: '500', color: '#000000', minWidth: '220px'}}>
                      {poi.poi_name}
                    </td>
                    <td style={{padding: '12px 16px', fontSize: '13px', color: '#000000', minWidth: '140px'}}>
                      {poi.city || '-'}
                    </td>
                    <td style={{padding: '12px 16px', fontSize: '12px', fontFamily: 'monospace', color: '#000000', minWidth: '150px'}}>
                      {Number(poi.latitude).toFixed(4)}
                    </td>
                    <td style={{padding: '12px 16px', fontSize: '12px', fontFamily: 'monospace', color: '#000000', minWidth: '150px'}}>
                      {Number(poi.longitude).toFixed(4)}
                    </td>
                    <td style={{padding: '12px 16px', fontSize: '13px', color: '#000000', minWidth: '120px'}}>
                      {poi.radius_meters} m
                    </td>
                    <td style={{padding: '12px 16px', textAlign: 'center', minWidth: '100px', position: 'relative'}}>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === poi.id ? null : poi.id)}
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '6px',
                          color: '#000000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto'
                        }}
                      >
                        <MoreVertical size={18} />
                      </button>

                      {openDropdown === poi.id && (
                        <div style={{position: 'absolute', right: '0', top: '32px', backgroundColor: '#ffffff', border: '1px solid #cccccc', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', zIndex: 10001, minWidth: '140px', overflow: 'hidden'}}>
                          <button
                            onClick={() => {
                              onEdit(poi);
                              setOpenDropdown(null);
                              onClose();
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '12px 16px',
                              backgroundColor: '#ffffff',
                              border: 'none',
                              borderBottom: '1px solid #eeeeee',
                              cursor: 'pointer',
                              color: '#0066cc',
                              fontSize: '13px',
                              fontWeight: '500',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f5ff'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
                          >
                            <Edit2 size={14} /> Edit
                          </button>
                          <button
                            onClick={() => {
                              handleDelete(poi);
                              setOpenDropdown(null);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '12px 16px',
                              backgroundColor: '#ffffff',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#cc0000',
                              fontSize: '13px',
                              fontWeight: '500',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#fff5f5'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ===== FOOTER ===== */}
        <div 
          style={{
            backgroundColor: '#ffffff',
            borderTop: '1px solid #cccccc',
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}
        >
          <p style={{fontSize: '13px', fontWeight: '500', color: '#000000', margin: 0}}>
            Showing <span style={{color: '#0066cc', fontWeight: 'bold'}}>{sortedPOIs.length}</span> of <span style={{color: '#0066cc', fontWeight: 'bold'}}>{pois.length}</span> POIs
          </p>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0066cc',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#0052a3'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#0066cc'}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
