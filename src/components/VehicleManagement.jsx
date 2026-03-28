/**
 * Vehicle Management Page - React Component
 * Clean, organized vehicle details with grouping & assignments
 */

import React, { useState, useEffect } from 'react';
import './VehicleManagement.css';
import { sortVehiclesByTime } from '../utils/vehicle.js';
import { useVehicleData } from '../context/VehicleDataContext.jsx';
import VehicleSizeImport from './VehicleSizeImport.jsx';
import VehicleTrackerTab from './VehicleTrackerTab.jsx';

const VehicleManagement = () => {
  // Shared vehicle data from context (auto-refreshes every 30s)
  const { stats: sharedStats, refresh: refreshContext } = useVehicleData();

  // Tab Management
  const [activeTab, setActiveTab] = useState('vehicles'); // vehicles | tracker | drivers | munshis
  
  // Vehicle Management
  const [vehicles, setVehicles] = useState([]);
  // Vehicle statuses come from shared context (safe fallback to empty object)
  const vehicleStatuses = sharedStats?.statusMap || {};
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | stopped | stale | offline
  const [searchText,   setSearchText]   = useState('');
  const [groupBy, setGroupBy] = useState('none'); // none | munshi | poi | city
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showFuelRateModal, setShowFuelRateModal] = useState(false);
  const [fuelRateForm, setFuelRateForm] = useState({ fuel_type: '', kmpl: '', fuel_cost_per_liter: '' });
  const [showMunshiModal, setShowMunshiModal] = useState(false);
  const [showPoiModal, setShowPoiModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editVehicleForm, setEditVehicleForm] = useState({});
  const [showSizeImportModal, setShowSizeImportModal] = useState(false);
  const [actionMenu, setActionMenu] = useState(null);
  
  // Pagination & Bulk Operations
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedVehicles, setSelectedVehicles] = useState(new Set());
  const [showBulkMunshiModal, setShowBulkMunshiModal] = useState(false);
  const [showBulkFuelModal, setShowBulkFuelModal] = useState(false);
  const [selectedBulkMunshi, setSelectedBulkMunshi] = useState('');
  const [bulkSizeFilter, setBulkSizeFilter] = useState('');
  const [selectedBulkFuelRate, setSelectedBulkFuelRate] = useState('');
  const [selectedSingleMunshi, setSelectedSingleMunshi] = useState('');
  
  // Drivers & Munshis Management
  const [showDriverEditModal, setShowDriverEditModal] = useState(false);
  const [showMunshiEditModal, setShowMunshiEditModal] = useState(false);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [showAddMunshiModal, setShowAddMunshiModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedMunshi, setSelectedMunshi] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [munshis, setMunshis] = useState([]);
  const [pois, setPois] = useState([]);
  const [fuelTypeRates, setFuelTypeRates] = useState({}); // { Diesel: 89.62, Petrol: 95.41, ... }
  
  // Add Driver/Munshi Form Data
  const [newDriverData, setNewDriverData] = useState({ name: '', license_number: '', phone: '', email: '', status: 'active' });
  const [newMunshiData, setNewMunshiData] = useState({ name: '', area: '', region: '', phone: '', email: '', approval_limit: '', status: 'active' });
  const [editMunshiForm, setEditMunshiForm] = useState({});
  const [munshiPoiSearch, setMunshiPoiSearch] = useState('');
  const [showExtendedPois, setShowExtendedPois] = useState(false);
  
  // Delete Confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteType, setDeleteType] = useState(null);

  // Fetch vehicles on mount
  const fetchVehicles = async () => {
    try {
      const response = await fetch('/api/vehicles-master?clientId=CLIENT_001');
      if (response.ok) {
        const data = await response.json();
        setVehicles(Array.isArray(data) ? data : []);
      } else {
        console.warn('Failed to fetch vehicles:', response.status);
        setVehicles([]);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setVehicles([]);
    }
  };

  // Fetch vehicle statuses — now handled by shared VehicleDataContext
  // (auto-refreshes every 30 seconds, same data as dashboard)

  // Fetch drivers from API
  const fetchDrivers = async () => {
    try {
      const response = await fetch('/api/drivers?clientId=CLIENT_001');
      if (response.ok) {
        const data = await response.json();
        setDrivers(Array.isArray(data) ? data : []);
        console.log(`✅ Loaded ${data.length} drivers`);
      } else {
        console.warn('Failed to fetch drivers:', response.status);
        setDrivers([]);
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
      setDrivers([]);
    }
  };

  // Fetch munshis from API
  const fetchMunshis = async () => {
    try {
      const response = await fetch('/api/munshis?clientId=CLIENT_001');
      if (response.ok) {
        const data = await response.json();
        // Handle both flat array and {munshis:[...]} wrapper
        const list = Array.isArray(data) ? data : (data.munshis || []);
        setMunshis(list);
        console.log(`✅ Loaded ${list.length} munshis`);
      } else {
        console.warn('Failed to fetch munshis:', response.status);
        setMunshis([]);
      }
    } catch (error) {
      console.error('Error fetching munshis:', error);
      setMunshis([]);
    }
  };

  // Fetch master fuel type rates
  const fetchFuelTypeRates = async () => {
    try {
      const res = await fetch('/api/fuel-type-rates?clientId=CLIENT_001');
      if (res.ok) {
        const data = await res.json();
        const map = {};
        data.forEach(r => { map[r.fuel_type] = r.cost_per_liter; });
        setFuelTypeRates(map);
      }
    } catch (e) {
      console.error('Error fetching fuel type rates:', e);
    }
  };

  // Fetch POIs
  const fetchPois = async () => {
    try {
      const response = await fetch('/api/pois');
      if (response.ok) {
        const data = await response.json();
        setPois(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching POIs:', error);
    }
  };

  useEffect(() => {
    fetchVehicles();
    fetchDrivers();
    fetchMunshis();
    fetchPois();
    fetchFuelTypeRates();
    // Also trigger a context refresh so GPS statuses are fresh
    refreshContext();
  }, []);

  // Status configuration
  const statusConfig = {
    'ACTIVE': { icon: '🟢', color: '#16a34a', bgColor: '#e6ffe6', label: 'Active' },
    'SLOW': { icon: '🐢', color: '#0369a1', bgColor: '#e0f2fe', label: 'Slow (Moving)' },
    'STOPPED': { icon: '⏸️', color: '#6b7280', bgColor: '#f3f4f6', label: 'Stopped' },
    'ALERT_MUNSHI': { icon: '🟡', color: '#eab308', bgColor: '#fef9c3', label: 'Munshi Alert (>1d)' },
    'ALERT_ADMIN': { icon: '🔴', color: '#dc2626', bgColor: '#fee2e2', label: 'Admin Alert (>2d)' },
    'OFFLINE': { icon: '⚫', color: '#374151', bgColor: '#e5e7eb', label: 'Offline (No Signal)' }
  };

  // Check if GPS data is critically stale (>6 hours)
  const getGpsStaleWarning = (minutes) => {
    if (!minutes) return null;
    if (minutes > 360) return '⚠️ GPS data is >6 hours old - device may not be transmitting';
    if (minutes > 120) return '⚠️ GPS data is >2 hours old';
    return null;
  };

  // Get status display info - lookup by vehicle_number (tries both key variants)
  const getStatusDisplay = (vehicleNumber) => {
    const status = vehicleStatuses[vehicleNumber] || vehicleStatuses[(vehicleNumber || '').toUpperCase()] || vehicleStatuses[(vehicleNumber || '').toLowerCase()];
    if (!status) return { icon: '⚫', label: 'No GPS', color: '#999999', bgColor: '#f5f5f5', minutesSinceUpdate: 0 };
    const config = statusConfig[status.status] || statusConfig['STALE'];
    const minutes = status.minutes_since_update || 0;
    const warning = getGpsStaleWarning(minutes);
    return {
      ...config,
      minutesSinceUpdate: minutes,
      distance: status.distance_m,
      warning: warning
    };
  };

  // Filter vehicles based on status + search text
  const filteredVehicles = sortVehiclesByTime(
    vehicles.filter(vehicle => {
      if (statusFilter !== 'all') {
        const status = vehicleStatuses[vehicle.vehicle_no];
        if (!status || status.status !== statusFilter) return false;
      }
      if (searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        return (
          (vehicle.vehicle_no   || '').toLowerCase().includes(q) ||
          (vehicle.driver_name  || '').toLowerCase().includes(q) ||
          (vehicle.munshi_name  || '').toLowerCase().includes(q) ||
          (vehicle.fuel_type    || '').toLowerCase().includes(q) ||
          (vehicle.route_from   || '').toLowerCase().includes(q) ||
          (vehicle.route_to     || '').toLowerCase().includes(q)
        );
      }
      return true;
    })
  );

  // Pagination
  const paginatedVehicles = filteredVehicles; // Show all — scrollable table
  const startIndex = 0;

  const toggleVehicleSelection = (vehicleId) => {
    const newSelected = new Set(selectedVehicles);
    if (newSelected.has(vehicleId)) {
      newSelected.delete(vehicleId);
    } else {
      newSelected.add(vehicleId);
    }
    setSelectedVehicles(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedVehicles.size === filteredVehicles.length) {
      setSelectedVehicles(new Set());
    } else {
      setSelectedVehicles(new Set(filteredVehicles.map(v => v.id)));
    }
  };

  const getSelectedVehicleDetails = () => {
    return vehicles.filter(v => selectedVehicles.has(v.id));
  };

  // Group vehicles by selected field
  const groupedVehicles = () => {
    if (groupBy === 'none') return { 'All Vehicles': vehicles };
    
    const grouped = {};
    vehicles.forEach(vehicle => {
      let key = 'Unassigned';
      if (groupBy === 'munshi') {
        key = vehicle.munshi_name || 'No Munshi Assigned';
      } else if (groupBy === 'poi') {
        key = vehicle.primary_poi || 'No POI Assigned';
      } else if (groupBy === 'city') {
        key = vehicle.city || 'Unknown City';
      }
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(vehicle);
    });
    return grouped;
  };

  const handleActionMenu = (vehicleId, event) => {
    event.stopPropagation();
    setActionMenu(actionMenu === vehicleId ? null : vehicleId);
  };

  const openAssignDriver = (vehicle) => {
    setSelectedVehicle(vehicle);
    setShowDriverModal(true);
    setActionMenu(null);
  };

  const openSetFuelRate = (vehicle) => {
    setSelectedVehicle(vehicle);
    setFuelRateForm({
      fuel_type: vehicle.fuel_type || '',
      kmpl: vehicle.kmpl || '',
      fuel_cost_per_liter: vehicle.fuel_cost_per_liter || '',
    });
    setShowFuelRateModal(true);
    setActionMenu(null);
  };

  const openAssignMunshi = (vehicle) => {
    setSelectedVehicle(vehicle);
    setSelectedSingleMunshi('');
    setShowMunshiModal(true);
    setActionMenu(null);
  };

  // Single Vehicle Assign Munshi Handler
  const handleAssignMunshi = async (munshiId, munshiName) => {
    if (!munshiId) {
      alert('Please select a munshi');
      return;
    }

    if (!selectedVehicle) {
      alert('No vehicle selected');
      return;
    }

    try {
      const response = await fetch(`/api/vehicles-master/${selectedVehicle.id}/munshi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          munshi_id: munshiId,
          munshi_name: munshiName,
          client_id: 'CLIENT_001'
        })
      });

      if (response.ok) {
        alert(`✅ Munshi ${munshiName} assigned to ${selectedVehicle.vehicle_no}`);
        setShowMunshiModal(false);
        await fetchVehicles();
      } else {
        alert('Failed to assign munshi');
      }
    } catch (error) {
      console.error('Error assigning munshi:', error);
      alert('Error: ' + error.message);
    }
  };

  // Single Vehicle Deassign Munshi Handler
  const handleDeassignMunshi = async () => {
    if (!selectedVehicle) {
      alert('No vehicle selected');
      return;
    }

    const confirmDeassign = window.confirm(`Remove munshi assignment from ${selectedVehicle.vehicle_no}?`);
    if (!confirmDeassign) return;

    try {
      const response = await fetch(`/api/vehicles-master/${selectedVehicle.id}/munshi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          munshi_id: null,
          munshi_name: null,
          client_id: 'CLIENT_001'
        })
      });

      if (response.ok) {
        alert(`✅ Munshi assignment removed from ${selectedVehicle.vehicle_no}`);
        setShowMunshiModal(false);
        await fetchVehicles();
      } else {
        alert('Failed to deassign munshi');
      }
    } catch (error) {
      console.error('Error deassigning munshi:', error);
      alert('Error: ' + error.message);
    }
  };

  const openAssignPoi = (vehicle) => {
    setSelectedVehicle(vehicle);
    setShowPoiModal(true);
    setActionMenu(null);
  };

  const openEditVehicle = (vehicle) => {
    setSelectedVehicle(vehicle);
    setEditVehicleForm({
      vehicle_no: vehicle.vehicle_no || '',
      driver_name: vehicle.driver_name || '',
      vehicle_size: vehicle.vehicle_size || '',
      fuel_type: vehicle.fuel_type || '',
      kmpl: vehicle.kmpl || '',
      fuel_cost_per_liter: vehicle.fuel_cost_per_liter || '',
      munshi_id: vehicle.munshi_id || '',
      munshi_name: vehicle.munshi_name || '',
      primary_poi_ids: vehicle.primary_poi_ids || '[]',
      notes: vehicle.notes || '',
    });
    setShowEditModal(true);
    setActionMenu(null);
  };

  const handleSaveVehicle = async () => {
    try {
      const res = await fetch(`/api/vehicles-master/${selectedVehicle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedVehicle,
          ...editVehicleForm,
        }),
      });
      if (res.ok) {
        setShowEditModal(false);
        await fetchVehicles();
      } else {
        const err = await res.json();
        alert('Save failed: ' + (err.error || res.status));
      }
    } catch (e) {
      alert('Error saving: ' + e.message);
    }
  };

  // Add New Driver Handler
  const handleAddDriver = async () => {
    if (!newDriverData.name || !newDriverData.license_number) {
      alert('Please fill in driver name and license number');
      return;
    }
    
    try {
      const response = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newDriverData, client_id: 'CLIENT_001' })
      });
      
      if (response.ok) {
        alert('Driver added successfully');
        setShowAddDriverModal(false);
        setNewDriverData({ name: '', license_number: '', phone: '', email: '', status: 'active' });
        await fetchDrivers();
      } else {
        alert('Failed to add driver');
      }
    } catch (error) {
      console.error('Error adding driver:', error);
      alert('Error: ' + error.message);
    }
  };

  // Add New Munshi Handler
  const handleAddMunshi = async () => {
    if (!newMunshiData.name || !newMunshiData.area) {
      alert('Please fill in munshi name and area');
      return;
    }
    
    try {
      const response = await fetch('/api/munshis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newMunshiData, client_id: 'CLIENT_001' })
      });
      
      if (response.ok) {
        alert('Munshi added successfully');
        setShowAddMunshiModal(false);
        setNewMunshiData({ name: '', area: '', region: '', phone: '', email: '', approval_limit: '', status: 'active' });
        await fetchMunshis();
      } else {
        alert('Failed to add munshi');
      }
    } catch (error) {
      console.error('Error adding munshi:', error);
      alert('Error: ' + error.message);
    }
  };

  // Delete Driver Handler
  const handleDeleteDriver = async () => {
    if (!deleteItem) return;
    
    try {
      const response = await fetch(`/api/drivers/${deleteItem.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        alert(`Driver ${deleteItem.name} deleted successfully`);
        setShowDeleteConfirm(false);
        setDeleteItem(null);
        setDeleteType(null);
        await fetchDrivers();
      } else {
        alert('Failed to delete driver');
      }
    } catch (error) {
      console.error('Error deleting driver:', error);
      alert('Error: ' + error.message);
    }
  };

  // Delete Munshi Handler
  const handleDeleteMunshi = async () => {
    if (!deleteItem) return;
    
    try {
      const response = await fetch(`/api/munshis/${deleteItem.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        alert(`Munshi ${deleteItem.name} deleted successfully`);
        setShowDeleteConfirm(false);
        setDeleteItem(null);
        setDeleteType(null);
        await fetchMunshis();
      } else {
        alert('Failed to delete munshi');
      }
    } catch (error) {
      console.error('Error deleting munshi:', error);
      alert('Error: ' + error.message);
    }
  };

  // Open Delete Confirmation
  const confirmDelete = (item, type) => {
    setDeleteItem(item);
    setDeleteType(type);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (deleteType === 'driver') {
      handleDeleteDriver();
    } else if (deleteType === 'munshi') {
      handleDeleteMunshi();
    }
  };

  const handleDelete = async (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!window.confirm(`Delete vehicle ${vehicle?.vehicle_no || vehicleId}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/vehicles-master/${vehicleId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchVehicles();
        // Refresh shared context so dashboard, tracker, and all other pages
        // immediately drop the deleted vehicle (gps_current cleaned on backend)
        refreshContext();
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Delete failed: ' + (err.error || res.status));
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  // ===== BULK OPERATIONS =====
  
  // Bulk Assign Munshi Handler
  const handleBulkAssignMunshi = async () => {
    if (!selectedBulkMunshi) {
      alert('Please select a munshi');
      return;
    }
    
    if (selectedVehicles.size === 0) {
      alert('Please select vehicles');
      return;
    }
    
    // Find the selected munshi details
    const munshi = munshis.find(m => String(m.id) === String(selectedBulkMunshi));
    if (!munshi) {
      alert('Munshi not found');
      return;
    }
    
    try {
      // Update each selected vehicle with the munshi
      const vehicleIds = Array.from(selectedVehicles);
      console.log(`Assigning munshi ${munshi.name} to ${vehicleIds.length} vehicles`);
      
      const updatePromises = vehicleIds.map(vehicleId =>
        fetch(`/api/vehicles-master/${vehicleId}/munshi`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            munshi_id: munshi.id,
            munshi_name: munshi.name,
            client_id: 'CLIENT_001'
          })
        })
      );
      
      const results = await Promise.all(updatePromises);
      const allSuccess = results.every(r => r.ok);
      
      if (allSuccess) {
        alert(`✅ Successfully assigned ${munshi.name} to ${vehicleIds.length} vehicles`);
        setShowBulkMunshiModal(false);
        setSelectedBulkMunshi('');
        setSelectedVehicles(new Set());
        await fetchVehicles();
      } else {
        const failedCount = results.filter(r => !r.ok).length;
        alert(`⚠️ ${failedCount} assignments failed. Check console for details.`);
      }
    } catch (error) {
      console.error('Error bulk assigning munshi:', error);
      alert('Error: ' + error.message);
    }
  };

  // Bulk Set Fuel Rate Handler
  const handleBulkSetFuel = async () => {
    if (!selectedBulkFuelRate) {
      alert('Please enter a fuel rate (KM/L)');
      return;
    }
    
    if (selectedVehicles.size === 0) {
      alert('Please select vehicles');
      return;
    }
    
    try {
      const vehicleIds = Array.from(selectedVehicles);
      console.log(`Setting fuel rate ${selectedBulkFuelRate} for ${vehicleIds.length} vehicles`);
      
      const updatePromises = vehicleIds.map(vehicleId =>
        fetch(`/api/vehicles-master/${vehicleId}/fuel-rate`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kmpl: parseFloat(selectedBulkFuelRate),
            client_id: 'CLIENT_001'
          })
        })
      );
      
      const results = await Promise.all(updatePromises);
      const allSuccess = results.every(r => r.ok);
      
      if (allSuccess) {
        alert(`✅ Successfully set fuel rate ${selectedBulkFuelRate} KM/L for ${vehicleIds.length} vehicles`);
        setShowBulkFuelModal(false);
        setSelectedBulkFuelRate('');
        setSelectedVehicles(new Set());
        await fetchVehicles();
      } else {
        const failedCount = results.filter(r => !r.ok).length;
        alert(`⚠️ ${failedCount} updates failed. Check console for details.`);
      }
    } catch (error) {
      console.error('Error bulk setting fuel:', error);
      alert('Error: ' + error.message);
    }
  };

  // Bulk Deassign Munshi Handler
  const handleBulkDeassignMunshi = async () => {
    if (selectedVehicles.size === 0) {
      alert('Please select vehicles to deassign');
      return;
    }

    const confirmDeassign = window.confirm(`Remove Munshi assignment from ${selectedVehicles.size} vehicles?`);
    if (!confirmDeassign) return;

    try {
      const vehicleIds = Array.from(selectedVehicles);
      console.log(`Deassigning munshi from ${vehicleIds.length} vehicles`);
      
      const updatePromises = vehicleIds.map(vehicleId =>
        fetch(`/api/vehicles-master/${vehicleId}/munshi`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            munshi_id: null,
            munshi_name: null,
            client_id: 'CLIENT_001'
          })
        })
      );
      
      const results = await Promise.all(updatePromises);
      const allSuccess = results.every(r => r.ok);
      
      if (allSuccess) {
        alert(`✅ Successfully removed munshi assignment from ${vehicleIds.length} vehicles`);
        setSelectedVehicles(new Set());
        await fetchVehicles();
      } else {
        const failedCount = results.filter(r => !r.ok).length;
        alert(`⚠️ ${failedCount} deassignments failed. Check console for details.`);
      }
    } catch (error) {
      console.error('Error bulk deassigning munshi:', error);
      alert('Error: ' + error.message);
    }
  };

  return (
    <div className="vehicle-management">
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'vehicles' ? 'active' : ''}`}
          onClick={() => { setActiveTab('vehicles'); setCurrentPage(1); }}
        >
          🚗 Vehicles ({vehicles.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'tracker' ? 'active' : ''}`}
          onClick={() => setActiveTab('tracker')}
        >
          📡 Tracker
        </button>
        <button 
          className={`tab-btn ${activeTab === 'drivers' ? 'active' : ''}`}
          onClick={() => { setActiveTab('drivers'); }}
        >
          👤 Drivers
        </button>
        <button 
          className={`tab-btn ${activeTab === 'munshis' ? 'active' : ''}`}
          onClick={() => { setActiveTab('munshis'); }}
        >
          👨‍💼 Munshis
        </button>
      </div>

      {/* Vehicles Tab */}
      {activeTab === 'vehicles' && (
        <>
        <div className="VM-header">
          <h1>🚗 VEHICLE MANAGEMENT ({vehicles.length} Vehicles)</h1>
          <div className="VM-header-actions">
          <button className="btn-primary">+ Add New Vehicle</button>
          <button className="btn-secondary" onClick={() => setShowSizeImportModal(true)}>📊 Import Size from Excel</button>
          {selectedVehicles.size > 0 && (
            <>
              <button className="btn-warning" onClick={() => setShowBulkMunshiModal(true)}>
                👨‍💼 Bulk Assign Munshi ({selectedVehicles.size})
              </button>
              <button className="btn-danger" onClick={handleBulkDeassignMunshi}>
                ❌ Deassign Munshi ({selectedVehicles.size})
              </button>
              <button className="btn-warning" onClick={() => setShowBulkFuelModal(true)}>
                💰 Bulk Set Fuel ({selectedVehicles.size})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters & Grouping */}
      <div className="VM-filters">
        <div className="filter-group">
          <label>STATUS:</label>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
            <option value="all">All Statuses</option>
            <option value="ACTIVE">🟢 Active</option>
            <option value="SLOW">🐢 Slow (Moving)</option>
            <option value="STOPPED">🟡 Stopped</option>
            <option value="STALE">🟠 Stale (No Signal)</option>
            <option value="OFFLINE">🔴 Offline</option>
          </select>
        </div>

        <div className="filter-group">
          <label>GROUP BY:</label>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="none">None</option>
            <option value="munshi">Munshi</option>
            <option value="poi">POI/City</option>
            <option value="city">City</option>
          </select>
        </div>

        <div className="filter-group">
          <label>FILTER:</label>
          <input
            type="text"
            placeholder="Vehicle / Driver / Munshi / Fuel..."
            className="search-input"
            value={searchText}
            onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div className="filter-group">
          <input type="checkbox" id="activeOnly" />
          <label htmlFor="activeOnly">Active Only</label>
        </div>
      </div>

      {/* Vehicle List by Group */}
      <div className="VM-vehicles">
        {groupBy === 'none' ? (
          <div className="vehicle-group">
            <table className="vehicle-table">
              <thead>
                <tr>
                  <th className="checkbox-col">
                    <input 
                      type="checkbox" 
                      checked={selectedVehicles.size === filteredVehicles.length && filteredVehicles.length > 0}
                      onChange={toggleSelectAll}
                      title="Select all"
                    />
                  </th>
                  <th>S.R NO</th>
                  <th>VEHICLE NO</th>
                  <th>STATUS</th>
                  <th>SIZE</th>
                  <th>DRIVER</th>
                  <th>MUNSHI</th>
                  <th>ROUTE</th>
                  <th>FUEL TYPE</th>
                  <th>FUEL RATE</th>
                  <th>DOCUMENT</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVehicles.map((vehicle, index) => (
                  <tr key={vehicle.id} className="vehicle-row">
                    <td className="checkbox-col">
                      <input 
                        type="checkbox" 
                        checked={selectedVehicles.has(vehicle.id)}
                        onChange={() => toggleVehicleSelection(vehicle.id)}
                      />
                    </td>
                    <td>{index + 1}</td>
                    <td className="vehicle-no">{vehicle.vehicle_no}</td>
                    <td className="status-cell" style={{ backgroundColor: getStatusDisplay(vehicle.vehicle_no).bgColor }}>
                      <span title={`${getStatusDisplay(vehicle.vehicle_no).label} · ${getStatusDisplay(vehicle.vehicle_no).minutesSinceUpdate || 0}m ago${getStatusDisplay(vehicle.vehicle_no).warning ? ' · ' + getStatusDisplay(vehicle.vehicle_no).warning : ''}`}>
                        {getStatusDisplay(vehicle.vehicle_no).warning ? '⚠️ ' : `${getStatusDisplay(vehicle.vehicle_no).icon} `}
                        {getStatusDisplay(vehicle.vehicle_no).label}
                        <small> ({getStatusDisplay(vehicle.vehicle_no).minutesSinceUpdate || 0}m)</small>
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {vehicle.vehicle_size === 'category_1_32ft_34ft' && <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 7px', borderRadius: '10px', fontWeight: 600 }}>32/34 FT</span>}
                      {vehicle.vehicle_size === 'category_2_22ft_24ft' && <span style={{ fontSize: '11px', background: '#fef9c3', color: '#a16207', padding: '2px 7px', borderRadius: '10px', fontWeight: 600 }}>22/24 FT</span>}
                      {vehicle.vehicle_size === 'category_3_small' && <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 7px', borderRadius: '10px', fontWeight: 600 }}>Small</span>}
                      {!vehicle.vehicle_size && <span style={{ fontSize: '11px', color: '#94a3b8', cursor: 'pointer' }} onClick={() => openEditVehicle(vehicle)} title="Click Edit to set size">— set</span>}
                    </td>
                    <td>{vehicle.driver_name || '—'}</td>
                    <td>{vehicle.munshi_name || '—'}</td>
                    <td className="route-info">
                      {vehicle.route_from && vehicle.route_to 
                        ? `${vehicle.route_from} → ${vehicle.route_to} (${vehicle.route_km || '—'} km)`
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {vehicle.fuel_type ? (
                        <span style={{ fontSize: 11, background: (vehicle.fuel_type||'').toUpperCase() === 'DIESEL' ? '#fef3c7' : (vehicle.fuel_type||'').toUpperCase() === 'CNG' ? '#dcfce7' : (vehicle.fuel_type||'').toUpperCase() === 'ELECTRIC' ? '#e0e7ff' : '#fff3e0', color: '#374151', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>
                          {(vehicle.fuel_type||'').toUpperCase() === 'DIESEL' ? '🟤' : (vehicle.fuel_type||'').toUpperCase() === 'PETROL' ? '🟡' : (vehicle.fuel_type||'').toUpperCase() === 'CNG' ? '🟢' : '⚡'} {vehicle.fuel_type}
                        </span>
                      ) : <span style={{ color: '#94a3b8', fontSize: 11, cursor: 'pointer' }} onClick={() => openEditVehicle(vehicle)}>— set</span>}
                    </td>
                    <td className="fuel-rate">
                      {vehicle.kmpl ? `${vehicle.kmpl} KM/L @ ₹${vehicle.fuel_cost_per_liter || (fuelTypeRates[vehicle.fuel_type] || fuelTypeRates[(vehicle.fuel_type||'').toUpperCase()] || '?')}/L` : '—'}
                    </td>
                    <td className="document-col">
                      {vehicle.vehicle_document ? (
                        <a href={`#${vehicle.vehicle_document}`} title={vehicle.vehicle_document}>
                          📄 {vehicle.vehicle_document.substring(0, 15)}...
                        </a>
                      ) : '—'}
                    </td>
                    <td className="actions-cell">
                      <div className="action-buttons">
                        <button 
                          className="btn-action"
                          onClick={(e) => handleActionMenu(vehicle.id, e)}
                          title="More Actions"
                        >
                          ⚙️
                        </button>

                        {/* Action Menu */}
                        {actionMenu === vehicle.id && (
                          <div className="action-menu">
                            <button onClick={() => openAssignDriver(vehicle)}>
                              👤 Assign Driver
                            </button>
                            <button onClick={() => openSetFuelRate(vehicle)}>
                              💰 Set Fuel Rate
                            </button>
                            <button onClick={() => openAssignMunshi(vehicle)}>
                              👨‍💼 Assign Munshi
                            </button>
                            <button onClick={() => openAssignPoi(vehicle)}>
                              🏠 Assign POIs
                            </button>
                            <hr className="menu-divider" />
                            <button onClick={() => openEditVehicle(vehicle)}>
                              ✏️ Edit Details
                            </button>
                            <button className="btn-danger" onClick={() => { setActionMenu(null); handleDelete(vehicle.id); }}>
                              🗑️ Delete
                            </button>
                          </div>
                        )}

                        <button 
                          className="btn-edit"
                          onClick={() => openEditVehicle(vehicle)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ padding: '8px 16px', fontSize: 12, color: '#64748b', background: '#f8fafc', borderTop: '1px solid #e5e7eb' }}>
              Showing {filteredVehicles.length} vehicle{filteredVehicles.length !== 1 ? 's' : ''}
            </div>
          </div>
        ) : (
          Object.entries(groupedVehicles()).map(([groupName, groupVehicles]) => (
            <div key={groupName} className="vehicle-group">
              <div className="group-header">
                <h3>{groupName}</h3>
                <span className="count">({groupVehicles.length})</span>
              </div>

              <table className="vehicle-table">
                <thead>
                  <tr>
                    <th>S.R NO</th>
                    <th>VEHICLE NO</th>
                    <th>SIZE</th>
                    <th>DRIVER</th>
                    <th>MUNSHI</th>
                    <th>FUEL RATE</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {groupVehicles.map((vehicle, index) => (
                    <tr key={vehicle.id} className="vehicle-row">
                      <td>{index + 1}</td>
                      <td className="vehicle-no">{vehicle.vehicle_no}</td>
                      <td style={{ textAlign: 'center' }}>
                        {vehicle.vehicle_size === 'category_1_32ft_34ft' && <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 7px', borderRadius: '10px', fontWeight: 600 }}>32/34 FT</span>}
                        {vehicle.vehicle_size === 'category_2_22ft_24ft' && <span style={{ fontSize: '11px', background: '#fef9c3', color: '#a16207', padding: '2px 7px', borderRadius: '10px', fontWeight: 600 }}>22/24 FT</span>}
                        {vehicle.vehicle_size === 'category_3_small' && <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 7px', borderRadius: '10px', fontWeight: 600 }}>Small</span>}
                        {!vehicle.vehicle_size && <span style={{ fontSize: '11px', color: '#94a3b8', cursor: 'pointer' }} onClick={() => openEditVehicle(vehicle)} title="Click Edit to set size">— set</span>}
                      </td>
                      <td>{vehicle.driver_name || '—'}</td>
                      <td>{vehicle.munshi_name || '—'}</td>
                      <td className="fuel-rate">
                        {vehicle.kmpl ? `${vehicle.kmpl} KM/L\n₹${vehicle.fuel_cost_per_liter}/L` : '—'}
                      </td>
                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button 
                            className="btn-action"
                            onClick={(e) => handleActionMenu(vehicle.id, e)}
                            title="More Actions"
                          >
                            ⚙️
                          </button>

                          {/* Action Menu */}
                          {actionMenu === vehicle.id && (
                            <div className="action-menu">
                              <button onClick={() => openAssignDriver(vehicle)}>
                                👤 Assign Driver
                              </button>
                              <button onClick={() => openSetFuelRate(vehicle)}>
                                💰 Set Fuel Rate
                              </button>
                              <button onClick={() => openAssignMunshi(vehicle)}>
                                👨‍💼 Assign Munshi
                              </button>
                              <button onClick={() => openAssignPoi(vehicle)}>
                                🏠 Assign POIs
                              </button>
                              <hr className="menu-divider" />
                              <button onClick={() => openEditVehicle(vehicle)}>
                                ✏️ Edit Details
                              </button>
                              <button className="btn-danger" onClick={() => { setActionMenu(null); handleDelete(vehicle.id); }}>
                                🗑️ Delete
                              </button>
                            </div>
                          )}

                          <button 
                            className="btn-edit"
                            onClick={() => openEditVehicle(vehicle)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
      </>
      )}

      {/* Tracker Tab */}
      {activeTab === 'tracker' && (
        <div style={{ padding: '8px 0' }}>
          <VehicleTrackerTab vehicles={vehicles.map(v => ({ ...v, id: v.vehicle_no, number: v.vehicle_no }))} />
        </div>
      )}

      {/* Drivers Tab */}
      {activeTab === 'drivers' && (
      <div className="drivers-section">
        <div className="tab-header">
          <h2>👤 Drivers Management</h2>
          <button className="btn-primary" onClick={() => setShowAddDriverModal(true)}>+ Add Driver</button>
        </div>

        <table className="drivers-table">
          <thead>
            <tr>
              <th>S.R NO</th>
              <th>Driver Name</th>
              <th>License Number</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Status</th>
              <th>Vehicles</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver, index) => {
              const vehicleCount = vehicles.filter(v => v.driver_id === driver.id).length;
              return (
                <tr key={driver.id}>
                  <td>{index + 1}</td>
                  <td>{driver.name}</td>
                  <td className="license-col">{driver.license_number || 'Not Provided'}</td>
                  <td>{driver.phone || '—'}</td>
                  <td>{driver.email || '—'}</td>
                  <td><span className={`status-badge ${(driver.status || 'active').toLowerCase() === 'active' ? 'status-active' : 'status-inactive'}`}>{driver.status || 'Active'}</span></td>
                  <td><span className="vehicle-count">{vehicleCount}</span></td>
                  <td>
                    <button className="btn-edit" onClick={() => {
                      setSelectedDriver(driver);
                      setShowDriverEditModal(true);
                    }} title="Edit Driver">✏️</button>
                    <button className="btn-delete" onClick={() => confirmDelete(driver, 'driver')} title="Delete Driver">🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* Munshis Tab */}
      {activeTab === 'munshis' && (
      <div className="munshis-section">
        <div className="tab-header">
          <h2>👨‍💼 Munshis Management</h2>
          <button className="btn-primary" onClick={() => setShowAddMunshiModal(true)}>+ Add Munshi</button>
        </div>

        <table className="munshis-table">
          <thead>
            <tr>
              <th>S.R NO</th>
              <th>Munshi Name</th>
              <th>Area</th>
              <th>Region</th>
              <th>Approval Limit</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Assigned Vehicles</th>
              <th>Primary POIs</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {munshis.map((munshi, index) => {
              const munshiVehicles = vehicles.filter(v => v.munshi_id === munshi.id);
              const vehicleCount = munshiVehicles.length;
              const poiIds = [...new Set(munshiVehicles.flatMap(v => {
                try { return JSON.parse(v.primary_poi_ids || '[]'); } catch { return []; }
              }))];
              const poiNames = poiIds.map(id => pois.find(p => p.id === id)?.poi_name).filter(Boolean);
              return (
                <tr key={munshi.id}>
                  <td>{index + 1}</td>
                  <td>{munshi.name}</td>
                  <td><span className="area-badge">{munshi.area || 'All Areas'}</span></td>
                  <td><span className="region-badge">{munshi.region || '—'}</span></td>
                  <td><span className="approval-limit">₹{munshi.approval_limit?.toLocaleString() || '—'}</span></td>
                  <td>{munshi.phone || '—'}</td>
                  <td>{munshi.email || '—'}</td>
                  <td><span className="assigned-vehicles">{vehicleCount}</span></td>
                  <td>
                    {poiNames.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {poiNames.map(name => (
                          <span key={name} style={{ background: '#dbeafe', color: '#1e40af', borderRadius: 4, padding: '2px 6px', fontSize: 11, whiteSpace: 'nowrap' }}>
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                  </td>
                  <td>
                    <button className="btn-edit" onClick={() => {
                      setSelectedMunshi(munshi);
                      setEditMunshiForm({
                        name: munshi.name || '',
                        area: munshi.area || '',
                        region: munshi.region || '',
                        phone: munshi.phone || '',
                        email: munshi.email || '',
                        approval_limit: munshi.approval_limit || '',
                        primary_poi_ids: (() => { try { return JSON.parse(munshi.primary_poi_ids || '[]'); } catch { return []; } })()
                      });
                      setMunshiPoiSearch('');
                      setShowExtendedPois(false);
                      setShowMunshiEditModal(true);
                    }} title="Edit Munshi">✏️</button>
                    <button className="btn-delete" onClick={() => confirmDelete(munshi, 'munshi')} title="Delete Munshi">🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {/* MODALS */}

      {/* 1. Assign Driver Modal */}
      {showDriverModal && selectedVehicle && (
        <Modal title={`Assign Driver - ${selectedVehicle.vehicle_no}`} onClose={() => setShowDriverModal(false)}>
          <div className="modal-content">
            <label>Select Driver:</label>
            <select className="form-select">
              <option value="">-- Select Driver --</option>
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} ({driver.id})
                </option>
              ))}
            </select>

            <div className="driver-details">
              <h4>Driver Details:</h4>
              <p><strong>License:</strong> DL-001234567890</p>
              <p><strong>Phone:</strong> +91-9876543210</p>
              <p><strong>Email:</strong> driver@example.com</p>
              <p><strong>Status:</strong> ☑ Active</p>
            </div>

            <label className="checkbox">
              <input type="checkbox" />
              Make this driver permanent for this vehicle
            </label>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowDriverModal(false)}>Cancel</button>
              <button className="btn-primary">Assign Driver</button>
            </div>
          </div>
        </Modal>
      )}

      {/* 2. Set Fuel Rate Modal */}
      {showFuelRateModal && selectedVehicle && (
        <Modal title={`Set Fuel Type & Rate - ${selectedVehicle.vehicle_no}`} onClose={() => setShowFuelRateModal(false)}>
          <div className="modal-content">
            <div className="form-group">
              <label>Fuel Type:</label>
              <select
                className="form-select"
                value={fuelRateForm.fuel_type}
                onChange={e => setFuelRateForm(f => ({ ...f, fuel_type: e.target.value }))}
                style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
              >
                <option value="">-- Select Fuel Type --</option>
                <option value="Diesel">🟤 Diesel</option>
                <option value="Petrol">🟡 Petrol</option>
                <option value="CNG">🟢 CNG</option>
                <option value="Electric">⚡ Electric</option>
              </select>
            </div>

            <div className="form-group">
              <label>KM per Liter (Mileage):</label>
              <input
                type="number"
                value={fuelRateForm.kmpl}
                onChange={e => setFuelRateForm(f => ({ ...f, kmpl: e.target.value }))}
                step="0.1"
                placeholder="e.g. 5"
                style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
              />
              <small>How many km the vehicle runs per liter</small>
            </div>

            <div className="form-group">
              <label>Cost per Liter (₹):</label>
              <input
                type="number"
                value={fuelRateForm.fuel_cost_per_liter}
                onChange={e => setFuelRateForm(f => ({ ...f, fuel_cost_per_liter: e.target.value }))}
                step="0.01"
                placeholder="e.g. 90.03"
                style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>

            {fuelRateForm.kmpl && fuelRateForm.fuel_cost_per_liter && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                💡 Cost per km: <strong>₹{(parseFloat(fuelRateForm.fuel_cost_per_liter) / parseFloat(fuelRateForm.kmpl)).toFixed(2)}</strong>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowFuelRateModal(false)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={async () => {
                  if (!fuelRateForm.fuel_type) { alert('Please select a fuel type'); return; }
                  try {
                    const res = await fetch(`/api/vehicles-master/${selectedVehicle.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...selectedVehicle,
                        fuel_type: fuelRateForm.fuel_type,
                        kmpl: parseFloat(fuelRateForm.kmpl) || null,
                        fuel_cost_per_liter: parseFloat(fuelRateForm.fuel_cost_per_liter) || null,
                      }),
                    });
                    if (res.ok) {
                      setShowFuelRateModal(false);
                      await fetchVehicles();
                    } else {
                      const err = await res.json().catch(() => ({}));
                      alert('Save failed: ' + (err.error || res.status));
                    }
                  } catch (e) { alert('Error: ' + e.message); }
                }}
              >
                💾 Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 3. Assign Munshi Modal */}
      {showMunshiModal && selectedVehicle && (
        <Modal title={`Assign Munshi - ${selectedVehicle.vehicle_no}`} onClose={() => setShowMunshiModal(false)}>
          <div className="modal-content">
            <label>Select Munshi (Expense Approval):</label>
            <select 
              className="form-select"
              value={selectedSingleMunshi}
              onChange={(e) => setSelectedSingleMunshi(e.target.value)}
            >
              <option value="">-- Select Munshi --</option>
              {munshis.map(munshi => (
                <option key={munshi.id} value={JSON.stringify({id: munshi.id, name: munshi.name})}>
                  {munshi.name} ({munshi.area || 'N/A'})
                </option>
              ))}
            </select>

            {selectedVehicle.munshi_name && (
              <div className="info-box" style={{marginTop: '15px'}}>
                ℹ️ <strong>Current:</strong> {selectedVehicle.munshi_name}
              </div>
            )}

            <div className="info-box">
              ℹ️ This munshi will approve all expenses for this vehicle
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowMunshiModal(false)}>Cancel</button>
              {selectedVehicle.munshi_name && (
                <button className="btn-danger" onClick={handleDeassignMunshi}>Remove Assignment</button>
              )}
              <button 
                className="btn-primary" 
                onClick={() => {
                  if (selectedSingleMunshi) {
                    const munshiData = JSON.parse(selectedSingleMunshi);
                    handleAssignMunshi(munshiData.id, munshiData.name);
                  }
                }}
              >
                Assign Munshi
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 4. Assign POIs Modal */}
      {showPoiModal && selectedVehicle && (
        <Modal title={`Assign Default POIs - ${selectedVehicle.vehicle_no}`} onClose={() => setShowPoiModal(false)}>
          <div className="modal-content">
            <input type="text" placeholder="Search POIs..." className="search-input" />

            <div className="poi-list">
              {pois.map(poi => (
                <label key={poi.id} className="checkbox-item">
                  <input type="checkbox" defaultChecked={poi.isDefault} />
                  <span>{poi.name} ({poi.id})</span>
                  <span className="rate">Rate: ₹{poi.rate}/point</span>
                </label>
              ))}
            </div>

            <div className="info-box">
              ℹ️ These POIs will be suggested when creating job cards for this vehicle
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowPoiModal(false)}>Cancel</button>
              <button className="btn-primary">Save POI List</button>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. Bulk Assign Munshi Modal */}
      {showBulkMunshiModal && (
        <Modal title="Bulk Assign Munshi by Vehicle Size" onClose={() => { setShowBulkMunshiModal(false); setBulkSizeFilter(''); }}>
          <div className="modal-content">

            {/* Step 1: Pick size to auto-select vehicles */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 8 }}>Step 1 — Select vehicles by size:</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { key: 'category_1_32ft_34ft', label: '🔵 32/34 FT', bg: '#dbeafe', color: '#1d4ed8' },
                  { key: 'category_2_22ft_24ft', label: '🟡 22/24 FT', bg: '#fef9c3', color: '#a16207' },
                  { key: 'category_3_small',     label: '⚪ Small',    bg: '#f1f5f9', color: '#475569' },
                ].map(({ key, label, bg, color }) => {
                  const count = vehicles.filter(v => v.vehicle_size === key).length;
                  const active = bulkSizeFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        const newFilter = active ? '' : key;
                        setBulkSizeFilter(newFilter);
                        const ids = newFilter ? new Set(vehicles.filter(v => v.vehicle_size === newFilter).map(v => v.id)) : new Set();
                        setSelectedVehicles(ids);
                      }}
                      style={{
                        padding: '7px 16px', borderRadius: 20, border: `2px solid ${active ? color : '#e2e8f0'}`,
                        background: active ? bg : '#fff', color: active ? color : '#64748b',
                        fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
                {selectedVehicles.size > 0 && (
                  <button
                    onClick={() => { setSelectedVehicles(new Set()); setBulkSizeFilter(''); }}
                    style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}
                  >
                    ✕ Clear ({selectedVehicles.size})
                  </button>
                )}
              </div>
              {selectedVehicles.size > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                  ✅ {selectedVehicles.size} vehicles selected
                </div>
              )}
            </div>

            {/* Step 2: Pick munshi */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 6 }}>Step 2 — Select Munshi to assign:</label>
              <select
                className="form-select"
                value={selectedBulkMunshi}
                onChange={(e) => setSelectedBulkMunshi(e.target.value)}
              >
                <option value="">-- Select Munshi --</option>
                {munshis.map(munshi => (
                  <option key={munshi.id} value={munshi.id}>
                    {munshi.name} ({munshi.area || 'N/A'}) — Limit: ₹{munshi.approval_limit || '10,000'}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview */}
            {selectedVehicles.size > 0 && (
              <div className="bulk-vehicle-list">
                <h4>Vehicles to assign ({selectedVehicles.size}):</h4>
                <div className="vehicle-tags">
                  {getSelectedVehicleDetails().slice(0, 15).map(v => (
                    <span key={v.id} className="vehicle-tag">
                      {v.vehicle_no}
                    </span>
                  ))}
                  {selectedVehicles.size > 15 && (
                    <span className="vehicle-tag">+{selectedVehicles.size - 15} more</span>
                  )}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => { setShowBulkMunshiModal(false); setBulkSizeFilter(''); }}>Cancel</button>
              <button
                className="btn-primary"
                disabled={!selectedBulkMunshi || selectedVehicles.size === 0}
                onClick={handleBulkAssignMunshi}
              >
                Assign to {selectedVehicles.size} Vehicles
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 7. Bulk Set Fuel Rate Modal */}
      {showBulkFuelModal && (
        <Modal title={`Bulk Set Fuel Rate - ${selectedVehicles.size} Vehicles`} onClose={() => setShowBulkFuelModal(false)}>
          <div className="modal-content">
            <div className="info-box">
              ℹ️ Setting fuel rate for <strong>{selectedVehicles.size} vehicles</strong>
            </div>

            <div className="form-group">
              <label>KM per Liter (Average):</label>
              <input 
                type="number" 
                placeholder="e.g., 8.5" 
                step="0.1" 
                value={selectedBulkFuelRate}
                onChange={(e) => setSelectedBulkFuelRate(e.target.value)}
              />
              <small>Average km the vehicle can run per liter</small>
            </div>

            <div className="bulk-vehicle-list">
              <h4>Selected Vehicles:</h4>
              <div className="vehicle-tags">
                {getSelectedVehicleDetails().slice(0, 10).map(v => (
                  <span key={v.id} className="vehicle-tag">
                    {v.vehicle_no}
                  </span>
                ))}
                {selectedVehicles.size > 10 && (
                  <span className="vehicle-tag">+{selectedVehicles.size - 10} more</span>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowBulkFuelModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleBulkSetFuel}>Update {selectedVehicles.size} Vehicles</button>
            </div>
          </div>
        </Modal>
      )}

      {/* 5. Edit Vehicle Details Modal */}
      {showEditModal && selectedVehicle && (
        <Modal title={`Edit Vehicle - ${selectedVehicle.vehicle_no}`} onClose={() => setShowEditModal(false)}>
          <div className="modal-content">
            <section>
              <h4>📋 BASIC INFORMATION</h4>
              <div className="form-group">
                <label>Vehicle Number:</label>
                <input type="text" value={editVehicleForm.vehicle_no} disabled style={{ background: '#f5f5f5' }} />
              </div>
              <div className="form-group">
                <label>Vehicle Size / Category <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 12 }}>(optional)</span>:</label>
                <select
                  value={editVehicleForm.vehicle_size || ''}
                  onChange={e => setEditVehicleForm(prev => ({ ...prev, vehicle_size: e.target.value }))}
                >
                  <option value="">-- Not set --</option>
                  <option value="category_1_32ft_34ft">32 FT / 34 FT (Large)</option>
                  <option value="category_2_22ft_24ft">22 FT / 24 FT (Medium)</option>
                  <option value="category_3_small">Small Vehicle / Tempo</option>
                </select>
              </div>
              <div className="form-group">
                <label>Driver Name:</label>
                <input
                  type="text"
                  value={editVehicleForm.driver_name}
                  onChange={e => setEditVehicleForm(prev => ({ ...prev, driver_name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Assign Munshi:</label>
                <select
                  value={editVehicleForm.munshi_id || ''}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '__common__') {
                      setEditVehicleForm(prev => ({ ...prev, munshi_id: '', munshi_name: 'Common' }));
                    } else if (val === '') {
                      setEditVehicleForm(prev => ({ ...prev, munshi_id: '', munshi_name: '' }));
                    } else {
                      const m = munshis.find(m => String(m.id) === val);
                      setEditVehicleForm(prev => ({ ...prev, munshi_id: val, munshi_name: m ? m.name : '' }));
                    }
                  }}
                >
                  <option value="">-- Not Assigned --</option>
                  <option value="__common__">🔄 Common (All Munshis)</option>
                  {munshis.map(m => (
                    <option key={m.id} value={String(m.id)}>{m.name}{m.area ? ` (${m.area})` : ''}</option>
                  ))}
                </select>
                {editVehicleForm.munshi_name && (
                  <span style={{ fontSize: 11, color: '#16a34a', marginTop: 3, display: 'block' }}>
                    ✅ Currently: {editVehicleForm.munshi_name}
                  </span>
                )}
              </div>
            </section>

            <section>
              <h4>💰 FUEL CONFIGURATION</h4>
              <div className="form-group">
                <label>Fuel Type <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 12 }}>(optional)</span>:</label>
                <select
                  value={editVehicleForm.fuel_type || ''}
                  onChange={e => {
                    const ft = e.target.value;
                    const masterRate = ft && fuelTypeRates[ft] != null ? fuelTypeRates[ft] : '';
                    setEditVehicleForm(prev => ({
                      ...prev,
                      fuel_type: ft,
                      // Auto-fill cost/L from master rate only if not already manually set
                      fuel_cost_per_liter: prev.fuel_cost_per_liter || masterRate,
                    }));
                  }}
                >
                  <option value="">-- Not set --</option>
                  <option value="Diesel">🟤 Diesel</option>
                  <option value="Petrol">🟡 Petrol</option>
                  <option value="CNG">🟢 CNG</option>
                  <option value="Electric">⚡ Electric</option>
                </select>
                {editVehicleForm.fuel_type && fuelTypeRates[editVehicleForm.fuel_type] != null && (
                  <span style={{ fontSize: 11, color: '#64748b', marginTop: 3, display: 'block' }}>
                    Master rate: ₹{fuelTypeRates[editVehicleForm.fuel_type]}/L — used if cost/L left blank
                  </span>
                )}
              </div>
              <div className="form-group">
                <label>KM / Liter:</label>
                <input
                  type="number" step="0.1" min="0"
                  value={editVehicleForm.kmpl}
                  onChange={e => setEditVehicleForm(prev => ({ ...prev, kmpl: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Fuel Cost / Liter (₹):</label>
                <input
                  type="number" step="0.01" min="0"
                  value={editVehicleForm.fuel_cost_per_liter}
                  onChange={e => setEditVehicleForm(prev => ({ ...prev, fuel_cost_per_liter: e.target.value }))}
                />
              </div>
            </section>

            <section>
              <h4>� PRIMARY POIs <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 12 }}>(optional)</span></h4>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>POIs suggested in Trip Dispatch for this vehicle. Leave empty to allow any POI.</p>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Search POIs..."
                  id="poi-search-edit"
                  style={{ marginBottom: 8, width: '100%', padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, fontSize: 13 }}
                  onChange={e => {
                    const q = e.target.value.toLowerCase();
                    document.querySelectorAll('.poi-edit-item').forEach(el => {
                      el.style.display = el.dataset.name.includes(q) ? '' : 'none';
                    });
                  }}
                />
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 4, padding: '4px 0' }}>
                  {pois.map(poi => {
                    const currentIds = (() => { try { return JSON.parse(editVehicleForm.primary_poi_ids || '[]'); } catch { return []; } })();
                    const checked = currentIds.includes(poi.id);
                    return (
                      <label
                        key={poi.id}
                        className="poi-edit-item"
                        data-name={(poi.poi_name || '').toLowerCase()}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const ids = currentIds.includes(poi.id)
                              ? currentIds.filter(id => id !== poi.id)
                              : [...currentIds, poi.id];
                            setEditVehicleForm(prev => ({ ...prev, primary_poi_ids: JSON.stringify(ids) }));
                          }}
                        />
                        <span style={{ flex: 1 }}>{poi.poi_name}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{poi.city}</span>
                      </label>
                    );
                  })}
                </div>
                {(() => { try { const ids = JSON.parse(editVehicleForm.primary_poi_ids || '[]'); return ids.length > 0 ? <small style={{ color: '#16a34a', fontWeight: 600 }}>✅ {ids.length} POI(s) selected</small> : <small style={{ color: '#94a3b8' }}>None selected (all POIs available in dispatch)</small>; } catch { return null; } })()}
              </div>
            </section>

            <section>
              <h4>�📝 NOTES</h4>
              <div className="form-group">
                <textarea
                  rows={3}
                  value={editVehicleForm.notes}
                  onChange={e => setEditVehicleForm(prev => ({ ...prev, notes: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical' }}
                />
              </div>
            </section>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveVehicle}>Save Changes</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Size Import Modal */}
      {showSizeImportModal && (
        <Modal title="📊 Import Vehicle Sizes from Excel" onClose={() => setShowSizeImportModal(false)}>
          <VehicleSizeImport
            vehicles={vehicles}
            onDone={fetchVehicles}
            onClose={() => setShowSizeImportModal(false)}
          />
        </Modal>
      )}

      {/* 6. Edit Driver Modal */}
      {showDriverEditModal && selectedDriver && (
        <Modal title={`Edit Driver - ${selectedDriver.name}`} onClose={() => setShowDriverEditModal(false)}>
          <div className="modal-content">
            <div className="form-group">
              <label>Driver Name:</label>
              <input type="text" defaultValue={selectedDriver.name} />
            </div>
            <div className="form-group">
              <label>License Number:</label>
              <input type="text" defaultValue={selectedDriver.license_number || ''} placeholder="e.g., DL1LX0851" />
            </div>
            <div className="form-group">
              <label>Phone Number:</label>
              <input type="tel" defaultValue={selectedDriver.phone || ''} placeholder="10-digit phone number" />
            </div>
            <div className="form-group">
              <label>Email Address:</label>
              <input type="email" defaultValue={selectedDriver.email || ''} placeholder="driver@example.com" />
            </div>
            <div className="form-group">
              <label>Status:</label>
              <select defaultValue={selectedDriver.status || 'active'}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowDriverEditModal(false)}>Cancel</button>
              <button className="btn-primary">Save Changes</button>
            </div>
          </div>
        </Modal>
      )}

      {/* 7. Edit Munshi Modal */}
      {showMunshiEditModal && selectedMunshi && (
        <Modal title={`Edit Munshi - ${selectedMunshi.name}`} onClose={() => setShowMunshiEditModal(false)}>
          <div className="modal-content">
            <div className="form-group">
              <label>Munshi Name:</label>
              <input type="text" value={editMunshiForm.name || ''} onChange={e => setEditMunshiForm(p => ({...p, name: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>Area:</label>
              <input type="text" value={editMunshiForm.area || ''} placeholder="e.g., North Delhi" onChange={e => setEditMunshiForm(p => ({...p, area: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>Region:</label>
              <input type="text" value={editMunshiForm.region || ''} placeholder="e.g., NCR" onChange={e => setEditMunshiForm(p => ({...p, region: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>Approval Limit (₹):</label>
              <input type="number" value={editMunshiForm.approval_limit || ''} placeholder="Enter amount in rupees" onChange={e => setEditMunshiForm(p => ({...p, approval_limit: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>Phone Number:</label>
              <input type="tel" value={editMunshiForm.phone || ''} placeholder="10-digit phone number" onChange={e => setEditMunshiForm(p => ({...p, phone: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>Email Address:</label>
              <input type="email" value={editMunshiForm.email || ''} placeholder="munshi@example.com" onChange={e => setEditMunshiForm(p => ({...p, email: e.target.value}))} />
            </div>

            {/* ── POI Assignment — 3 sections ── */}
            <div className="form-group" style={{ borderTop: '2px solid #e2e8f0', paddingTop: 12, marginTop: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1e3a8a', marginBottom: 10, letterSpacing: '0.04em' }}>📍 POI ASSIGNMENT</div>

              {/* A: Primary POIs — per munshi, loading warehouses */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: '#166534' }}>🏭 Primary</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>Loading points for this munshi</span>
                </div>
                <input
                  type="text"
                  placeholder="Search primary POIs…"
                  value={munshiPoiSearch}
                  onChange={e => setMunshiPoiSearch(e.target.value)}
                  style={{ width: '100%', padding: '5px 9px', fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 6 }}
                />
                <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, padding: 4 }}>
                  {pois
                    .filter(p => p.type === 'primary')
                    .filter(p => !munshiPoiSearch || p.poi_name?.toLowerCase().includes(munshiPoiSearch.toLowerCase()) || p.city?.toLowerCase().includes(munshiPoiSearch.toLowerCase()))
                    .map(poi => {
                      const selected = (editMunshiForm.primary_poi_ids || []).includes(poi.id);
                      return (
                        <label key={poi.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 4, cursor: 'pointer', background: selected ? '#dcfce7' : 'transparent', marginBottom: 2, fontSize: 12 }}>
                          <input type="checkbox" checked={selected} onChange={() => {
                            const ids = editMunshiForm.primary_poi_ids || [];
                            setEditMunshiForm(p => ({ ...p, primary_poi_ids: selected ? ids.filter(id => id !== poi.id) : [...ids, poi.id] }));
                          }} />
                          <span style={{ fontWeight: selected ? 700 : 400 }}>{poi.poi_name}</span>
                          {poi.city && <span style={{ color: '#94a3b8', fontSize: 11 }}>({poi.city})</span>}
                        </label>
                      );
                    })}
                  {pois.filter(p => p.type === 'primary').length === 0 && (
                    <div style={{ color: '#94a3b8', fontSize: 12, padding: '6px 4px' }}>No primary POIs found</div>
                  )}
                </div>
                {(editMunshiForm.primary_poi_ids || []).length > 0
                  ? <small style={{ color: '#16a34a', fontWeight: 600 }}>✅ {editMunshiForm.primary_poi_ids.length} selected</small>
                  : <small style={{ color: '#94a3b8' }}>None selected</small>}
              </div>

              {/* B: Distributor POIs — common to ALL munshis, auto-included */}
              <div style={{ marginBottom: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: '#0369a1' }}>🔄 Distributor</span>
                  <span style={{ fontSize: 10, color: '#0369a1', background: '#e0f2fe', borderRadius: 10, padding: '1px 7px', fontWeight: 700 }}>Common to ALL munshis</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {pois.filter(p => p.type === 'secondary').map(p => (
                    <span key={p.id} style={{ background: '#dbeafe', color: '#1e40af', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                      {p.poi_name.split(',')[0].trim()}
                      {p.city && <span style={{ fontWeight: 400, opacity: 0.75, marginLeft: 4 }}>· {p.city}</span>}
                    </span>
                  ))}
                </div>
                <small style={{ color: '#64748b', fontSize: 10, display: 'block', marginTop: 6 }}>Dispatch hubs auto-appear for all munshis — no separate assignment needed.</small>
              </div>

              {/* C: Territory + Other — expandable, common to all */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowExtendedPois(v => !v)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px dashed #94a3b8', background: showExtendedPois ? '#f1f5f9' : '#f8fafc', color: '#475569', fontSize: 12, cursor: 'pointer', textAlign: 'left', fontWeight: 600 }}
                >
                  {showExtendedPois ? '▾ Hide' : '▸ Show'} Territory &amp; Other POIs
                  <span style={{ float: 'right', fontWeight: 400, color: '#94a3b8', fontSize: 11 }}>
                    {pois.filter(p => p.type === 'tertiary' || p.type === 'other').length} POIs
                  </span>
                </button>
                {showExtendedPois && (
                  <div style={{ marginTop: 6, border: '1px solid #e2e8f0', borderRadius: 6, padding: 8, maxHeight: 200, overflowY: 'auto' }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontStyle: 'italic' }}>Territory/Other POIs are common to all munshis — shown for reference.</div>
                    {['tertiary', 'other'].map(typeKey => {
                      const typePois = pois.filter(p => p.type === typeKey);
                      if (!typePois.length) return null;
                      const citiesInType = [...new Set(typePois.map(p => p.city).filter(Boolean))].sort();
                      return (
                        <div key={typeKey} style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 11, color: typeKey === 'tertiary' ? '#7c3aed' : '#c2410c', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {typeKey === 'tertiary' ? '📍 Territory' : '📦 Other'} · {typePois.length} POIs
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                            {citiesInType.map(city => (
                              <span key={city} style={{ background: typeKey === 'tertiary' ? '#f3e8ff' : '#fff7ed', color: typeKey === 'tertiary' ? '#6d28d9' : '#c2410c', borderRadius: 8, padding: '1px 7px', fontSize: 10, fontWeight: 600 }}>{city}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowMunshiEditModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={async () => {
                if (!selectedMunshi?.id || selectedMunshi.id === 'null') {
                  alert('\u274c Cannot save: this munshi has no ID. Please delete and re-add from Dev Admin.');
                  return;
                }
                try {
                  const res = await fetch(`/api/munshis/${selectedMunshi.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editMunshiForm)
                  });
                  if (res.ok) {
                    setShowMunshiEditModal(false);
                    await fetchMunshis();
                  } else {
                    const err = await res.json().catch(() => ({}));
                    alert('❌ Failed to save: ' + (err.error || `HTTP ${res.status}`));
                  }
                } catch (e) {
                  alert('Error: ' + e.message);
                }
              }}>Save Changes</button>
            </div>
          </div>
        </Modal>
      )}

      {/* 8. Add Driver Modal */}
      {showAddDriverModal && (
        <Modal title="Add New Driver" onClose={() => setShowAddDriverModal(false)}>
          <div className="modal-content">
            <div className="form-group">
              <label>Driver Name:</label>
              <input 
                type="text" 
                placeholder="Enter driver name"
                value={newDriverData.name}
                onChange={(e) => setNewDriverData({...newDriverData, name: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>License Number:</label>
              <input 
                type="text" 
                placeholder="e.g., DL1LX0851"
                value={newDriverData.license_number}
                onChange={(e) => setNewDriverData({...newDriverData, license_number: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Phone Number:</label>
              <input 
                type="tel" 
                placeholder="10-digit phone number"
                value={newDriverData.phone}
                onChange={(e) => setNewDriverData({...newDriverData, phone: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Email Address:</label>
              <input 
                type="email" 
                placeholder="driver@example.com"
                value={newDriverData.email}
                onChange={(e) => setNewDriverData({...newDriverData, email: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Status:</label>
              <select 
                value={newDriverData.status}
                onChange={(e) => setNewDriverData({...newDriverData, status: e.target.value})}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowAddDriverModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleAddDriver}>Add Driver</button>
            </div>
          </div>
        </Modal>
      )}

      {/* 9. Add Munshi Modal */}
      {showAddMunshiModal && (
        <Modal title="Add New Munshi" onClose={() => setShowAddMunshiModal(false)}>
          <div className="modal-content">
            <div className="form-group">
              <label>Munshi Name:</label>
              <input 
                type="text" 
                placeholder="Enter munshi name"
                value={newMunshiData.name}
                onChange={(e) => setNewMunshiData({...newMunshiData, name: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Area:</label>
              <input 
                type="text" 
                placeholder="e.g., North Delhi"
                value={newMunshiData.area}
                onChange={(e) => setNewMunshiData({...newMunshiData, area: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Region:</label>
              <input 
                type="text" 
                placeholder="e.g., NCR"
                value={newMunshiData.region}
                onChange={(e) => setNewMunshiData({...newMunshiData, region: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Approval Limit (₹):</label>
              <input 
                type="number" 
                placeholder="Enter amount in rupees"
                value={newMunshiData.approval_limit}
                onChange={(e) => setNewMunshiData({...newMunshiData, approval_limit: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Phone Number:</label>
              <input 
                type="tel" 
                placeholder="10-digit phone number"
                value={newMunshiData.phone}
                onChange={(e) => setNewMunshiData({...newMunshiData, phone: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Email Address:</label>
              <input 
                type="email" 
                placeholder="munshi@example.com"
                value={newMunshiData.email}
                onChange={(e) => setNewMunshiData({...newMunshiData, email: e.target.value})}
              />
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowAddMunshiModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleAddMunshi}>Add Munshi</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal title="Confirm Delete" onClose={() => setShowDeleteConfirm(false)}>
          <div className="modal-body">
            <p>Are you sure you want to delete <strong>{deleteItem?.name}</strong>?</p>
            <p style={{fontSize: '0.9em', color: '#666', marginTop: '10px'}}>
              {deleteType === 'driver' && 'This driver will be removed from the system.'}
              {deleteType === 'munshi' && 'This munshi will be removed from the system.'}
            </p>
          </div>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            <button className="btn-danger" onClick={handleConfirmDelete} style={{backgroundColor: '#dc3545'}}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// Reusable Modal Component
const Modal = ({ title, onClose, children }) => (
  <div className="modal-overlay" onClick={onClose}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
        <h2>{title}</h2>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

export default VehicleManagement;
