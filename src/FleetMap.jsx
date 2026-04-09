import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Truck, List } from 'lucide-react';
import { formatDurationSince } from './utils.js';
import { sortVehiclesByTime } from './utils/vehicle.js';
import POIFormModal from './POIFormModal.jsx';
import EditPOIModal from './EditPOIModal.jsx';
import POIListModal from './POIListModal.jsx';
import VehicleFormModal from './VehicleFormModal.jsx';
import VehicleDropdown from './VehicleDropdown.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://kd-logistics-production.up.railway.app';

export default function FleetMap({ vehicles, setTrackModalVehicle }) {
  const [pois, setPOIs] = useState([]);
  const [showPOIModal, setShowPOIModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPOI, setSelectedPOI] = useState(null);
  const [showPOIList, setShowPOIList] = useState(false);
  const [vehicleList, setVehicleList] = useState([]);
  const [selectedVehicleData, setSelectedVehicleData] = useState(null);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  
  // Fetch POIs on mount
  useEffect(() => {
    const fetchPOIs = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/pois`);
        const data = await response.json();
        setPOIs(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to fetch POIs:', err);
      }
    };
    fetchPOIs();
  }, []);
  
  // Fetch vehicles on mount
  useEffect(() => {
    fetchVehicles();
  }, []);
  
  const fetchVehicles = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/vehicles-master?clientId=CLIENT_001`);
      if (response.ok) {
        const data = await response.json();
        setVehicleList(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };
  
  // Open POI modal for editing
  const handleCreatePOI = (vehicle) => {
    setSelectedVehicle(vehicle);
    setShowPOIModal(true);
  };
  
  // Submit POI with edited data
  const handleSubmitPOI = async (formData) => {
    try {
      const response = await fetch(`${API_BASE}/api/pois`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poi_name: formData.poi_name,
          latitude: formData.latitude,
          longitude: formData.longitude,
          city: formData.city,
          address: formData.address,
          radius_meters: formData.radius_meters,
          clientId: 'CLIENT_001'
        })
      });

      const data = await response.json();
      if (data.success) {
        setPOIs(prev => [...prev, {
          id: data.poi_id,
          poi_name: data.poi_name,
          latitude: data.latitude,
          longitude: data.longitude,
          city: data.city
        }]);
        alert(`✅ POI "${data.poi_name}" created!`);
        setShowPOIModal(false);
        setSelectedVehicle(null);
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Failed: ${err.message}`);
    }
  };

  // Delete POI
  const handleDeletePOI = async (poiId, poiName) => {
    if (!window.confirm(`Delete POI "${poiName}"?`)) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/pois/${poiId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      if (data.success) {
        setPOIs(prev => prev.filter(p => p.id !== poiId));
        alert(`✅ POI "${poiName}" deleted!`);
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Failed to delete: ${err.message}`);
    }
  };

  // Open edit POI modal
  const handleEditPOI = (poi) => {
    setSelectedPOI(poi);
    setShowEditModal(true);
  };

  // Submit POI edit
  const handleSubmitEditPOI = async (formData) => {
    try {
      const response = await fetch(`${API_BASE}/api/pois/${selectedPOI.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poi_name: formData.poi_name,
          latitude: formData.latitude,
          longitude: formData.longitude,
          city: formData.city,
          address: formData.address,
          radius_meters: formData.radius_meters
        })
      });

      const data = await response.json();
      if (data.success) {
        // Update POI in state
        setPOIs(prev => prev.map(p => 
          p.id === selectedPOI.id 
            ? {
                ...p,
                poi_name: data.poi_name,
                latitude: data.latitude,
                longitude: data.longitude,
                city: data.city
              }
            : p
        ));
        alert(`✅ POI "${data.poi_name}" updated!`);
        setShowEditModal(false);
        setSelectedPOI(null);
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Failed to update: ${err.message}`)
    }
  };

  // Delete POI from edit modal
  const handleDeleteFromEditModal = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/pois/${selectedPOI.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      if (data.success) {
        setPOIs(prev => prev.filter(p => p.id !== selectedPOI.id));
        alert(`✅ POI "${selectedPOI.poi_name}" deleted!`);
        setShowEditModal(false);
        setSelectedPOI(null);
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Failed to delete: ${err.message}`);
    }
  };
  
  // Vehicle CRUD Handlers
  const handleVehicleSubmit = async (formData) => {
    try {
      const response = await fetch(`${API_BASE}/api/vehicles-master`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: 'CLIENT_001',
          ...formData
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Vehicle created:', result);
        setShowVehicleForm(false);
        fetchVehicles();
        alert('✅ Vehicle created successfully!');
      } else {
        alert('❌ Failed to create vehicle');
      }
    } catch (error) {
      console.error('Error creating vehicle:', error);
      alert('❌ Error creating vehicle');
    }
  };
  
  const handleVehicleSelect = (vehicle) => {
    setSelectedVehicleData(vehicle);
    console.log('Selected vehicle:', vehicle);
  };
  
  const handleVehicleEdit = (vehicle) => {
    setSelectedVehicleData(vehicle);
    setShowVehicleForm(true);
  };
  
  const handleVehicleDelete = async (vehicleId, vehicleNo) => {
    if (window.confirm(`Delete vehicle ${vehicleNo}? This cannot be undone.`)) {
      try {
        const response = await fetch(`${API_BASE}/api/vehicles-master/${vehicleId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          console.log('Vehicle deleted');
          fetchVehicles();
          setSelectedVehicleData(null);
          alert('✅ Vehicle deleted successfully!');
        } else {
          alert('❌ Failed to delete vehicle');
        }
      } catch (error) {
        console.error('Error deleting vehicle:', error);
        alert('❌ Error deleting vehicle');
      }
    }
  };

  // Normalize lat/lng — API returns 'lat'/'lng', some paths return 'latitude'/'longitude'
  const normVehicles = vehicles.map(v => ({
    ...v,
    latitude:  typeof v.latitude  === 'number' ? v.latitude  : (typeof v.lat === 'number' ? v.lat : null),
    longitude: typeof v.longitude === 'number' ? v.longitude : (typeof v.lng === 'number' ? v.lng : null),
  }));

  const validVehicles = sortVehiclesByTime(
    normVehicles.filter(v => v.latitude !== null && v.longitude !== null)
  );

  // Center map on first valid vehicle, or fallback to Delhi
  const defaultPosition =
    validVehicles.length > 0
      ? [validVehicles[0].latitude, validVehicles[0].longitude]
      : [28.6139, 77.2090];

  return (
    <>
      {/* POI Management Bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
        <button
          onClick={() => setShowPOIList(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 16px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          <List size={18} />
          📍 POI List ({pois.length})
        </button>
        <span style={{ fontSize: '12px', color: '#666' }}>Click to manage all POIs</span>
      </div>

      <div style={{ height: 400, width: '100%', margin: '24px 0', borderRadius: 12, overflow: 'hidden' }}>
      <MapContainer center={defaultPosition} zoom={7} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {validVehicles.map((v, idx) => (
          <Marker key={v.vehicle_number || idx} position={[v.latitude, v.longitude]}>
            <Tooltip sticky={true} offset={[0, -15]} direction="top" opacity={1}>
              <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#FF6B35' }}>
                🚩 Click to add
              </span>
            </Tooltip>
            <Popup maxWidth={300} maxHeight={450}>
              <div style={{ fontSize: 12 }}>
                <strong>{v.vehicle_number || 'Vehicle'}</strong>
                <div style={{ fontSize: 11, marginTop: 4 }}>Driver: {v.driver || '-'}</div>
                <div style={{ fontSize: 11, marginTop: 4, color: '#666' }}>
                  Last Update: {v.updated_at || v.gps_time || '-'}
                </div>
                <div style={{ fontSize: 11, marginTop: 4, color: '#d6336c' }}>
                  Stop Time: {v.gps_time ? formatDurationSince(v.gps_time) : '-'}
                </div>
                <div style={{ marginTop: 10, padding: '8px', backgroundColor: '#FFF3CD', borderRadius: '4px', textAlign: 'center' }}>
                  <button
                    onClick={() => handleCreatePOI(v)}
                    style={{
                      backgroundColor: '#FF6B35',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    🚩 Add as POI
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        {pois.map((poi) => (
          <CircleMarker
            key={`poi-${poi.id}`}
            center={[Number(poi.latitude), Number(poi.longitude)]}
            radius={8}
            pathOptions={{ color: '#FF6B6B', fillColor: '#FFE66D', fillOpacity: 0.8, weight: 2 }}
          >
            <Popup maxWidth={280}>
              <div style={{ fontSize: 11, fontWeight: 'bold' }}>
                <div>📍 {poi.poi_name || poi.name}</div>
                {poi.city && <div style={{ fontSize: 10, marginTop: 4, color: '#666' }}>{poi.city}</div>}
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <button
                    onClick={() => handleEditPOI(poi)}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDeletePOI(poi.id, poi.poi_name)}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      backgroundColor: '#FF5252',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="dashboard-grid" style={{gap:'2.5rem'}}>
        {sortVehiclesByTime(vehicles).map((vehicle, index) => (
          <div key={vehicle.vehicle_number || index} className="dashboard-card bg-white bg-opacity-90 border border-slate-200 flex flex-col gap-4 text-slate-900 w-full" style={{minWidth:'0'}}>
            <div className="flex items-center gap-2">
              <Truck className="w-6 h-6 text-indigo-500" />
              <span className="font-bold text-slate-800 text-lg">{vehicle.vehicle_number}</span>
            </div>
            <div className="text-sm text-slate-500">Status: {vehicle.status || '-'}</div>
            <div className="text-sm text-slate-500">Driver: {vehicle.driver || '-'}</div>
            <div className="text-sm text-slate-500">Last Update: {vehicle.updated_at ? new Date(vehicle.updated_at).toLocaleString() : '-'}</div>
            <div className="text-sm text-slate-500">Stop Time: {vehicle.gps_time ? formatDurationSince(vehicle.gps_time) : '-'} </div>
            <div className="text-sm text-slate-500">Latitude: {vehicle.latitude}</div>
            <div className="text-sm text-slate-500">Longitude: {vehicle.longitude}</div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={() => setTrackModalVehicle && setTrackModalVehicle(vehicle)}
                className="flex-1 py-2 bg-indigo-600 text-black text-sm font-bold rounded shadow hover:bg-indigo-700"
              >
                View History
              </button>
              <button
                onClick={() => handleCreatePOI(vehicle)}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#FF6B35',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🚩 Add as POI
              </button>
            </div>
          </div>
        ))}
      </div>
      </div>

      {/* POI Form Modal */}
      {showPOIModal && selectedVehicle && (
        <POIFormModal
          vehicle={selectedVehicle}
          onClose={() => {
            setShowPOIModal(false);
            setSelectedVehicle(null);
          }}
          onSubmit={handleSubmitPOI}
        />
      )}

      {/* Edit POI Modal */}
      {showEditModal && selectedPOI && (
        <EditPOIModal
          poi={selectedPOI}
          onClose={() => {
            setShowEditModal(false);
            setSelectedPOI(null);
          }}
          onSubmit={handleSubmitEditPOI}
          onDelete={handleDeleteFromEditModal}
        />
      )}

      {/* POI List Modal */}
      {showPOIList && (
        <POIListModal
          pois={pois}
          onClose={() => setShowPOIList(false)}
          onEdit={(poi) => {
            setSelectedPOI(poi);
            setShowEditModal(true);
          }}
          onDelete={handleDeletePOI}
          onAdd={(newPoi) => setPOIs(prev => [...prev, newPoi])}
        />
      )}
      
      {/* Vehicle Form Modal */}
      {showVehicleForm && (
        <VehicleFormModal 
          vehicle={selectedVehicleData}
          onSubmit={handleVehicleSubmit}
          onClose={() => {
            setShowVehicleForm(false);
            setSelectedVehicleData(null);
          }}
        />
      )}
    </>
  );
}