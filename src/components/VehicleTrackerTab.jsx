import React, { useState, useEffect } from 'react';
import VehicleTracker from '../vehicletracker.jsx';

const VehicleTrackerTab = ({ vehicles = [] }) => {
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [trackedPath, setTrackedPath] = useState([]);
  const [allVehiclesPaths, setAllVehiclesPaths] = useState({}); // { vehicleId: path }
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState(null);
  
  // Data range for selected vehicle
  const [dataRange, setDataRange] = useState(null); // { min, max, count }

  // Time selection state
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [timeFilter, setTimeFilter] = useState('24h'); // 'all', '3h', '24h', '7d', 'custom'
  
  // Full view state
  const [isFullView, setIsFullView] = useState(false);


  // Compute filtered path — only for preset time filters (3h/24h/7d).
  // Custom Range: filtering is done server-side on Load Track click, so return trackedPath as-is.
  const filteredPath = React.useMemo(() => {
    if (!trackedPath.length) return trackedPath;
    if (timeFilter === 'custom') return trackedPath;  // server handles this
    const now = new Date();
    let minTs = null;
    if (timeFilter === '3h')  minTs = new Date(now.getTime() - 3  * 60 * 60 * 1000);
    if (timeFilter === '24h') minTs = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (timeFilter === '7d')  minTs = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    if (!minTs) return trackedPath;
    return trackedPath.filter(p => new Date(p.gps_time || p.ts) >= minTs);
  }, [trackedPath, timeFilter]);


  // Max distance between consecutive points in current path (for slider range)
  // Helper: convert ISO string → "YYYY-MM-DDTHH:MM" in LOCAL time (for datetime-local input)
  const toLocalDatetimeInput = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  // When user SWITCHES TO custom mode: auto-fill dates from DB range only if dates are empty.
  // (If dates already set from a previous custom session, keep them.)
  useEffect(() => {
    if (timeFilter === 'custom' && dataRange && !startTime && !endTime) {
      setStartTime(toLocalDatetimeInput(dataRange.min));
      setEndTime(toLocalDatetimeInput(dataRange.max));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter]);

  // Re-fetch when time filter changes and a vehicle is already selected
  useEffect(() => {
    if (!selectedVehicle || timeFilter === 'custom') return; // custom needs explicit Load click
    const vehicle = vehicles.find(v =>
      (v.number || v.vehicle_no || v.vehicleNumber || String(v.id)) === String(selectedVehicle)
    );
    if (vehicle) fetchVehicleTrack(vehicle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter]);

  // Handle vehicle selection — auto-load GPS data for the selected vehicle
  const handleVehicleSelect = (vehicleId) => {
    setTrackedPath([]);
    setTrackError(null);
    setDataRange(null);
    setSelectedVehicle(vehicleId);
    if (!vehicleId) return;

    // In Custom Range: KEEP the existing dates so the user can compare vehicles in the same range.
    // In preset modes (24h/7d/3h): clear dates (they'll be re-filled if user switches to custom).
    if (timeFilter !== 'custom') {
      setStartTime('');
      setEndTime('');
    }

    // Fetch data range for info display — NEVER auto-fill dates here (avoids race condition
    // where the async response arrives after the user has already set manual custom dates).
    fetch(`/api/gps-data-range?vehicleId=${vehicleId}&clientId=CLIENT_001`)
      .then(r => r.json())
      .then(d => { if (d.min && d.max) setDataRange(d); })
      .catch(() => {});

    // Fetch track using the CURRENT time range (correct for both presets and custom)
    const vehicle = vehicles.find(v =>
      (v.number || v.vehicle_no || v.vehicleNumber || String(v.id)) === String(vehicleId)
    );
    if (vehicle) {
      setTrackLoading(true);
      const id = vehicle.number || vehicle.vehicle_no || vehicle.vehicleNumber || vehicle.id;
      const timeRange = getTimeRange();
      let url = `/api/vehicle-track?vehicleId=${id}&clientId=CLIENT_001`;
      if (timeRange.start) url += `&startTime=${timeRange.start}`;
      if (timeRange.end)   url += `&endTime=${timeRange.end}`;
      fetch(url)
        .then(r => r.json())
        .then(data => {
          if (!Array.isArray(data) || data.length === 0) {
            setTrackError('No GPS history available for this vehicle');
            return;
          }
          const path = data.map(p => ({
            lat: Number(p.latitude || p.lat),
            lng: Number(p.longitude || p.lng),
            ts: p.gps_time || p.timestamp || new Date().toISOString(),
            gps_time: p.gps_time || p.timestamp || new Date().toISOString(),
            speed: p.speed ?? null,
          }));
          setTrackedPath(path);
          setAllVehiclesPaths(prev => ({ ...prev, [id]: { path, vehicleName: id } }));
          setTrackError(null);
        })
        .catch(e => setTrackError(e.message || 'Failed to load track'))
        .finally(() => setTrackLoading(false));
    }
  };

  // Manual load triggered by button
  const handleLoadTrack = () => {
    if (!selectedVehicle) return;
    const vehicle = vehicles.find(v => 
      (v.number || v.vehicle_no || v.vehicleNumber || String(v.id)) === String(selectedVehicle)
    );
    if (vehicle) fetchVehicleTrack(vehicle);
  };

  // Load all vehicle tracks
  const loadAllVehicleTracks = React.useCallback(async () => {
    if (!vehicles || vehicles.length === 0) return;

    try {
      setTrackLoading(true);
      setTrackError(null);
      
      // Calculate time range
      const now = new Date();
      let start = null;
      let end = now.toISOString();
      
      switch(timeFilter) {
        case '3h':
          start = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
          break;
        case '24h':
          start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
          break;
        case '7d':
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
          break;
        case 'custom':
          if (startTime) start = new Date(startTime).toISOString();
          if (endTime) end = new Date(endTime).toISOString();
          break;
        case 'all':
        default:
          break;
      }
      
      const timeRange = { start, end };
      const paths = {};

      // Load tracks for all vehicles in parallel
      const promises = vehicles.map(async (vehicle) => {
        try {
          const vehicleIdentifier = vehicle.number || vehicle.vehicle_no || vehicle.id;
          let url = `/api/vehicle-track?vehicleId=${vehicleIdentifier}&clientId=CLIENT_001`;
          if (timeRange.start) url += `&startTime=${timeRange.start}`;
          if (timeRange.end) url += `&endTime=${timeRange.end}`;
          
          const response = await fetch(url);
          if (!response.ok) return;

          const data = await response.json();
          if (!Array.isArray(data) || data.length === 0) return;

          // Format path
          const path = data.map(point => ({
            lat: Number(point.latitude || point.lat),
            lng: Number(point.longitude || point.lng),
            ts: point.gps_time || point.timestamp || new Date().toISOString(),
            gps_time: point.gps_time || point.timestamp || new Date().toISOString(),
          }));

          paths[vehicleIdentifier] = { path, vehicleName: vehicle.number || vehicle.id };
        } catch (err) {
          console.error(`Error loading track for ${vehicle.number}:`, err);
        }
      });

      await Promise.all(promises);
      setAllVehiclesPaths(paths);
      setTrackLoading(false);
    } catch (err) {
      console.error('Error loading all vehicle tracks:', err);
      setTrackError(err.message || 'Failed to load vehicle tracks');
      setTrackLoading(false);
    }
  }, [vehicles, timeFilter, startTime, endTime]);

  // Load all vehicle tracks on mount and when time filter changes
  // DISABLED: runs every 30s (vehicles context refresh) making 85 API calls and wiping trackedPath
  // useEffect(() => {
  //   loadAllVehicleTracks();
  // }, [loadAllVehicleTracks, timeFilter]);

  // Get time range based on filter
  const getTimeRange = () => {
    const now = new Date();
    let start = null;
    let end = now.toISOString();
    
    switch(timeFilter) {
      case '3h':
        start = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
        break;
      case '24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'custom':
        if (startTime) start = new Date(startTime).toISOString();
        if (endTime) end = new Date(endTime).toISOString();
        break;
      case 'all':
      default:
        return {};
    }
    
    return { start, end };
  };

  // Fetch GPS history for vehicle
  const fetchVehicleTrack = async (vehicle) => {
    try {
      setTrackLoading(true);
      setTrackError(null);

      const vehicleIdentifier = vehicle.number || vehicle.vehicle_no || vehicle.vehicleNumber || vehicle.id;
      const timeRange = getTimeRange();
      let url = `/api/vehicle-track?vehicleId=${vehicleIdentifier}&clientId=CLIENT_001`;
      if (timeRange.start) url += `&startTime=${timeRange.start}`;
      if (timeRange.end) url += `&endTime=${timeRange.end}`;
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to load track (${response.status})`);
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        setTrackError('No GPS history available for this vehicle');
        setTrackedPath([]);
        return;
      }

      // Ensure proper format with lat/lng
      const path = data.map(point => ({
        lat: Number(point.latitude || point.lat),
        lng: Number(point.longitude || point.lng),
        ts: point.gps_time || point.timestamp || new Date().toISOString(),
        gps_time: point.gps_time || point.timestamp || new Date().toISOString(),
      }));

      setTrackedPath(path);
      // Also update allVehiclesPaths so VehicleTracker can display it
      setAllVehiclesPaths(prev => ({
        ...prev,
        [vehicleIdentifier]: { path, vehicleName: vehicleIdentifier }
      }));
      setTrackError(null);
    } catch (err) {
      console.error('Error fetching vehicle track:', err);
      setTrackError(err.message || 'Failed to load vehicle track');
      setTrackedPath([]);
    } finally {
      setTrackLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: isFullView ? '100vh' : '100%', 
      gap: isFullView ? 0 : 12,
      position: isFullView ? 'fixed' : 'relative',
      top: isFullView ? 0 : 'auto',
      left: isFullView ? 0 : 'auto',
      right: isFullView ? 0 : 'auto',
      bottom: isFullView ? 0 : 'auto',
      zIndex: isFullView ? 9999 : 'auto',
      background: isFullView ? '#ffffff' : 'transparent'
    }}>
      {/* Header with vehicle selector */}
      <div style={{ 
        padding: isFullView ? 20 : 16, 
        background: '#f8fafc', 
        borderRadius: isFullView ? 0 : 8, 
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {/* Title and Fullscreen Button Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
              🚗 Vehicle Tracker
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Select a vehicle and view its GPS history with playback animation
            </p>
          </div>
          
          {/* Fullscreen Button */}
          <button
            onClick={() => setIsFullView(!isFullView)}
            style={{
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 600,
              background: isFullView ? '#ef4444' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 0.2s',
              marginLeft: 12
            }}
            onMouseEnter={(e) => e.target.style.background = isFullView ? '#dc2626' : '#2563eb'}
            onMouseLeave={(e) => e.target.style.background = isFullView ? '#ef4444' : '#3b82f6'}
            title={isFullView ? 'Exit Full View' : 'Expand to Full View'}
          >
            {isFullView ? '✕ Exit' : '⛶ Full View'}
          </button>
        </div>

        {/* Vehicle Dropdown and Time Filter */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          {/* Vehicle Selection */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
              Select Vehicle:
            </label>
            <select
              value={selectedVehicle || ''}
              onChange={(e) => handleVehicleSelect(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '2px solid #cbd5e1',
                borderRadius: 6,
                background: 'white',
                cursor: 'pointer',
                fontWeight: 500,
                color: '#1e293b',
                transition: 'border-color 0.2s'
              }}
            >
              <option value="">-- Choose a vehicle --</option>
              {vehicles.map(v => (
                <option key={v.id || v.number} value={v.number || v.vehicle_no || v.vehicleNumber || v.id}>
                  {v.number || v.vehicleNumber} ({v.driver_name || v.driver || v.driverName || 'No driver'})
                </option>
              ))}
            </select>
          </div>
          
          {/* Time Filter */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
              Time Range:
            </label>
            <select
              value={timeFilter}
              onChange={(e) => {
                const newFilter = e.target.value;
                setTimeFilter(newFilter);
                setTrackedPath([]);
                // Clear custom dates so auto-fill always uses the vehicle's actual data range
                if (newFilter === 'custom') {
                  setStartTime('');
                  setEndTime('');
                }
                if (selectedVehicle) {
                  setAllVehiclesPaths(prev => {
                    const next = { ...prev };
                    delete next[selectedVehicle];
                    return next;
                  });
                }
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '2px solid #cbd5e1',
                borderRadius: 6,
                background: 'white',
                cursor: 'pointer',
                fontWeight: 500,
                color: '#1e293b',
                transition: 'border-color 0.2s'
              }}
            >
              {(() => {
                // Show only time ranges that have actual data in dataRange
                const now = Date.now();
                const maxMs = dataRange ? now - new Date(dataRange.min).getTime() : 0;
                const has3h  = !dataRange || maxMs >= 3  * 3600000;
                const has24h = !dataRange || maxMs >= 24 * 3600000;
                const has7d  = !dataRange || maxMs >= 7  * 24 * 3600000;
                // "All Data" only useful if range > 24h
                const hasAll = !dataRange || maxMs >= 24 * 3600000;
                return (<>
                  {hasAll && <option value="all">All Data</option>}
                  {has3h  && <option value="3h">Last 3 Hours</option>}
                  {has24h && <option value="24h">Last 24 Hours</option>}
                  {has7d  && <option value="7d">Last 7 Days</option>}
                  <option value="custom">Custom Range</option>
                </>);
              })()}
            </select>
          </div>
        </div>
        

        {dataRange && (
          <div style={{ marginTop: 10, padding: '7px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 5, fontSize: 12, color: '#1e40af', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              {filteredPath.length > 0 ? (
                <>
                  📍 <strong>Loaded:</strong>&nbsp;
                  {new Date(filteredPath[0].gps_time || filteredPath[0].ts).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                  &nbsp;
                  {new Date(filteredPath[0].gps_time || filteredPath[0].ts).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true })}
                  &nbsp;→&nbsp;
                  {new Date(filteredPath[filteredPath.length-1].gps_time || filteredPath[filteredPath.length-1].ts).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                  &nbsp;
                  {new Date(filteredPath[filteredPath.length-1].gps_time || filteredPath[filteredPath.length-1].ts).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true })}
                  &nbsp;({filteredPath.length} pts)
                </>
              ) : (
                <>
                  📊 <strong>DB range:</strong>&nbsp;
                  {new Date(dataRange.min).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                  &nbsp;→&nbsp;
                  {new Date(dataRange.max).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                  &nbsp;({dataRange.count} pts total)
                </>
              )}
            </span>
            {(() => {
              const daysSince = Math.floor((Date.now() - new Date(dataRange.max)) / 86400000);
              return daysSince > 2 ? (
                <span style={{ color: '#b45309', fontWeight: 600 }}>⚠️ {daysSince}d stale</span>
              ) : null;
            })()}
          </div>
        )}

        {/* Load Track Button — shown when vehicle selected and not in custom mode */}
        {selectedVehicle && timeFilter !== 'custom' && (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={handleLoadTrack}
              disabled={trackLoading}
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: 13,
                fontWeight: 700,
                background: trackLoading ? '#94a3b8' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: trackLoading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => { if (!trackLoading) e.target.style.background = '#059669'; }}
              onMouseLeave={(e) => { if (!trackLoading) e.target.style.background = '#10b981'; }}
            >
              {trackLoading ? '⏳ Loading...' : '▶ Load Track'}
            </button>
          </div>
        )}

        {/* Custom Date Inputs */}
        {timeFilter === 'custom' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>  
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
                Start Time:
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 14,
                  border: '2px solid #cbd5e1',
                  borderRadius: 6,
                  fontWeight: 500,
                  color: '#1e293b'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>
                End Time:
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 14,
                  border: '2px solid #cbd5e1',
                  borderRadius: 6,
                  fontWeight: 500,
                  color: '#1e293b'
                }}
              />
            </div>
            <button
              onClick={handleLoadTrack}
              disabled={!selectedVehicle || trackLoading}
              style={{
                gridColumn: '1 / -1',
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 600,
                background: (!selectedVehicle || trackLoading) ? '#94a3b8' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: (!selectedVehicle || trackLoading) ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => { if (selectedVehicle && !trackLoading) e.target.style.background = '#059669'; }}
              onMouseLeave={(e) => { if (selectedVehicle && !trackLoading) e.target.style.background = '#10b981'; }}
            >
              {trackLoading ? '⏳ Loading...' : '▶ Load Track'}
            </button>
          </div>
        )}

        {/* Status Messages */}
        {trackLoading && (
          <div style={{ marginTop: 12, padding: 8, background: '#dbeafe', color: '#1e40af', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>
            ⏳ Loading GPS history...
          </div>
        )}
        {trackError && (
          <div style={{ marginTop: 12, padding: 8, background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>
            ⚠️ {trackError}
          </div>
        )}

        {!trackLoading && trackedPath.length === 0 && dataRange && dataRange.count > 0 && (
          <div style={{ marginTop: 12, padding: '8px 10px', background: '#fef3c7', color: '#92400e', borderRadius: 4, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>⚠️ 0 points in selected time range — {dataRange.count} points exist (data is on {new Date(dataRange.min).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}).</span>
            <button
              onClick={() => {
                const s = toLocalDatetimeInput(dataRange.min);
                const e = toLocalDatetimeInput(dataRange.max);
                setStartTime(s);
                setEndTime(e);
                setTimeFilter('custom');
                // Immediately fetch with the correct date range
                if (selectedVehicle) {
                  const vehicle = vehicles.find(v =>
                    (v.number || v.vehicle_no || v.vehicleNumber || String(v.id)) === String(selectedVehicle)
                  );
                  if (vehicle) {
                    const id = vehicle.number || vehicle.vehicle_no || vehicle.vehicleNumber || vehicle.id;
                    setTrackLoading(true);
                    setTrackError(null);
                    fetch(`/api/vehicle-track?vehicleId=${id}&clientId=CLIENT_001&startTime=${new Date(dataRange.min).toISOString()}&endTime=${new Date(dataRange.max).toISOString()}`)
                      .then(r => r.json())
                      .then(data => {
                        if (!Array.isArray(data) || data.length === 0) { setTrackError('No GPS history available for this vehicle'); return; }
                        const path = data.map(p => ({ lat: Number(p.latitude||p.lat), lng: Number(p.longitude||p.lng), ts: p.gps_time||p.timestamp, gps_time: p.gps_time||p.timestamp, speed: p.speed??null }));
                        setTrackedPath(path);
                        setTrackError(null);
                      })
                      .catch(e2 => setTrackError(e2.message||'Failed'))
                      .finally(() => setTrackLoading(false));
                  }
                }
              }}
              style={{ flexShrink: 0, padding: '4px 10px', fontSize: 11, fontWeight: 700, background: '#92400e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Use actual data range
            </button>
          </div>
        )}
        {!trackLoading && trackedPath.length === 1 && (!dataRange || dataRange.count <= 1) && (
          <div style={{ marginTop: 12, padding: 8, background: '#fef9c3', color: '#854d0e', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>
            ⚠️ Only 1 GPS point available — no path to animate. Vehicle may be newly added. More data will appear after daily syncs.
          </div>
        )}
        {!trackLoading && trackedPath.length > 1 && (!dataRange || trackedPath.length >= dataRange.count) && (
          <div style={{ marginTop: 12, padding: 8, background: '#dcfce7', color: '#166534', borderRadius: 4, fontSize: 12, fontWeight: 500 }}>
            ✅ {trackedPath.length} GPS points loaded • Press ▶ Play to animate
            {(() => {
              // Count rest stops using same dynamic threshold as vehicletracker.jsx
              if (trackedPath.length < 2) return null;
              const sorted = [...trackedPath].sort((a, b) => new Date(a.gps_time || a.ts) - new Date(b.gps_time || b.ts));
              const t0 = new Date(sorted[0].gps_time || sorted[0].ts).getTime();
              const tN = new Date(sorted[sorted.length - 1].gps_time || sorted[sorted.length - 1].ts).getTime();
              const spanHrs = (tN - t0) / 3600000;
              const thresholdMs = spanHrs <= 24 ? 3600000 : spanHrs <= 168 ? 3 * 3600000 : 8 * 3600000;
              let restCount = 0;
              for (let i = 0; i < sorted.length - 1; i++) {
                const t1 = new Date(sorted[i].gps_time || sorted[i].ts).getTime();
                const t2 = new Date(sorted[i+1].gps_time || sorted[i+1].ts).getTime();
                if (t2 - t1 >= thresholdMs) restCount++;
              }
              return restCount > 0 ? <span style={{ marginLeft: 10, color: '#7c3aed', fontWeight: 700 }}>• 🅿️ {restCount} rest stop{restCount > 1 ? 's' : ''} detected</span> : null;
            })()}
          </div>
        )}
      </div>

      {/* Map with VehicleTracker component - Always show map with all vehicles */}
      <div style={{ 
        flex: 1, 
        borderRadius: isFullView ? 0 : 8, 
        overflow: 'hidden', 
        border: isFullView ? 'none' : '1px solid #e2e8f0', 
        minHeight: isFullView ? 'calc(100vh - 200px)' : 500,
        height: isFullView ? '100%' : 500
      }}>
        <VehicleTracker
          vehicles={vehicles}
          highlightNumbers={selectedVehicle ? [selectedVehicle] : []}
          allVehiclesPaths={allVehiclesPaths}
          trackingVehicleId={selectedVehicle || null}
          trackedPathDirect={filteredPath}
          trackLoading={trackLoading}
          trackError={trackError}
        />
      </div>

      {/* Info Panel - HIDDEN for professional look */}
      {false && selectedVehicle && trackedPath.length > 0 && !isFullView && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: 12,
          fontSize: 12
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ color: '#64748b', fontWeight: 500, marginBottom: 2 }}>Total Points</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{trackedPath.length}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontWeight: 500, marginBottom: 2 }}>Start Time</div>
              <div style={{ fontSize: 11, color: '#1e293b' }}>
                {trackedPath[0] ? new Date(trackedPath[0].ts || trackedPath[0].gps_time).toLocaleTimeString() : '-'}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                {trackedPath[0] ? new Date(trackedPath[0].ts || trackedPath[0].gps_time).toLocaleDateString() : '-'}
              </div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontWeight: 500, marginBottom: 2 }}>End Time</div>
              <div style={{ fontSize: 11, color: '#1e293b' }}>
                {trackedPath[trackedPath.length - 1] ? new Date(trackedPath[trackedPath.length - 1].ts || trackedPath[trackedPath.length - 1].gps_time).toLocaleTimeString() : '-'}
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                {trackedPath[trackedPath.length - 1] ? new Date(trackedPath[trackedPath.length - 1].ts || trackedPath[trackedPath.length - 1].gps_time).toLocaleDateString() : '-'}
              </div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontWeight: 500, marginBottom: 2 }}>Duration</div>
              <div style={{ fontSize: 11, color: '#1e293b' }}>
                {trackedPath.length > 1 
                  ? `${Math.round((new Date(trackedPath[trackedPath.length - 1].ts || trackedPath[trackedPath.length - 1].gps_time) - new Date(trackedPath[0].ts || trackedPath[0].gps_time)) / 3600000)} hours`
                  : '-'
                }
              </div>
            </div>
          </div>
          
          {/* GPS Points Table */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 8, fontSize: 11 }}>
              📍 GPS Points ({trackedPath.length} total)
            </div>
            <div style={{
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              background: 'white'
            }}>
              <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: 6, textAlign: 'left', fontWeight: 600, color: '#334155' }}>#</th>
                    <th style={{ padding: 6, textAlign: 'left', fontWeight: 600, color: '#334155' }}>Time</th>
                    <th style={{ padding: 6, textAlign: 'left', fontWeight: 600, color: '#334155' }}>Latitude</th>
                    <th style={{ padding: 6, textAlign: 'left', fontWeight: 600, color: '#334155' }}>Longitude</th>
                  </tr>
                </thead>
                <tbody>
                  {trackedPath.map((point, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#f8fafc' : 'white' }}>
                      <td style={{ padding: 6, color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: 6, color: '#1e293b', fontFamily: 'monospace' }}>
                        {new Date(point.ts || point.gps_time).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: 6, color: '#1e293b', fontFamily: 'monospace' }}>
                        {Number(point.lat).toFixed(6)}
                      </td>
                      <td style={{ padding: 6, color: '#1e293b', fontFamily: 'monospace' }}>
                        {Number(point.lng).toFixed(6)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleTrackerTab;
