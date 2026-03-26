import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { API_BASE } from '../utils/apiBase.js';

const API = `${API_BASE}/api`;
const APP_API = API_BASE;
const CLIENT_ID = 'CLIENT_001';

const CATEGORY_STYLES = {
  PRIMARY:   { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', icon: '🏭', label: 'Hub / Factory' },
  SECONDARY: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', icon: '🔄', label: 'Distributor' },
  TERTIARY:  { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7', icon: '📦', label: 'Dealer' },
  OTHER:     { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db', icon: '📍', label: 'Other' },
};

const POI_CATEGORIES = {
  food:        { icon: '🍕', label: 'Food & Bev',    bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  consumer:    { icon: '🛒', label: 'Consumer Goods', bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' },
  pharma:      { icon: '💊', label: 'Pharma',         bg: '#fdf2f8', color: '#be185d', border: '#fbcfe8' },
  electronics: { icon: '⚡', label: 'Electronics',    bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' },
  general:     { icon: '📦', label: 'General',        bg: '#f9fafb', color: '#6b7280', border: '#d1d5db' },
};

export default function POIManagement() {
  // Tabs
  const [activeTab, setActiveTab] = useState('management'); // 'management' or 'discovery'

  // ===== MANAGEMENT TAB STATE =====
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterType, setFilterType] = useState(''); // SEPARATE from form data!
  const [filterPoiCategory, setFilterPoiCategory] = useState('');
  const [cities, setCities] = useState([]);
  const [states, setStates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedPOIs, setSelectedPOIs] = useState(new Set());
  const [bulkType, setBulkType] = useState('primary');

  // vehicle assignment modal
  const [vehicleModalPoi, setVehicleModalPoi] = useState(null);
  const [poiAssignments, setPoiAssignments] = useState([]);
  const [allVehicles, setAllVehicles] = useState([]);
  const [assignVehicleNo, setAssignVehicleNo] = useState('');

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
    poi_category: 'general',
  });

  // ===== DISCOVERY TAB STATE =====
  const [points, setPoints] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedUpload, setSelectedUpload] = useState('');
  const [editingDiscoveryId, setEditingDiscoveryId] = useState(null);
  const [editDiscoveryForm, setEditDiscoveryForm] = useState({});
  const [showAll, setShowAll] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const fileRef = useRef(null);

  // ===== FETCH FUNCTIONS =====

  const fetchPOIs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${APP_API}/api/pois?clientId=${CLIENT_ID}`);
      if (response.ok) {
        const data = await response.json();
        setPois(data);
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
  }, []);

  const fetchDiscoveryPoints = useCallback(async () => {
    setDiscoveryLoading(true);
    try {
      let url = `${API}/discovered-points?client_id=${CLIENT_ID}`;
      if (categoryFilter) url += `&category=${categoryFilter}`;
      if (selectedUpload) url += `&upload_id=${selectedUpload}`;
      if (showAll) url += `&show_all=true`;
      const res = await fetch(url);
      const data = await res.json();
      setPoints(data.points || []);
    } catch (err) {
      console.error('Fetch points error:', err);
    } finally {
      setDiscoveryLoading(false);
    }
  }, [categoryFilter, selectedUpload, showAll]);

  const fetchUploads = useCallback(async () => {
    try {
      const res = await fetch(`${API}/csv-uploads?client_id=${CLIENT_ID}`);
      const data = await res.json();
      setUploads(data.uploads || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (activeTab === 'management') {
      fetchPOIs();
    } else {
      fetchDiscoveryPoints();
      fetchUploads();
    }
  }, [activeTab, fetchPOIs, fetchDiscoveryPoints, fetchUploads]);

  // ===== MANAGEMENT FUNCTIONS =====

  const filteredPOIs = pois.filter(poi => {
    const poiName = poi.poi_name || poi.name || '';
    const city = poi.city || '';
    const address = poi.address || '';
    const state = poi.state || '';
    const type = poi.type || 'primary';
    const cat = poi.poi_category || 'general';
    
    // Name/address/city search
    const matchSearch = !search || 
      poiName.toLowerCase().includes(search.toLowerCase()) ||
      city.toLowerCase().includes(search.toLowerCase()) ||
      address.toLowerCase().includes(search.toLowerCase()) ||
      state.toLowerCase().includes(search.toLowerCase());
    
    // City filter (if set, require match; if not set, show all)
    const matchCity = !filterCity || city === filterCity;
    
    // State filter (if set, require match; if not set, show all)
    const matchState = !filterState || state === filterState;
    
    // Type filter (if set, require match; if not set, show all)
    const matchType = !filterType ||
      (filterType === 'pending' ? (!poi.type || poi.type === '') : type === filterType);

    // Category filter
    const matchCat = !filterPoiCategory || cat === filterPoiCategory;
    
    return matchSearch && matchCity && matchState && matchType && matchCat;
  });

  const totalPages = Math.ceil(filteredPOIs.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const displayedPOIs = filteredPOIs.slice(startIdx, startIdx + itemsPerPage);

  // Reverse geocoding: convert coordinates to city/address using Nominatim API
  const reverseGeocode = async (lat, lon) => {
    if (!lat || !lon) return;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        { headers: { 'Accept': 'application/json' } }
      );
      const data = await response.json();
      if (data.address) {
        const addr = data.address;
        const city = addr.city || addr.town || addr.village || addr.county || '';
        const state = addr.state || '';
        const poiName = addr.name || addr.house_name || addr.road || '';
        
        setFormData(prev => ({
          ...prev,
          city: prev.city || city,
          state: prev.state || state,
          poi_name: prev.poi_name || poiName,
          address: prev.address || data.display_name.split(',').slice(0, 2).join(','),
        }));
        setError(`✓ Located: ${city}, ${state}`);
      }
    } catch (err) {
      console.error('Geocoding error:', err);
    }
  };

  // Debounced coordinate lookup
  const geoTimeout = useRef(null);
  const handleCoordinateChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Trigger reverse geocoding when both coordinates are entered
    clearTimeout(geoTimeout.current);
    geoTimeout.current = setTimeout(() => {
      if (formData.latitude && formData.longitude) {
        reverseGeocode(formData.latitude, formData.longitude);
      }
    }, 1000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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
        ? `${APP_API}/api/pois/${editingId}`
        : `${APP_API}/api/pois`;

      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submitData) });
      if (response.ok) {
        setError('');
        setShowForm(false);
        setEditingId(null);
        setFormData({ poi_name: '', state: '', city: '', address: '', latitude: '', longitude: '', pin_code: '', radius_meters: '1500', type: 'primary', poi_category: 'general' });
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
      poi_category: poi.poi_category || 'general',
    });
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete POI "${name || 'Unknown'}"?`)) return;
    try {
      const response = await fetch(`${APP_API}/api/pois/${id}`, { method: 'DELETE' });
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

  const togglePoiSelection = (id) => {
    const newSelected = new Set(selectedPOIs);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPOIs(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedPOIs.size === displayedPOIs.length) {
      setSelectedPOIs(new Set());
    } else {
      setSelectedPOIs(new Set(displayedPOIs.map(p => p.id)));
    }
  };

  const handleBulkTypeChange = async () => {
    if (selectedPOIs.size === 0) return;
    if (!window.confirm(`Change type to "${bulkType}" for ${selectedPOIs.size} POI(s)?`)) return;

    try {
      const updatePromises = Array.from(selectedPOIs).map(id => {
        const poi = pois.find(p => p.id === id);
        return fetch(`${APP_API}/api/pois/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...poi, type: bulkType, clientId: CLIENT_ID })
        });
      });

      const results = await Promise.all(updatePromises);
      if (results.every(r => r.ok)) {
        setError(`✓ Updated ${selectedPOIs.size} POI(s) to ${bulkType}`);
        setSelectedPOIs(new Set());
        fetchPOIs();
      } else {
        setError('Some updates failed');
      }
    } catch (err) {
      setError(`Bulk update error: ${err.message}`);
    }
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    formDataUpload.append('clientId', CLIENT_ID);

    try {
      const response = await fetch(`${APP_API}/api/poi/import-csv`, {
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

  const handleExcelExport = () => {
    const rows = filteredPOIs.map(poi => ({
      'ID': poi.id,
      'State': poi.state || '',
      'City': poi.city || '',
      'POI Name': poi.poi_name || poi.name || '',
      'Address': poi.address || '',
      'Latitude': poi.latitude || '',
      'Longitude': poi.longitude || '',
      'Pin Code': poi.pin_code || '',
      'Type': poi.type || 'primary',
      'Category': poi.poi_category || 'general',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'POIs');
    XLSX.writeFile(wb, `POIs_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleCSVExport = () => {
    const headers = ['ID', 'State', 'City', 'POI Name', 'Address', 'Latitude', 'Longitude', 'Pin Code', 'Type', 'Category'];
    const rows = filteredPOIs.map(poi => [
      poi.id,
      poi.state || '',
      poi.city || '',
      poi.poi_name || poi.name || '',
      poi.address || '',
      poi.latitude || '',
      poi.longitude || '',
      poi.pin_code || '',
      poi.type || 'primary',
      poi.poi_category || 'general',
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `POIs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // ===== VEHICLE ASSIGNMENT MODAL FUNCTIONS =====

  const fetchPoiAssignments = async (poiId) => {
    try {
      const res = await fetch(`${APP_API}/api/poi-vehicle-assignments?poiId=${poiId}&clientId=${CLIENT_ID}`);
      const data = await res.json();
      setPoiAssignments(data.assignments || []);
    } catch { setPoiAssignments([]); }
  };

  const fetchAllVehicles = async () => {
    if (allVehicles.length > 0) return;
    try {
      const res = await fetch(`${APP_API}/api/vehicles-master?clientId=${CLIENT_ID}`);
      const data = await res.json();
      setAllVehicles(data.vehicles || data || []);
    } catch { setAllVehicles([]); }
  };

  const handleOpenVehicleModal = async (poi) => {
    setVehicleModalPoi(poi);
    setAssignVehicleNo('');
    await Promise.all([fetchPoiAssignments(poi.id), fetchAllVehicles()]);
  };

  const handleAddAssignment = async () => {
    if (!assignVehicleNo || !vehicleModalPoi) return;
    try {
      const res = await fetch(`${APP_API}/api/poi-vehicle-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poi_id: vehicleModalPoi.id, vehicle_no: assignVehicleNo, client_id: CLIENT_ID }),
      });
      if (res.ok) { setAssignVehicleNo(''); fetchPoiAssignments(vehicleModalPoi.id); }
    } catch {}
  };

  const handleDeleteAssignment = async (id) => {
    try {
      const res = await fetch(`${APP_API}/api/poi-vehicle-assignments/${id}`, { method: 'DELETE' });
      if (res.ok) fetchPoiAssignments(vehicleModalPoi.id);
    } catch {}
  };

  // ===== DISCOVERY FUNCTIONS =====

  const handleSync = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const res = await fetch(`${API}/discovered-points/sync-from-pois`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: CLIENT_ID }),
      });
      const d = await res.json();
      setSyncMsg(d.message || `${d.synced} POIs synced`);
      fetchDiscoveryPoints();
    } catch (e) {
      setSyncMsg('Sync failed: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

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
      fd.append('client_id', CLIENT_ID);
      fd.append('geocode', 'true');

      const res = await fetch(`${API}/csv-upload/discover-points`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        setUploadResult(data.summary);
        fetchDiscoveryPoints();
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

  const handlePromote = async (id, point) => {
    // Validation: name and city are required
    if (!point.point_name || !point.point_name.trim()) {
      alert('❌ Point name is required to promote to POI');
      return;
    }
    if (!point.city || !point.city.trim()) {
      alert('❌ City is required to promote to POI');
      return;
    }
    
    if (!window.confirm(`Promote "${point.point_name}" (${point.city}) to POI?`)) return;
    try {
      const res = await fetch(`${API}/discovered-points/${id}/promote-to-poi`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchDiscoveryPoints();
        fetchPOIs(); // Also refresh management list
      } else {
        alert('Error: ' + (data.error || 'Unknown'));
      }
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };

  const handleEditDiscovery = (pt) => {
    setEditingDiscoveryId(pt.id);
    setEditDiscoveryForm({ 
      point_name: pt.point_name || '',
      category: pt.category, 
      city: pt.city || '', 
      pin_code: pt.pin_code || '', 
      latitude: pt.latitude || '', 
      longitude: pt.longitude || '' 
    });
  };

  const handleSaveEditDiscovery = async (id) => {
    const updateData = { ...editDiscoveryForm };
    
    // Validate required fields
    if (!updateData.point_name || !updateData.point_name.trim()) {
      alert('❌ Point name is required');
      return;
    }
    if (!updateData.city || !updateData.city.trim()) {
      alert('❌ City is required');
      return;
    }
    
    try {
      if (updateData.latitude) updateData.latitude = parseFloat(updateData.latitude);
      if (updateData.longitude) updateData.longitude = parseFloat(updateData.longitude);
      const res = await fetch(`${API}/discovered-points/${id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      const data = await res.json();
      if (data.success) { setEditingDiscoveryId(null); fetchDiscoveryPoints(); }
      else alert('Error: ' + (data.error || 'Unknown'));
    } catch (err) { alert('Failed: ' + err.message); }
  };

  // ===== RENDER =====

  // Filter out promoted points unless showAll is enabled
  const displayPoints = showAll ? points : points.filter(p => !p.promoted_to_poi);
  
  const counts = {};
  displayPoints.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
  const totalPoints = displayPoints.length;
  const inputStyle = { padding: '5px 8px', fontSize: 12, borderRadius: 5, border: '1px solid #d1d5db', outline: 'none', width: '100%' };

  return (
    <div style={{ padding: '0 4px', maxWidth: 1500, margin: '0 auto' }}>
      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, borderBottom: '2px solid #e2e8f0' }}>
        <button
          onClick={() => setActiveTab('management')}
          style={{
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            borderBottom: activeTab === 'management' ? '3px solid #4338ca' : 'none',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            color: activeTab === 'management' ? '#4338ca' : '#6b7280',
          }}
        >
          📍 POI Management ({pois.length})
        </button>
        <button
          onClick={() => setActiveTab('discovery')}
          style={{
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            borderBottom: activeTab === 'discovery' ? '3px solid #4338ca' : 'none',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            color: activeTab === 'discovery' ? '#4338ca' : '#6b7280',
          }}
        >
          🔍 Point Discovery ({totalPoints})
        </button>
      </div>

      {/* MANAGEMENT TAB */}
      {activeTab === 'management' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>📍 POI Management</h2>
              <span style={{ fontSize: 11, color: '#6b7280' }}>Manage your Points of Interest</span>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px',
              marginBottom: '15px',
              backgroundColor: error.includes('Success') ? '#f0fdf4' : '#ffebee',
              border: `1px solid ${error.includes('Success') ? '#86efac' : '#f44336'}`,
              borderRadius: '4px',
              color: error.includes('Success') ? '#16a34a' : '#c62828'
            }}>
              {error}
            </div>
          )}

          {/* Action Bar */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '10px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <button
              onClick={() => {
                setEditingId(null);
                setFormData({ poi_name: '', state: '', city: '', address: '', latitude: '', longitude: '', pin_code: '', radius_meters: '1500', type: 'primary' });
                setShowForm(!showForm);
              }}
              style={{
                padding: '6px 14px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
            >
              {showForm ? 'Cancel' : '+ Add New POI'}
            </button>

            <label style={{ cursor: 'pointer' }}>
              <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
              <span style={{
                padding: '6px 14px',
                backgroundColor: '#4CAF50',
                color: 'white',
                borderRadius: '4px',
                display: 'inline-block',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>
                Upload CSV
              </span>
            </label>

            <button
              onClick={handleCSVExport}
              style={{
                padding: '6px 14px',
                backgroundColor: '#FF9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
            >
              Download CSV
            </button>

            <button
              onClick={handleExcelExport}
              style={{
                padding: '6px 14px',
                backgroundColor: '#217346',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
            >
              📊 Download Excel
            </button>
          </div>

          {/* Type Filter (SEPARATE from form!) */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Filter by Type:</span>
            <button
              onClick={() => { setFilterType(''); setFilterState(''); setFilterCity(''); setCurrentPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                background: !filterType ? '#4338ca' : '#f1f5f9',
                color: !filterType ? '#fff' : '#475569',
                border: `1px solid ${!filterType ? '#4338ca' : '#cbd5e1'}`,
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              All ({pois.length})
            </button>
            <button
              onClick={() => { setFilterType('primary'); setFilterState(''); setFilterCity(''); setCurrentPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                background: filterType === 'primary' ? '#1e40af' : '#dbeafe',
                color: filterType === 'primary' ? '#fff' : '#1e40af',
                border: `1px solid #93c5fd`,
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              🏭 Primary ({pois.filter(p => (p.type || 'primary') === 'primary').length})
            </button>
            <button
              onClick={() => { setFilterType('secondary'); setFilterState(''); setFilterCity(''); setCurrentPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                background: filterType === 'secondary' ? '#92400e' : '#fef3c7',
                color: filterType === 'secondary' ? '#fff' : '#92400e',
                border: `1px solid #fcd34d`,
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              🔄 Distributor ({pois.filter(p => (p.type || 'primary') === 'secondary').length})
            </button>
            <button
              onClick={() => { setFilterType('tertiary'); setFilterState(''); setFilterCity(''); setCurrentPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                background: filterType === 'tertiary' ? '#065f46' : '#d1fae5',
                color: filterType === 'tertiary' ? '#fff' : '#065f46',
                border: `1px solid #6ee7b7`,
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              📦 Dealer ({pois.filter(p => (p.type || 'primary') === 'tertiary').length})
            </button>
            <button
              onClick={() => { setFilterType('other'); setFilterState(''); setFilterCity(''); setCurrentPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                background: filterType === 'other' ? '#6b7280' : '#f3f4f6',
                color: filterType === 'other' ? '#fff' : '#6b7280',
                border: `1px solid #d1d5db`,
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              📍 Other ({pois.filter(p => (p.type || 'primary') === 'other').length})
            </button>
            <button
              onClick={() => { setFilterType('pending'); setFilterState(''); setFilterCity(''); setCurrentPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                background: filterType === 'pending' ? '#b45309' : '#fef3c7',
                color: filterType === 'pending' ? '#fff' : '#b45309',
                border: `1px solid #fcd34d`,
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              ⏳ Pending ({pois.filter(p => !p.type || p.type === '').length})
            </button>
            <span style={{ marginLeft: 'auto', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, color: '#475569' }}>
              {filteredPOIs.length} POIs
            </span>
          </div>

          {/* POI Category Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Category:</span>
            <button
              onClick={() => { setFilterPoiCategory(''); setCurrentPage(1); }}
              style={{ padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: !filterPoiCategory ? 700 : 400, background: !filterPoiCategory ? '#4338ca' : '#f1f5f9', color: !filterPoiCategory ? '#fff' : '#475569', border: '1px solid #cbd5e1' }}
            >All</button>
            {Object.entries(POI_CATEGORIES).map(([key, cfg]) => (
              <button key={key} onClick={() => { setFilterPoiCategory(key); setCurrentPage(1); }}
                style={{ padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: filterPoiCategory === key ? 700 : 400, background: filterPoiCategory === key ? cfg.color : cfg.bg, color: filterPoiCategory === key ? '#fff' : cfg.color, border: `1px solid ${cfg.border}` }}
              >
                {cfg.icon} {cfg.label} ({pois.filter(p => (p.poi_category || 'general') === key).length})
              </button>
            ))}
          </div>

          {/* Search & Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search POI name, city, or address..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              style={{ ...inputStyle, flex: 1, minWidth: 200 }}
            />
            <select value={filterCity} onChange={(e) => { setFilterCity(e.target.value); setCurrentPage(1); }} style={{ ...inputStyle, width: 160 }}>
              <option value="">All Cities</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Add/Edit Form */}
          {showForm && (
            <div style={{
              border: '1px solid #ddd',
              padding: '10px 12px',
              marginBottom: '8px',
              borderRadius: '4px',
              backgroundColor: '#f9f9f9'
            }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 13 }}>{editingId ? 'Edit POI' : 'Add New POI'}</h3>
              <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                <input type="text" name="state" placeholder="State" value={formData.state} onChange={handleInputChange} required style={{ padding: '5px 7px', border: '1px solid #ddd', borderRadius: '4px', fontSize: 12 }} />
                <input type="text" name="city" placeholder="City" value={formData.city} onChange={handleInputChange} required style={{ padding: '5px 7px', border: '1px solid #ddd', borderRadius: '4px', fontSize: 12 }} />
                <input type="text" name="poi_name" placeholder="POI Name" value={formData.poi_name} onChange={handleInputChange} required style={{ padding: '5px 7px', border: '1px solid #ddd', borderRadius: '4px', fontSize: 12 }} />
                <input type="text" name="address" placeholder="Address" value={formData.address} onChange={handleInputChange} style={{ padding: '5px 7px', border: '1px solid #ddd', borderRadius: '4px', gridColumn: 'span 2', fontSize: 12 }} />
                <div style={{ position: 'relative' }}>
                  <input type="number" name="latitude" placeholder="Latitude" step="0.0001" value={formData.latitude} onChange={handleCoordinateChange} style={{ padding: '5px 7px', border: '1px solid #ddd', borderRadius: '4px', width: '100%', fontSize: 12 }} />
                  <span style={{ fontSize: 9, color: '#6b7280' }}>Enter &amp; City auto-fills</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <input type="number" name="longitude" placeholder="Longitude" step="0.0001" value={formData.longitude} onChange={handleCoordinateChange} style={{ padding: '5px 7px', border: '1px solid #ddd', borderRadius: '4px', width: '100%', fontSize: 12 }} />
                  <span style={{ fontSize: 9, color: '#6b7280' }}>Enter both to auto-detect</span>
                </div>
                <input type="text" name="pin_code" placeholder="Pin Code" value={formData.pin_code} onChange={handleInputChange} style={{ padding: '5px 7px', border: '1px solid #ddd', borderRadius: '4px', fontSize: 12 }} />
                <input type="number" name="radius_meters" placeholder="Radius (m)" value={formData.radius_meters} onChange={handleInputChange} style={{ padding: '5px 7px', border: '1px solid #ddd', borderRadius: '4px', fontSize: 12 }} />
                <select name="type" value={formData.type} onChange={handleInputChange} style={{ padding: '5px 7px', border: '1px solid #ddd', borderRadius: '4px', fontSize: 12 }}>
                  <option value="primary">🏭 Hub / Factory</option>
                  <option value="secondary">🔄 Distributor</option>
                  <option value="tertiary">📦 Dealer</option>
                  <option value="other">📍 Other</option>
                </select>
                <select name="poi_category" value={formData.poi_category} onChange={handleInputChange} style={{ padding: '5px 7px', border: '1px solid #ddd', borderRadius: '4px', fontSize: 12 }}>
                  <option value="food">🍕 Food & Beverages</option>
                  <option value="consumer">🛒 Consumer Goods</option>
                  <option value="pharma">💊 Pharma</option>
                  <option value="electronics">⚡ Electronics</option>
                  <option value="general">📦 General</option>
                </select>
                <button type="submit" style={{ gridColumn: 'span 2', padding: '7px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}>
                  {editingId ? 'Update POI' : 'Add POI'}
                </button>
              </form>
            </div>
          )}

          {/* Bulk Action Bar */}
          {selectedPOIs.size > 0 && (
            <div style={{
              display: 'flex',
              gap: 12,
              marginBottom: 15,
              padding: 12,
              backgroundColor: '#dbeafe',
              borderRadius: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
              border: '1px solid #93c5fd'
            }}>
              <span style={{ fontWeight: 600, color: '#1e40af' }}>
                {selectedPOIs.size} POI(s) selected
              </span>
              <select value={bulkType} onChange={(e) => setBulkType(e.target.value)} style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #93c5fd',
                fontWeight: 600,
                fontSize: 12
              }}>
                <option value="primary">🏭 Hub / Factory</option>
                <option value="secondary">🔄 Distributor</option>
                <option value="tertiary">📦 Dealer</option>
                <option value="other">📍 Other</option>
              </select>
              <button onClick={handleBulkTypeChange} style={{
                padding: '8px 16px',
                backgroundColor: '#1e40af',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer'
              }}>
                ✓ Change Status
              </button>
              <button onClick={() => setSelectedPOIs(new Set())} style={{
                padding: '8px 16px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer'
              }}>
                ✕ Clear Selection
              </button>
            </div>
          )}

          {/* POIs Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>Loading...</div>
          ) : filteredPOIs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', background: '#f9fafb', borderRadius: 8 }}>
              No POIs found. {filterType ? 'Try removing filters.' : 'Add one to get started.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '8px', width: 40 }}>
                      <input
                        type="checkbox"
                        checked={selectedPOIs.size > 0 && selectedPOIs.size === displayedPOIs.length}
                        onChange={toggleSelectAll}
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                    </th>
                    {['POI Name', 'City', 'State', 'Address', 'Lat/Lng', 'Type', 'Category', 'Vehicles', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '8px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedPOIs.map(poi => (
                    <tr key={poi.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: selectedPOIs.has(poi.id) ? '#e0e7ff' : 'transparent' }}>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedPOIs.has(poi.id)}
                          onChange={() => togglePoiSelection(poi.id)}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                      </td>
                      <td style={{ padding: '8px', fontWeight: 600, color: '#1e293b', maxWidth: 200 }}>{poi.poi_name || poi.name || '-'}</td>
                      <td style={{ padding: '8px', color: '#4b5563' }}>{poi.city || '-'}</td>
                      <td style={{ padding: '8px', color: '#4b5563' }}>{poi.state || '-'}</td>
                      <td style={{ padding: '8px', color: '#4b5563', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{poi.address || '-'}</td>
                      <td style={{ padding: '8px', fontSize: 10 }}>{poi.latitude ? `${poi.latitude.toFixed(3)}, ${poi.longitude.toFixed(3)}` : '-'}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: poi.type === 'secondary' ? '#fef3c7' : poi.type === 'tertiary' ? '#d1fae5' : poi.type === 'other' ? '#f3f4f6' : '#dbeafe', color: poi.type === 'secondary' ? '#92400e' : poi.type === 'tertiary' ? '#065f46' : poi.type === 'other' ? '#6b7280' : '#1e40af' }}>
                          {poi.type === 'secondary' ? '🔄' : poi.type === 'tertiary' ? '📦' : poi.type === 'other' ? '📍' : '🏭'} {poi.type === 'secondary' ? 'Distributor' : poi.type === 'tertiary' ? 'Dealer' : poi.type === 'other' ? 'Other' : 'Hub'}
                        </span>
                      </td>
                      <td style={{ padding: '8px' }}>
                        {(() => { const cat = poi.poi_category || 'general'; const cfg = POI_CATEGORIES[cat] || POI_CATEGORIES.general; return (
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                            {cfg.icon} {cfg.label}
                          </span>
                        ); })()}
                      </td>
                      <td style={{ padding: '8px' }}>
                        <button
                          onClick={() => handleOpenVehicleModal(poi)}
                          style={{ padding: '3px 8px', fontSize: 10, backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          🚛 Vehicles
                        </button>
                      </td>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => handleEdit(poi)} style={{ padding: '4px 8px', marginRight: 4, fontSize: 11, backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: 3, cursor: 'pointer' }}>
                          ✏️ Edit
                        </button>
                        <button onClick={() => handleDelete(poi.id, poi.poi_name || poi.name)} style={{ padding: '4px 8px', fontSize: 11, backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: 3, cursor: 'pointer' }}>
                          🗑️ Delete
                        </button>
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
                <button key={i + 1} onClick={() => setCurrentPage(i + 1)} style={{
                  padding: '6px 10px',
                  borderRadius: 4,
                  border: '1px solid #ddd',
                  background: currentPage === i + 1 ? '#4338ca' : '#fff',
                  color: currentPage === i + 1 ? '#fff' : '#333',
                  cursor: 'pointer',
                  fontWeight: currentPage === i + 1 ? 700 : 400,
                }}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VEHICLE ASSIGNMENT MODAL */}
      {vehicleModalPoi && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, minWidth: 380, maxWidth: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, color: '#1e293b' }}>🚛 Linked Vehicles — {vehicleModalPoi.poi_name}</h3>
              <button onClick={() => setVehicleModalPoi(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            {/* current assignments */}
            {poiAssignments.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', marginBottom: 14 }}>No vehicles linked yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 14 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Vehicle No</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Size</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>Fuel</th>
                    <th style={{ padding: '6px 8px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {poiAssignments.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '5px 8px', fontWeight: 600 }}>{a.vehicle_no}</td>
                      <td style={{ padding: '5px 8px', color: '#6b7280' }}>{a.vehicle_size || '-'}</td>
                      <td style={{ padding: '5px 8px', color: '#6b7280' }}>{a.fuel_type || '-'}</td>
                      <td style={{ padding: '5px 8px' }}>
                        <button onClick={() => handleDeleteAssignment(a.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {/* add vehicle */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={assignVehicleNo}
                onChange={e => setAssignVehicleNo(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
              >
                <option value=''>-- Select Vehicle --</option>
                {allVehicles
                  .filter(v => !poiAssignments.some(a => a.vehicle_no === v.vehicle_no))
                  .map(v => (
                    <option key={v.vehicle_no} value={v.vehicle_no}>
                      {v.vehicle_no} {v.vehicle_size ? `(${v.vehicle_size})` : ''}
                    </option>
                  ))}
              </select>
              <button
                onClick={handleAddAssignment}
                disabled={!assignVehicleNo}
                style={{ padding: '7px 14px', background: assignVehicleNo ? '#0ea5e9' : '#e2e8f0', color: assignVehicleNo ? '#fff' : '#94a3b8', border: 'none', borderRadius: 6, cursor: assignVehicleNo ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 13 }}
              >+ Link</button>
            </div>
          </div>
        </div>
      )}

      {/* DISCOVERY TAB */}
      {activeTab === 'discovery' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>🔍 Point Discovery</h2>
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
              {uploading ? '⏳ Processing...' : '🚀 Upload & Discover Points'}
            </button>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div style={{
              padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13,
              background: uploadResult.error ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${uploadResult.error ? '#fca5a5' : '#86efac'}`,
            }}>
              {uploadResult.error ? (
                <div><b style={{ color: '#dc2626' }}>Error:</b> {uploadResult.error}</div>
              ) : (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span>✅ <b>{uploadResult.unique_points}</b> unique points</span>
                  <span>🌍 <b>{uploadResult.geocoded}</b> geocoded</span>
                </div>
              )}
            </div>
          )}

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

          {/* Category Summary */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setCategoryFilter('')} style={{
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
              background: !categoryFilter ? '#4338ca' : '#f1f5f9', color: !categoryFilter ? '#fff' : '#475569',
              border: `1px solid ${!categoryFilter ? '#4338ca' : '#cbd5e1'}`, fontWeight: 700, fontSize: 12,
            }}>
              All ({totalPoints})
            </button>
            {Object.entries(CATEGORY_STYLES).map(([cat, s]) => (
              <button key={cat} onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)} style={{
                padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                background: categoryFilter === cat ? s.color : s.bg, color: categoryFilter === cat ? '#fff' : s.color,
                border: `1px solid ${s.border}`, fontWeight: 700, fontSize: 11,
              }}>
                {s.icon} {s.label} ({counts[cat] || 0})
              </button>
            ))}
          </div>

          {/* Points Table */}
          {discoveryLoading ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>Loading...</div>
          ) : displayPoints.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', background: '#f9fafb', borderRadius: 8 }}>
              No points discovered yet. Click "🔄 Sync POIs from Master" or upload a CSV to get started.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                    {['Point Name', 'City', 'From#', 'To#', 'Total', 'Category', 'Geo', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayPoints.map(pt => {
                    const cs = CATEGORY_STYLES[pt.category] || CATEGORY_STYLES.OTHER;
                    const isEditing = editingDiscoveryId === pt.id;
                    return (
                      <React.Fragment key={pt.id}>
                        <tr style={{ borderBottom: '1px solid #f1f5f9', background: pt.promoted_to_poi ? '#f0fdf4' : !pt.point_name || !pt.city ? '#fef2f2' : '#fff' }}>
                          <td style={{ padding: '6px 8px', fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', color: !pt.point_name ? '#dc2626' : '#1e293b' }}>
                            {pt.point_name || '⚠️ NO NAME'}
                            {pt.promoted_to_poi ? <span style={{ marginLeft: 4, fontSize: 9, color: '#16a34a' }}> ✓ POI</span> : null}
                          </td>
                          <td style={{ padding: '6px 8px', color: !pt.city ? '#dc2626' : '#4b5563' }}>
                            {pt.city || '⚠️ NO CITY'}
                          </td>
                          <td style={{ padding: '6px 8px', fontWeight: 700, color: '#2563eb' }}>{pt.from_count}</td>
                          <td style={{ padding: '6px 8px', fontWeight: 700, color: '#059669' }}>{pt.to_count}</td>
                          <td style={{ padding: '6px 8px', fontWeight: 800 }}>{pt.total_count}</td>
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
                          <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', display: 'flex', gap: 3 }}>
                            <button 
                              onClick={() => isEditing ? setEditingDiscoveryId(null) : handleEditDiscovery(pt)}
                              style={{
                                padding: '2px 6px', fontSize: 9, borderRadius: 3,
                                background: isEditing ? '#e0e7ff' : '#e0e7ff', color: '#4338ca',
                                border: '1px solid #c7d2fe', cursor: 'pointer', fontWeight: 600,
                              }}
                            >
                              {isEditing ? '✕' : '✏️'}
                            </button>
                            {!pt.promoted_to_poi && pt.geocoded && pt.point_name && pt.city && (
                              <button onClick={() => handlePromote(pt.id, pt)} style={{
                                padding: '2px 6px', fontSize: 9, borderRadius: 3,
                                background: '#d1fae5', color: '#065f46',
                                border: '1px solid #6ee7b7', cursor: 'pointer', fontWeight: 600,
                              }}>
                                → POI
                              </button>
                            )}
                            {!pt.promoted_to_poi && pt.geocoded && (!pt.point_name || !pt.city) && (
                              <button style={{
                                padding: '2px 6px', fontSize: 8, borderRadius: 3,
                                background: '#fef2f2', color: '#dc2626',
                                border: '1px solid #fca5a5', cursor: 'not-allowed', fontWeight: 600,
                              }} title="Edit to add name & city" disabled>
                                ⚠️ Need Name & City
                              </button>
                            )}
                          </td>
                        </tr>
                        {/* Inline Edit Row */}
                        {isEditing && (
                          <tr style={{ background: '#f0f9ff', borderBottom: '2px solid #93c5fd' }}>
                            <td colSpan={8} style={{ padding: 12 }}>
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div>
                                  <label style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>Point Name *</label>
                                  <input
                                    type="text"
                                    value={editDiscoveryForm.point_name || ''}
                                    onChange={(e) => setEditDiscoveryForm({ ...editDiscoveryForm, point_name: e.target.value })}
                                    placeholder="Required"
                                    style={{ padding: '6px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #93c5fd', width: 150 }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>City *</label>
                                  <input
                                    type="text"
                                    value={editDiscoveryForm.city || ''}
                                    onChange={(e) => setEditDiscoveryForm({ ...editDiscoveryForm, city: e.target.value })}
                                    placeholder="Required"
                                    style={{ padding: '6px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #93c5fd', width: 120 }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>Pin Code</label>
                                  <input
                                    type="text"
                                    value={editDiscoveryForm.pin_code || ''}
                                    onChange={(e) => setEditDiscoveryForm({ ...editDiscoveryForm, pin_code: e.target.value })}
                                    placeholder="Optional"
                                    style={{ padding: '6px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #93c5fd', width: 100 }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>Latitude</label>
                                  <input
                                    type="number"
                                    value={editDiscoveryForm.latitude || ''}
                                    onChange={(e) => setEditDiscoveryForm({ ...editDiscoveryForm, latitude: e.target.value })}
                                    placeholder="Optional"
                                    step="0.0001"
                                    style={{ padding: '6px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #93c5fd', width: 100 }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>Longitude</label>
                                  <input
                                    type="number"
                                    value={editDiscoveryForm.longitude || ''}
                                    onChange={(e) => setEditDiscoveryForm({ ...editDiscoveryForm, longitude: e.target.value })}
                                    placeholder="Optional"
                                    step="0.0001"
                                    style={{ padding: '6px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #93c5fd', width: 100 }}
                                  />
                                </div>
                                <button
                                  onClick={() => handleSaveEditDiscovery(pt.id)}
                                  style={{
                                    padding: '6px 12px', fontSize: 11, borderRadius: 4,
                                    background: '#4338ca', color: '#fff',
                                    border: 'none', cursor: 'pointer', fontWeight: 600,
                                  }}
                                >
                                  💾 Save
                                </button>
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
        </div>
      )}
    </div>
  );
}
