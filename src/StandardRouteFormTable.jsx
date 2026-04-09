import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://kd-logistics-production.up.railway.app';

export default function StandardRouteFormTable({ onClose, routeData }) {
  const [formData, setFormData] = useState(routeData || {
    route_no: '',
    route_name: '',
    from_location: '',
    to_location: '',
    route_km: '',
    num_points: '',
    expense_per_km: '',
    _waypoints_json: '[]',
  });

  const [pois, setPois] = useState([]);
  const [unloadingRates, setUnloadingRates] = useState({});
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cities, setCities] = useState([]);
  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [vehicleCategory, setVehicleCategory] = useState('category_1_32ft_34ft');
  const [selectedVehicleNo, setSelectedVehicleNo] = useState('');
  const [kmFetching, setKmFetching] = useState(false);
  const [kmFetchError, setKmFetchError] = useState('');

  // Fetch road distance via OSRM when from/to/waypoints change
  const fetchRoadKm = async (fromName, toName, waypointsJson) => {
    const fromPoi = pois.find(p => p.poi_name === fromName);
    const toPoi = pois.find(p => p.poi_name === toName);
    if (!fromPoi?.latitude || !toPoi?.latitude) return;

    const waypoints = waypointsJson ? JSON.parse(waypointsJson) : [];
    const coords = [
      [fromPoi.longitude, fromPoi.latitude],
      ...waypoints.map(name => {
        const wp = pois.find(p => p.poi_name === name);
        return wp ? [wp.longitude, wp.latitude] : null;
      }).filter(Boolean),
      [toPoi.longitude, toPoi.latitude]
    ];

    const coordStr = coords.map(c => `${c[0]},${c[1]}`).join(';');
    setKmFetching(true);
    setKmFetchError('');
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=false`);
      const data = await res.json();
      if (data.code === 'Ok' && data.routes?.[0]) {
        const km = (data.routes[0].distance / 1000).toFixed(1);
        setFormData(prev => {
          const rate = parseFloat(prev.expense_per_km) || 0;
          const unloadingTotal = calcUnloadingTotal(prev._waypoints_json, vehicleCategory);
          return {
            ...prev,
            route_km: km,
            total_estimated_expense: (parseFloat(km) * rate + unloadingTotal).toFixed(2)
          };
        });
      } else {
        setKmFetchError('Could not get road distance. Enter manually.');
      }
    } catch {
      setKmFetchError('Road distance fetch failed. Enter manually.');
    } finally {
      setKmFetching(false);
    }
  };

  // Auto-fetch road KM when from/to locations are set
  useEffect(() => {
    if (formData.from_location && formData.to_location && pois.length > 0) {
      fetchRoadKm(formData.from_location, formData.to_location, formData._waypoints_json);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.from_location, formData.to_location, pois]);

  // Fetch POIs and unloading rates on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [poisRes, ratesRes, vehiclesRes] = await Promise.all([
          fetch(`${API_BASE}/api/pois?clientId=CLIENT_001`),
          fetch(`${API_BASE}/api/poi-unloading-rates?clientId=CLIENT_001`),
          fetch(`${API_BASE}/api/vehicles-master?clientId=CLIENT_001`)
        ]);
        if (poisRes.ok) {
          const data = await poisRes.json();
          setPois(data);
          const uniqueCities = [...new Set(data.map(poi => poi.city))].sort();
          setCities(uniqueCities);
        }
        if (ratesRes.ok) {
          const ratesData = await ratesRes.json();
          // Build map: poi_id → rate row
          const map = {};
          (ratesData.rates || []).forEach(r => { map[r.poi_id] = r; });
          setUnloadingRates(map);
        }
        if (vehiclesRes.ok) {
          const vData = await vehiclesRes.json();
          setVehicles(Array.isArray(vData) ? vData : []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Get POIs for a specific city
  const getPOIsForCity = (city) => {
    return pois.filter(poi => poi.city === city).sort((a, b) => a.poi_name.localeCompare(b.poi_name));
  };

  // Calculate total unloading charges for selected waypoints
  const calcUnloadingTotal = (waypointsJson, category) => {
    const waypoints = waypointsJson ? JSON.parse(waypointsJson) : [];
    return waypoints.reduce((sum, name) => {
      const poi = pois.find(p => p.poi_name === name);
      if (!poi) return sum;
      const rate = unloadingRates[poi.id];
      return sum + (rate ? (parseFloat(rate[category]) || 0) : 0);
    }, 0);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedData = { ...formData, [name]: value };

    // Recalculate total estimated expense
    const km = parseFloat(name === 'route_km' ? value : updatedData.route_km) || 0;
    const rate = parseFloat(name === 'expense_per_km' ? value : updatedData.expense_per_km) || 0;
    const unloadingTotal = calcUnloadingTotal(updatedData._waypoints_json, vehicleCategory);
    updatedData.total_estimated_expense = (km * rate + unloadingTotal).toFixed(2);

    setFormData(updatedData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.route_no || !formData.route_name || !formData.from_location || !formData.to_location) {
      alert('Please fill in all required fields');
      return;
    }

    if (formData.from_location === formData.to_location) {
      alert('From Location and To Location cannot be the same');
      return;
    }

    // Clean up waypoints data for submission
    const submitData = { ...formData };
    delete submitData._waypoints_json; // Remove temporary waypoints tracking field

    // Call parent handler
    if (onClose && onClose.onSubmit) {
      onClose.onSubmit(submitData);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #cccccc',
    borderRadius: '6px',
    fontSize: '13px',
    backgroundColor: '#ffffff',
    color: '#000000',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  };

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer'
  };

  const labelStyle = {
    fontSize: '13px',
    fontWeight: '600',
    color: '#000000',
    padding: '8px 0'
  };

  return (
    <div style={{
      width: '100%',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden',
      marginTop: '20px'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#0066cc',
        color: '#ffffff',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
          {routeData ? '✏️ Edit Standard Route' : '📍 Add New Standard Route'}
        </h2>
        <button
          onClick={() => onClose && onClose.onClose ? onClose.onClose() : null}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '24px',
            color: '#ffffff'
          }}
        >
          ✕
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} style={{ padding: '20px' }}>

        {/* ROUTE IDENTIFICATION */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', textTransform: 'uppercase' }}>
            ROUTE IDENTIFICATION
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={labelStyle}>
                Route No <span style={{ color: '#cc0000' }}>*</span>
              </label>
              <input
                type="text"
                name="route_no"
                value={formData.route_no}
                onChange={handleChange}
                placeholder="e.g., RT001"
                disabled={!!routeData}
                required
                style={{
                  ...inputStyle,
                  backgroundColor: routeData ? '#f5f5f5' : '#ffffff'
                }}
              />
              <small style={{ fontSize: '11px', color: '#999999', marginTop: '4px', display: 'block' }}>
                Unique route identifier (cannot be changed)
              </small>
            </div>
            <div>
              <label style={labelStyle}>
                Route Name <span style={{ color: '#cc0000' }}>*</span>
              </label>
              <input
                type="text"
                name="route_name"
                value={formData.route_name}
                onChange={handleChange}
                placeholder="e.g., Delhi-Agra Express"
                required
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* ROUTE LOCATIONS */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', textTransform: 'uppercase' }}>
            FROM LOCATION - Choose City Then POI Point
          </h3>
          {loading && <p style={{ fontSize: '12px', color: '#666666', marginBottom: '12px' }}>Loading cities and POIs...</p>}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            {/* From City */}
            <div>
              <label style={labelStyle}>
                City <span style={{ color: '#cc0000' }}>*</span>
              </label>
              <select
                value={fromCity}
                onChange={(e) => {
                  setFromCity(e.target.value);
                  setFormData({ ...formData, from_location: '' });
                }}
                style={selectStyle}
                disabled={loading || cities.length === 0}
              >
                <option value="">-- Select City --</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            {/* From POI Point */}
            <div>
              <label style={labelStyle}>
                POI Point <span style={{ color: '#cc0000' }}>*</span>
              </label>
              <select
                name="from_location"
                value={formData.from_location}
                onChange={handleChange}
                style={selectStyle}
                disabled={!fromCity || loading}
              >
                <option value="">-- Select POI Point --</option>
                {fromCity && getPOIsForCity(fromCity).map(poi => (
                  <option key={poi.id} value={poi.poi_name}>{poi.poi_name}</option>
                ))}
              </select>
              {fromCity && getPOIsForCity(fromCity).length === 0 && (
                <small style={{ fontSize: '11px', color: '#cc6600', marginTop: '4px', display: 'block' }}>
                  No POIs available in this city
                </small>
              )}
            </div>
          </div>

          {/* TO LOCATION SECTION */}
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', textTransform: 'uppercase' }}>
            TO LOCATION - Choose City Then POI Point
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* To City */}
            <div>
              <label style={labelStyle}>
                City <span style={{ color: '#cc0000' }}>*</span>
              </label>
              <select
                value={toCity}
                onChange={(e) => {
                  setToCity(e.target.value);
                  setFormData({ ...formData, to_location: '' });
                }}
                style={selectStyle}
                disabled={loading || cities.length === 0}
              >
                <option value="">-- Select City --</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            {/* To POI Point */}
            <div>
              <label style={labelStyle}>
                POI Point <span style={{ color: '#cc0000' }}>*</span>
              </label>
              <select
                name="to_location"
                value={formData.to_location}
                onChange={handleChange}
                style={selectStyle}
                disabled={!toCity || loading}
              >
                <option value="">-- Select POI Point --</option>
                {toCity && getPOIsForCity(toCity).map(poi => (
                  <option key={poi.id} value={poi.poi_name}>{poi.poi_name}</option>
                ))}
              </select>
              {toCity && getPOIsForCity(toCity).length === 0 && (
                <small style={{ fontSize: '11px', color: '#cc6600', marginTop: '4px', display: 'block' }}>
                  No POIs available in this city
                </small>
              )}
            </div>
          </div>
        </div>

        {/* WAYPOINTS / INTERMEDIATE POINTS */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', textTransform: 'uppercase' }}>
            Waypoints - Select Intermediate POI Points (Optional)
          </h3>
          <p style={{ fontSize: '12px', color: '#666666', marginBottom: '12px' }}>
            Choose POI points that lie along the route between FROM and TO locations. These are stops along the way.
          </p>
          
          {/* Display selected from/to for reference */}
          {formData.from_location && formData.to_location && (
            <div style={{ 
              backgroundColor: '#f0f8ff', 
              border: '1px solid #0066cc', 
              padding: '10px 12px', 
              borderRadius: '4px', 
              marginBottom: '12px',
              fontSize: '12px',
              color: '#000000'
            }}>
              <strong>Route Path:</strong> {formData.from_location} → Waypoints → {formData.to_location}
            </div>
          )}

          {/* Get all available POIs excluding from and to locations */}
          {(() => {
            const availablePoiFields = (formData._waypoints_json ? JSON.parse(formData._waypoints_json) : []);
            const allOtherPois = pois.filter(poi => 
              poi.poi_name !== formData.from_location && 
              poi.poi_name !== formData.to_location
            );

            return (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '12px'
              }}>
                {allOtherPois.length > 0 ? (
                  allOtherPois.map(poi => (
                    <label key={poi.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 10px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cccccc',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontFamily: 'inherit'
                    }}>
                      <input
                        type="checkbox"
                        checked={availablePoiFields.includes(poi.poi_name)}
                        onChange={(e) => {
                          const current = availablePoiFields.filter(p => p !== poi.poi_name);
                          const updated = e.target.checked 
                            ? [...current, poi.poi_name] 
                            : current;
                          const km = parseFloat(formData.route_km) || 0;
                          const rate = parseFloat(formData.expense_per_km) || 0;
                          const updatedJson = JSON.stringify(updated);
                          const unloadingTotal = updated.reduce((sum, name) => {
                            const p = pois.find(x => x.poi_name === name);
                            const r = p ? unloadingRates[p.id] : null;
                            return sum + (r ? (parseFloat(r[vehicleCategory]) || 0) : 0);
                          }, 0);
                          const newFormData = {
                            ...formData,
                            _waypoints_json: updatedJson,
                            num_points: updated.length + 2,  // +2 for from and to
                            total_estimated_expense: (km * rate + unloadingTotal).toFixed(2)
                          };
                          // Re-fetch road KM with new waypoints
                          if (formData.from_location && formData.to_location) {
                            fetchRoadKm(formData.from_location, formData.to_location, updatedJson);
                          }
                          setFormData(newFormData);
                        }}
                        style={{ marginRight: '6px', cursor: 'pointer' }}
                      />
                      <span>{poi.poi_name}</span>
                      <span style={{ fontSize: '10px', color: '#999999', marginLeft: '4px' }}>
                        ({poi.city})
                      </span>
                    </label>
                  ))
                ) : (
                  <p style={{ fontSize: '11px', color: '#cc6600', marginTop: '4px' }}>
                    Select FROM and TO locations to see available waypoints
                  </p>
                )}
              </div>
            );
          })()}

          {(() => {
            const waypoints = formData._waypoints_json ? JSON.parse(formData._waypoints_json) : [];
            if (waypoints.length === 0) return null;
            return (
              <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
                <small style={{ fontSize: '11px', color: '#2e7d32', display: 'block', marginBottom: '6px' }}>
                  <strong>Selected Waypoints:</strong> {waypoints.join(' → ')}
                </small>
                {/* Unloading charge preview per waypoint */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {waypoints.map(name => {
                    const poi = pois.find(p => p.poi_name === name);
                    const rate = poi ? unloadingRates[poi.id] : null;
                    const charge = rate ? (parseFloat(rate[vehicleCategory]) || 0) : 0;
                    return (
                      <span key={name} style={{ fontSize: '11px', background: charge > 0 ? '#dcfce7' : '#f1f5f9', color: charge > 0 ? '#166534' : '#94a3b8', padding: '2px 8px', borderRadius: '12px', border: `1px solid ${charge > 0 ? '#bbf7d0' : '#e2e8f0'}` }}>
                        {name.split(',')[0]}: {charge > 0 ? `₹${charge.toLocaleString('en-IN')}` : 'No charge'}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* ROUTE DETAILS */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', textTransform: 'uppercase' }}>
            ROUTE DETAILS
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={labelStyle}>
                Route KM
                {kmFetching && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#0066cc', fontWeight: 'normal' }}>⏳ Fetching road distance...</span>}
                {!kmFetching && formData.route_km && !kmFetchError && formData.from_location && formData.to_location && (
                  <span style={{ marginLeft: '8px', fontSize: '11px', color: '#166534', fontWeight: 'normal' }}>✅ Auto-filled via road routing</span>
                )}
              </label>
              <input
                type="number"
                name="route_km"
                value={formData.route_km}
                onChange={handleChange}
                placeholder={kmFetching ? 'Calculating...' : 'e.g., 250'}
                step="0.1"
                min="0"
                style={{ ...inputStyle, backgroundColor: kmFetching ? '#f0f8ff' : '#ffffff' }}
              />
              {kmFetchError && (
                <small style={{ fontSize: '11px', color: '#cc0000', marginTop: '4px', display: 'block' }}>⚠ {kmFetchError}</small>
              )}
              {!kmFetchError && !kmFetching && (
                <small style={{ fontSize: '11px', color: '#999999', marginTop: '4px', display: 'block' }}>
                  Road distance auto-fills when FROM &amp; TO are selected. You can edit manually.
                </small>
              )}
            </div>
            <div>
              <label style={labelStyle}>Number of Points</label>
              <input
                type="number"
                name="num_points"
                value={formData.num_points}
                onChange={handleChange}
                placeholder="e.g., 4"
                step="1"
                min="0"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* EXPENSE DETAILS */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', textTransform: 'uppercase' }}>
            EXPENSE CALCULATION
          </h3>

          {/* Vehicle picker — auto-sets category from vehicle_size */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Assign Vehicle (auto-detects size)</label>
            <select
              value={selectedVehicleNo}
              onChange={e => {
                const vno = e.target.value;
                setSelectedVehicleNo(vno);
                const v = vehicles.find(x => x.vehicle_no === vno);
                const size = v?.vehicle_size || '';
                const cat = size || 'category_1_32ft_34ft';
                setVehicleCategory(cat);
                // Recalculate total
                const km = parseFloat(formData.route_km) || 0;
                const rate = parseFloat(formData.expense_per_km) || 0;
                const unloadingTotal = calcUnloadingTotal(formData._waypoints_json, cat);
                setFormData(prev => ({ ...prev, total_estimated_expense: (km * rate + unloadingTotal).toFixed(2) }));
              }}
              style={{ ...selectStyle, maxWidth: '320px' }}
            >
              <option value="">-- Select Vehicle (optional) --</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.vehicle_no}>
                  {v.vehicle_no}{v.vehicle_size ? ` — ${v.vehicle_size === 'category_1_32ft_34ft' ? '32/34 FT' : v.vehicle_size === 'category_2_22ft_24ft' ? '22/24 FT' : 'Small'}` : ' (size not set)'}
                </option>
              ))}
            </select>
            {selectedVehicleNo && !vehicles.find(v => v.vehicle_no === selectedVehicleNo)?.vehicle_size && (
              <small style={{ fontSize: '11px', color: '#b45309', marginTop: '4px', display: 'block' }}>
                ⚠ This vehicle has no size set. Go to Vehicle Management → Edit to set it.
              </small>
            )}
          </div>

          {/* Manual override if no vehicle selected */}
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Vehicle Size / Category {selectedVehicleNo ? '(from vehicle)' : '(select manually)'}</label>
            <select
              value={vehicleCategory}
              onChange={(e) => {
                const cat = e.target.value;
                setVehicleCategory(cat);
                // Recalculate total with new category
                const km = parseFloat(formData.route_km) || 0;
                const rate = parseFloat(formData.expense_per_km) || 0;
                const unloadingTotal = calcUnloadingTotal(formData._waypoints_json, cat);
                setFormData(prev => ({ ...prev, total_estimated_expense: (km * rate + unloadingTotal).toFixed(2) }));
              }}
              style={{ ...selectStyle, maxWidth: '320px' }}
            >
              <option value="category_1_32ft_34ft">32FT / 34FT (Category 1)</option>
              <option value="category_2_22ft_24ft">22FT / 24FT (Category 2)</option>
              <option value="category_3_small">Small Vehicle (Category 3)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Expense Per KM</label>
              <input
                type="number"
                name="expense_per_km"
                value={formData.expense_per_km}
                onChange={handleChange}
                placeholder="e.g., 15"
                step="0.1"
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Unloading Charges (waypoints)</label>
              <div style={{ ...inputStyle, backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', fontWeight: 'bold', color: '#166534' }}>
                ₹ {calcUnloadingTotal(formData._waypoints_json, vehicleCategory).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <small style={{ fontSize: '11px', color: '#999999', marginTop: '4px', display: 'block' }}>
                Sum of unloading charges for selected waypoints
              </small>
            </div>
            <div>
              <label style={labelStyle}>Total Estimated Expense</label>
              <div style={{ ...inputStyle, backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', fontWeight: 'bold', color: '#0066cc' }}>
                ₹ {formData.total_estimated_expense || '0.00'}
              </div>
              <small style={{ fontSize: '11px', color: '#999999', marginTop: '4px', display: 'block' }}>
                (Route KM × Per KM) + Unloading Charges
              </small>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '1px solid #eeeeee' }}>
          <button
            type="button"
            onClick={() => onClose && onClose.onClose ? onClose.onClose() : null}
            style={{
              padding: '10px 24px',
              backgroundColor: '#cccccc',
              color: '#000000',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#bbbbbb'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#cccccc'}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: '10px 24px',
              backgroundColor: '#0066cc',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#0052a3'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#0066cc'}
          >
            {routeData ? '💾 Update Route' : '➕ Create Route'}
          </button>
        </div>
      </form>
    </div>
  );
}
