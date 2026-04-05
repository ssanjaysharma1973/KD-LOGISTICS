import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import { useVehicleData } from './context/VehicleDataContext.jsx';

// Fix default marker icon paths for bundlers (CRA/Vite)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});


const VehicleTracker = ({ vehicles = [], highlightNumbers = [], allVehiclesPaths = {}, trackingVehicleId = null, trackLoading = false, trackError = null, trackedPathDirect = null }) => {
  // debug: log path source so we can confirm data flows correctly
  console.log('VehicleTracker | vehicles:', vehicles.length, '| tracking:', trackingVehicleId, '| directPath:', trackedPathDirect?.length ?? 0, '| loading:', trackLoading);

  // State for reversed path toggle (only for highlighted vehicle)
  const [isReversed, setIsReversed] = React.useState(false);
  
  // Always use trackedPathDirect (the time-filtered path from parent).
  // Never fall back to allVehiclesPaths — it holds stale unfiltered data.
  const trackedPath = React.useMemo(() => {
    if (Array.isArray(trackedPathDirect)) {
      return trackedPathDirect; // may be [] — that means "no data for this filter"
    }
    return [];
  }, [trackedPathDirect]);
  
  // State for playback animation (only for highlighted vehicle)
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentPointIndex, setCurrentPointIndex] = React.useState(0);
  const [playbackSpeed, setPlaybackSpeed] = React.useState(1); // 1x, 2x, 5x, 10x
  const [isDraggingTimeline, setIsDraggingTimeline] = React.useState(false);
  
  // Reset animation when vehicle selection changes OR when new path data arrives
  React.useEffect(() => {
    setCurrentPointIndex(0);
    setIsPlaying(false);
    setIsReversed(false);
    setAnimPos(null);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  }, [trackingVehicleId]);

  // Also reset index when the path itself is replaced (same vehicle, new time filter)
  const prevPathLenRef = React.useRef(0);
  React.useEffect(() => {
    const newLen = Array.isArray(trackedPath) ? trackedPath.length : 0;
    if (newLen !== prevPathLenRef.current) {
      prevPathLenRef.current = newLen;
      setCurrentPointIndex(0);
      setIsPlaying(false);
      setAnimPos(null);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
  }, [trackedPath]);
  
  // POIs from shared context — no local fetch needed
  const { pois: ctxPois, refresh: refreshCtx } = useVehicleData();
  const [pois, setPOIs] = React.useState([]);

  // Sync context POIs into local state for map rendering
  React.useEffect(() => { setPOIs(ctxPois); }, [ctxPois]);

  // Sort by gps_time ascending, then deduplicate points within 50m of previous
  const displayPath = React.useMemo(() => {
    if (!Array.isArray(trackedPath) || trackedPath.length === 0) return [];
    const sorted = [...trackedPath].sort(
      (a, b) => new Date(a.gps_time || a.ts).getTime() - new Date(b.gps_time || b.ts).getTime()
    );
    return isReversed ? sorted.reverse() : sorted;
  }, [trackedPath, isReversed]);

  // Detect rest stops: gaps significantly longer than normal — threshold scales with data span
  const restStops = React.useMemo(() => {
    if (!displayPath || displayPath.length < 2) return [];
    const t0 = new Date(displayPath[0].gps_time || displayPath[0].ts).getTime();
    const tN = new Date(displayPath[displayPath.length - 1].gps_time || displayPath[displayPath.length - 1].ts).getTime();
    const spanHrs = (tN - t0) / 3600000;
    const thresholdMs = spanHrs <= 24 ? 60 * 60 * 1000 : spanHrs <= 168 ? 3 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000;
    const stops = [];
    for (let i = 0; i < displayPath.length - 1; i++) {
      const t1 = new Date(displayPath[i].gps_time || displayPath[i].ts).getTime();
      const t2 = new Date(displayPath[i + 1].gps_time || displayPath[i + 1].ts).getTime();
      const gapMs = t2 - t1;
      if (gapMs >= thresholdMs) {
        const hrs = Math.floor(gapMs / 3600000);
        const mins = Math.floor((gapMs % 3600000) / 60000);
        stops.push({ lat: displayPath[i].lat, lng: displayPath[i].lng, from: displayPath[i].gps_time || displayPath[i].ts, to: displayPath[i + 1].gps_time || displayPath[i + 1].ts, gapMs, label: hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`, idx: i });
      }
    }
    return stops;
  }, [displayPath]);

  // Smooth interpolated position between GPS points
  const [animPos, setAnimPos] = React.useState(null); // { lat, lng, bearing }
  const animFrameRef = React.useRef(null);

  // Compute compass bearing (degrees) from point A to point B
  const getBearing = (lat1, lng1, lat2, lng2) => {
    const toRad = d => d * Math.PI / 180;
    const dLng = toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  };

  // Animation loop — smoothly interpolates truck position between GPS points using rAF

  React.useEffect(() => {
    if (!isPlaying || displayPath.length === 0) return;

    const current = displayPath[currentPointIndex];
    const next = displayPath[currentPointIndex + 1];

    if (!next) {
      setIsPlaying(false);
      return;
    }

    const t1 = new Date(current.gps_time || current.ts).getTime();
    const t2 = new Date(next.gps_time || next.ts).getTime();
    const realGapMs = Math.abs(t2 - t1) || 60000;
    const holdMs = Math.min(Math.max(realGapMs / (60 * playbackSpeed), 200), 3000);

    const startLat = Number(current.lat), startLng = Number(current.lng);
    const endLat   = Number(next.lat),    endLng   = Number(next.lng);
    const bearing  = getBearing(startLat, startLng, endLat, endLng);
    const startTime = performance.now();

    const step = (now) => {
      const progress = Math.min((now - startTime) / holdMs, 1);
      // ease-in-out for natural deceleration
      const t = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
      setAnimPos({ lat: startLat + (endLat - startLat) * t, lng: startLng + (endLng - startLng) * t, bearing });
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setCurrentPointIndex(prev => prev + 1);
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [isPlaying, currentPointIndex, displayPath, playbackSpeed]);

  // Function to create POI from vehicle marker
  const handleCreatePOI = async (vehicle) => {
    const poiName = prompt('Enter POI name (e.g., WAREHOUSE-01):', vehicle.number || '');
    if (!poiName) return;
    
    try {
      const response = await fetch('/api/pois', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poi_name: poiName,
          latitude: Number(vehicle.lat),
          longitude: Number(vehicle.lng),
          city: vehicle.city || 'Unknown',
          address: vehicle.address || `Lat: ${vehicle.lat}, Lng: ${vehicle.lng}`,
          radius_meters: 1500,
          clientId: 'CLIENT_001'
        })
      });

      const data = await response.json();
      if (data.success) {
        // Refresh context so POI appears everywhere
        await refreshCtx();
        alert(`✅ POI "${data.poi_name}" created!`);
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Failed: ${err.message}`);
    }
  };

  // POIs are synced from context above — no separate fetch needed

  // Track if user has manually interacted with map
  const [, setUserInteracting] = React.useState(false);
  const userInteractingRef = React.useRef(false);

  // choose center from first vehicle if available (normalize lat/lng vs latitude/longitude)
  const first = vehicles.find(v => v && (v.lat != null || v.latitude != null) && (v.lng != null || v.longitude != null));
  const center = first ? [Number(first.lat ?? first.latitude), Number(first.lng ?? first.longitude)] : [28.4595, 77.0266];
  const zoom = first ? 10 : 5;

  function FitBounds({ vehicles, trackedPath, trackingVehicleId }) {
    const map = useMap();
    const initialFitRef = React.useRef(false);
    const lastTrackingIdRef = React.useRef(null);
    
    React.useEffect(() => {
      // Only fit bounds on initial load or when vehicle selection CHANGES
      // Don't fit if user is manually interacting OR playing animation
      if (userInteractingRef.current || isPlaying) return;

      // Detect vehicle selection CHANGE (not just update of same vehicle)
      const vehicleChanged = lastTrackingIdRef.current !== trackingVehicleId;
      lastTrackingIdRef.current = trackingVehicleId;

      // When a specific vehicle is being tracked and its path has loaded,
      // zoom to the MOST RECENT end of the path (current location), not all historical data.
      if (trackingVehicleId && Array.isArray(trackedPath) && trackedPath.length > 0 && vehicleChanged) {
        // Use last 20 points to determine the current area (avoids old historical regions pulling the view)
        const recent = trackedPath.slice(-20);
        const pathCoords = recent
          .map(p => [Number(p.lat), Number(p.lng)])
          .filter(c => !isNaN(c[0]) && !isNaN(c[1]));
        if (pathCoords.length > 0) {
          try {
            // Use animate: false to prevent jittery behavior, reduced padding to keep zoom stable
            map.fitBounds(pathCoords, { padding: [40, 40], animate: false, maxZoom: 13 });
          } catch { /* ignore */ }
        }
        initialFitRef.current = true;
        return;
      }
      
      // No track active — fit to all fleet vehicles (only on first load)
      if (!trackingVehicleId && !initialFitRef.current) {
        const coords = vehicles
          .filter((v) => v && v.lat != null && v.lng != null)
          .map((v) => [Number(v.lat), Number(v.lng)]);
        
        if (coords.length === 0) return;
        
        try {
          map.fitBounds(coords, { padding: [50, 50], animate: false, maxZoom: 12 });
          initialFitRef.current = true;
        } catch {
          // ignore fit errors
        }
      }
    }, [trackingVehicleId]); // Only re-fit when vehicle selection CHANGES, not on every path update
    
    return (
      <MapInteractionHandler 
        map={map} 
        onInteractionStart={() => {
          userInteractingRef.current = true;
          setUserInteracting(true);
        }}
        onInteractionEnd={() => {
          userInteractingRef.current = false;
          setUserInteracting(false);
        }}
      />
    );
  }

  // Component to track map interactions
  function MapInteractionHandler({ map, onInteractionStart, onInteractionEnd }) {
    React.useEffect(() => {
      const handleDragStart = () => onInteractionStart();
      const handleDragEnd = () => {
        setTimeout(() => onInteractionEnd(), 100);
      };
      const handleZoomStart = () => onInteractionStart();
      const handleZoomEnd = () => {
        setTimeout(() => onInteractionEnd(), 100);
      };
      
      map.on('dragstart', handleDragStart);
      map.on('dragend', handleDragEnd);
      map.on('zoomstart', handleZoomStart);
      map.on('zoomend', handleZoomEnd);
      map.on('wheel', (e) => {
        onInteractionStart();
        setTimeout(() => onInteractionEnd(), 200);
      });
      
      return () => {
        map.off('dragstart', handleDragStart);
        map.off('dragend', handleDragEnd);
        map.off('zoomstart', handleZoomStart);
        map.off('zoomend', handleZoomEnd);
      };
    }, [map, onInteractionStart, onInteractionEnd]);
    
    return null;
  }

  // deduplicate vehicles by id or number to avoid duplicate markers
  // Normalize lat/lng — GPS API returns latitude/longitude
  const uniqueVehicles = React.useMemo(() => {
    const m = new Map();
    (vehicles || []).forEach(v => {
      if (!v) return;
      const vLat = v.lat ?? v.latitude;
      const vLng = v.lng ?? v.longitude;
      const key = v.id ?? v.number ?? `${vLat}:${vLng}`;
      if (!m.has(key) && vLat != null && vLng != null) m.set(key, { ...v, lat: Number(vLat), lng: Number(vLng) });
    });
    return Array.from(m.values());
  }, [vehicles]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}>
      {/* Map on left */}
      <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, width: '100%', minHeight: 400 }}>
          <MapContainer 
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        dragging={true}
        style={{ height: '100%', width: '100%', minHeight: 400 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds vehicles={uniqueVehicles} trackedPath={displayPath} trackingVehicleId={trackingVehicleId} />
        {uniqueVehicles.map((v, idx) => {
          const isHighlighted = highlightNumbers.includes(v.number);
          if (isHighlighted) {
            return (
                <React.Fragment key={`h-${v.id || v.number}`}>
                  <Marker 
                    position={[Number(v.lat), Number(v.lng)]}
                    eventHandlers={{
                      dblclick: () => handleCreatePOI(v)
                    }}
                  >
                    <Tooltip sticky={true} offset={[0, -15]} direction="top" opacity={1}>
                      <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#FF6B35' }}>
                        🚩 Double-click to add
                      </span>
                    </Tooltip>
                    <Popup maxWidth={300} maxHeight={450}>
                      <div style={{ fontSize: 12, minHeight: 'auto', overflowY: 'auto' }}>
                        <strong>{v.number || v.vehicleNumber || 'Vehicle'}</strong>
                        <div style={{ fontSize: 11 }}>{v.driver || v.driverName || ''}</div>
                        <div style={{ fontSize: 11, marginTop: 4, color: '#666' }}>
                          POI: {v.poiName || 'Outside'}
                        </div>
                        <div style={{ fontSize: 11, marginTop: 4, color: '#d6336c' }}>
                          STP: {v.stoppageAll || '-'}
                        </div>
                        {v.lastUpdate && (
                          <div style={{ fontSize: 10, marginTop: 2, color: '#666' }}>
                            {new Date(v.lastUpdate).toLocaleString()}
                          </div>
                        )}
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
                  <CircleMarker
                    center={[Number(v.lat), Number(v.lng)]}
                    pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.6 }}
                    radius={10}
                  />
                </React.Fragment>
            );
          }
          return (
            <Marker 
              key={v.id || v.number || `v-${idx}`} 
              position={[Number(v.lat), Number(v.lng)]}
              eventHandlers={{
                dblclick: () => handleCreatePOI(v)
              }}
            >
              <Tooltip sticky={true} offset={[0, -15]} direction="top" opacity={1}>
                <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#FF6B35' }}>
                  🚩 Double-click to add
                </span>
              </Tooltip>
              <Popup maxWidth={300} maxHeight={450}>
                <div style={{ fontSize: 12, minHeight: 'auto', overflowY: 'auto' }}>
                  <strong>{v.number || v.vehicleNumber || 'Vehicle'}</strong>
                  <div style={{ fontSize: 11 }}>{v.driver || v.driverName || ''}</div>
                  <div style={{ fontSize: 11, marginTop: 4, color: '#666' }}>
                    POI: {v.poiName || 'Outside'}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 4, color: '#d6336c' }}>
                    STP: {v.stoppageAll || '-'}
                  </div>
                  {v.lastUpdate && (
                    <div style={{ fontSize: 10, marginTop: 2, color: '#666' }}>
                      {new Date(v.lastUpdate).toLocaleString()}
                    </div>
                  )}
                  {v.stopTime && (
                    <div style={{ fontSize: 11, marginTop: 4, color: '#d6336c' }}>
                      Stop Time: {typeof v.stopTime === 'string' ? v.stopTime : new Date(v.stopTime).toLocaleString()}
                    </div>
                  )}
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
          );
        })}
        
        {/* Render POI markers */}
        {pois.map((poi) => (
          <CircleMarker
            key={`poi-${poi.id}`}
            center={[Number(poi.latitude), Number(poi.longitude)]}
            radius={8}
            pathOptions={{ color: '#FF6B6B', fillColor: '#FFE66D', fillOpacity: 0.8, weight: 2 }}
          >
            <Popup>
              <div style={{ fontSize: 11, fontWeight: 'bold' }}>
                📍 {poi.poi_name || poi.name}
                {poi.city && <div style={{ fontSize: 10, marginTop: 2, color: '#666' }}>{poi.city}</div>}
              </div>
            </Popup>
          </CircleMarker>
        ))}
        
        {/* ALWAYS: green START + red END markers with always-visible time labels */}
        {Array.isArray(displayPath) && displayPath.length > 0 && (() => {
          const first = displayPath[0];
          const last = displayPath[displayPath.length - 1];
          const fmtTime = (ts) => new Date(ts).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:true });
          return (
            <>
              <CircleMarker center={[Number(first.lat), Number(first.lng)]} radius={10}
                pathOptions={{ color: '#15803d', fillColor: '#22c55e', fillOpacity: 1, weight: 2.5 }}>
                <Tooltip permanent direction="top" offset={[0, -12]} opacity={1}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', whiteSpace: 'nowrap' }}>
                    🟢 {fmtTime(first.gps_time || first.ts)}
                  </span>
                </Tooltip>
                <Popup><div style={{ fontSize: 11, fontWeight: 'bold' }}>
                  🟢 Start · Point 1<br/>
                  {new Date(first.gps_time || first.ts).toLocaleString()}<br/>
                  <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{Number(first.lat).toFixed(5)}, {Number(first.lng).toFixed(5)}</span>
                </div></Popup>
              </CircleMarker>
              {displayPath.length > 1 && (
                <CircleMarker center={[Number(last.lat), Number(last.lng)]} radius={10}
                  pathOptions={{ color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 1, weight: 2.5 }}>
                  <Tooltip permanent direction="bottom" offset={[0, 12]} opacity={1}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', whiteSpace: 'nowrap' }}>
                      🔴 {fmtTime(last.gps_time || last.ts)}
                    </span>
                  </Tooltip>
                  <Popup><div style={{ fontSize: 11, fontWeight: 'bold' }}>
                    🔴 End · Point {displayPath.length}<br/>
                    {new Date(last.gps_time || last.ts).toLocaleString()}<br/>
                    <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{Number(last.lat).toFixed(5)}, {Number(last.lng).toFixed(5)}</span>
                  </div></Popup>
                </CircleMarker>
              )}
            </>
          );
        })()}

        {/* STATIC (not playing): all intermediate points as gray dots */}
        {!isPlaying && currentPointIndex === 0 && Array.isArray(displayPath) && displayPath.length > 2 && (
          <>
            {displayPath.slice(1, displayPath.length - 1).map((pt, pi) => (
              <CircleMarker
                key={`static-${pi}`}
                center={[Number(pt.lat), Number(pt.lng)]}
                radius={5}
                pathOptions={{ color: '#6b7280', fillColor: '#9ca3af', fillOpacity: 1, weight: 1 }}
              >
                <Popup><div style={{ fontSize: 11 }}>
                  Point {pi + 2}<br/>
                  {new Date(pt.gps_time || pt.ts).toLocaleString()}<br/>
                  <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{Number(pt.lat).toFixed(5)}, {Number(pt.lng).toFixed(5)}</span>
                </div></Popup>
              </CircleMarker>
            ))}
          </>
        )}

        {/* REST STOP markers — purple dashed ring at locations where vehicle was parked */}
        {Array.isArray(restStops) && restStops.map((stop, si) => (
          <React.Fragment key={`rest-${si}`}>
            <CircleMarker center={[Number(stop.lat), Number(stop.lng)]} radius={13}
              pathOptions={{ color: '#7c3aed', fillColor: 'none', fillOpacity: 0, weight: 2, dashArray: '4 3', opacity: 0.85 }}
            />
            <CircleMarker center={[Number(stop.lat), Number(stop.lng)]} radius={6}
              pathOptions={{ color: '#7c3aed', fillColor: '#a78bfa', fillOpacity: 0.9, weight: 1.5 }}
            >
              <Popup>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                  <strong style={{ color: '#7c3aed' }}>🅿️ Rested {stop.label}</strong><br/>
                  <span style={{ fontSize: 11, color: '#555' }}>
                    From: {new Date(stop.from).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:true })}<br/>
                    To:&nbsp;&nbsp;&nbsp;{new Date(stop.to).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:true })}
                  </span>
                </div>
              </Popup>
            </CircleMarker>
          </React.Fragment>
        ))}

        {/* PLAYBACK: dots appear one by one. Visited = gray, current = orange cursor */}
        {Array.isArray(displayPath) && displayPath.length > 0 && (isPlaying || currentPointIndex > 0) && (
          <>
            {/* All visited dots up to (but not including) current */}
            {displayPath.slice(0, currentPointIndex).map((pt, pi) => (
              <CircleMarker
                key={`visited-${pi}`}
                center={[Number(pt.lat), Number(pt.lng)]}
                radius={6}
                pathOptions={{ color: '#6b7280', fillColor: '#9ca3af', fillOpacity: 1, weight: 1 }}
              >
                <Popup><div style={{ fontSize: 11 }}>
                  Point {pi + 1}<br/>
                  {new Date(pt.gps_time || pt.ts).toLocaleString()}
                  <div style={{ fontFamily: 'monospace' }}>{Number(pt.lat).toFixed(5)}, {Number(pt.lng).toFixed(5)}</div>
                </div></Popup>
              </CircleMarker>
            ))}
            {/* Rest stops passed so far during playback */}
            {restStops.filter(s => s.idx < currentPointIndex).map((stop, si) => (
              <CircleMarker key={`rest-play-${si}`} center={[Number(stop.lat), Number(stop.lng)]} radius={8}
                pathOptions={{ color: '#7c3aed', fillColor: '#a78bfa', fillOpacity: 0.9, weight: 1.5 }}
              >
                <Popup><div style={{ fontSize: 12 }}>
                  <strong style={{ color: '#7c3aed' }}>🅿️ Rested {stop.label}</strong><br/>
                  <span style={{ fontSize: 11, color: '#555' }}>{new Date(stop.from).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', hour12:true })}</span>
                </div></Popup>
              </CircleMarker>
            ))}
            {/* Current position — smooth truck icon, rotates to face direction of travel */}
            {(isPlaying ? animPos : displayPath[currentPointIndex]) && (() => {
              const cur = isPlaying && animPos ? animPos : displayPath[currentPointIndex];
              const pos = [Number(cur.lat), Number(cur.lng)];
              const bearing = cur.bearing ?? 0;
              const truckIcon = L.divIcon({
                className: '',
                html: `<div style="transform:rotate(${bearing}deg);font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4));transition:transform 0.1s linear">🚛</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
              });
              const snapPt = displayPath[currentPointIndex] || cur;
              return (
                <Marker position={pos} icon={truckIcon} zIndexOffset={1000}>
                  <Popup>
                    <div style={{ fontSize: 11, fontWeight: 'bold' }}>
                      🚛 {trackingVehicleId || 'Vehicle'}
                      <div style={{ marginTop: 4 }}>{new Date(snapPt.gps_time || snapPt.ts).toLocaleString()}</div>
                      <div style={{ marginTop: 2, fontFamily: 'monospace', fontSize: 10 }}>{Number(cur.lat).toFixed(5)}, {Number(cur.lng).toFixed(5)}</div>
                      <div style={{ marginTop: 2, fontSize: 10 }}>Point {currentPointIndex + 1} / {displayPath.length}</div>
                    </div>
                  </Popup>
                </Marker>
              );
            })()}
          </>
        )}
      </MapContainer>
        </div>
      
      {/* Playback controls - shown when track loaded */}
      {Array.isArray(trackedPath) && trackedPath.length > 0 && (
        <div style={{ 
          position: 'relative', 
          background: 'white',
          padding: '12px',
          borderTop: '1px solid #e5e7eb',
          zIndex: 100
        }}>
          {/* Time display - date, vehicle, time */}
          {displayPath[currentPointIndex] && (() => {
            const cur = displayPath[currentPointIndex];
            const d = new Date(cur.gps_time || cur.ts);
            return (
              <div style={{ 
                marginBottom: '12px', 
                textAlign: 'center',
                background: '#f8fafc',
                borderRadius: '8px',
                padding: '8px 12px',
                border: '1px solid #e2e8f0'
              }}>
                {/* Vehicle number */}
                {trackingVehicleId && (
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e40af', letterSpacing: '0.5px' }}>
                    🚛 {trackingVehicleId}
                  </div>
                )}
                {/* Date */}
                <div style={{ fontSize: '12px', color: '#374151', fontWeight: '600', marginTop: '2px' }}>
                  📅 {d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                {/* Time */}
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1f2937', marginTop: '2px' }}>
                  🕐 {d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                  Point {currentPointIndex + 1} of {displayPath.length}
                </div>
                <div style={{ fontSize: '11px', color: '#374151', marginTop: '2px', fontFamily: 'monospace' }}>
                  📍 {Number(cur.lat).toFixed(5)}, {Number(cur.lng).toFixed(5)}
                </div>
              </div>
            );
          })()}
          
          {/* Play/Pause/Speed controls */}
          
          {/* Controls */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* Play/Pause button */}
            <button 
              onClick={() => {
                if (!isPlaying) {
                  // If at the last point, restart from beginning
                  if (currentPointIndex >= displayPath.length - 1) {
                    setCurrentPointIndex(0);
                  }
                  setIsPlaying(true);
                } else {
                  setIsPlaying(false);
                }
              }}
              disabled={displayPath.length === 0}
              style={{
                padding: '6px 10px',
                fontSize: '12px',
                borderRadius: '4px',
                border: 'none',
                background: isPlaying ? '#ef4444' : '#3b82f6',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'background 0.2s'
              }}
              title={isPlaying ? 'Pause animation' : 'Play animation'}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            
            {/* Reset button */}
            <button
              onClick={() => {
                setCurrentPointIndex(0);
                setIsPlaying(false);
              }}
              disabled={displayPath.length === 0}
              style={{
                padding: '6px 10px',
                fontSize: '12px',
                borderRadius: '4px',
                border: 'none',
                background: '#6b7280',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'background 0.2s'
              }}
              title="Reset to start"
            >
              ⊚ Reset
            </button>
            
            {/* Speed controls */}
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#666', fontWeight: 'bold' }}>Speed:</span>
              {[1, 2, 5, 10].map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    borderRadius: '3px',
                    border: playbackSpeed === speed ? 'none' : '1px solid #d1d5db',
                    background: playbackSpeed === speed ? '#10b981' : '#f3f4f6',
                    color: playbackSpeed === speed ? 'white' : '#1f2937',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: 'background 0.2s'
                  }}
                  title={`${speed * 60}x real-time compression`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
      
      {/* Right sidebar - Timeline bar (vertical) */}
      {Array.isArray(trackedPath) && trackedPath.length > 0 && (
        <div style={{
          width: '280px',
          height: '100%',
          background: 'rgba(255, 255, 255, 0.98)',
          borderLeft: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          padding: '12px',
          overflowY: 'auto',
          zIndex: 100
        }}>
          {/* Timeline header */}
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1f2937', marginBottom: '12px' }}>
            📍 Timeline
          </div>
          
          {/* Vertical timeline bar */}
          <div
            onMouseDown={() => setIsDraggingTimeline(true)}
            onMouseUp={() => setIsDraggingTimeline(false)}
            onMouseLeave={() => setIsDraggingTimeline(false)}
            onMouseMove={(e) => {
              if (!isDraggingTimeline || trackedPath.length === 0) return;
              const bar = e.currentTarget;
              const rect = bar.getBoundingClientRect();
              const percent = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
              const newIndex = Math.round(percent * (trackedPath.length - 1));
              setCurrentPointIndex(newIndex);
              setIsPlaying(false);
            }}
            style={{
              flex: 1,
              width: '40px',
              background: 'linear-gradient(to bottom, #f3f4f6, #e5e7eb)',
              borderRadius: '6px',
              overflow: 'hidden',
              position: 'relative',
              cursor: isDraggingTimeline ? 'grabbing' : 'pointer',
              border: '1px solid #d1d5db',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              marginBottom: '12px'
            }}
          >
            {/* Progress fill (vertical) */}
            <div style={{
              width: '100%',
              background: 'linear-gradient(to bottom, #3b82f6, #1d4ed8)',
              height: `${trackedPath.length > 0 ? (currentPointIndex / (trackedPath.length - 1)) * 100 : 0}%`,
              transition: isDraggingTimeline ? 'none' : 'height 0.3s ease',
              position: 'relative'
            }}>
              {/* Gradient fade effect */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '100%',
                height: '20px',
                background: 'linear-gradient(to bottom, rgba(29, 78, 216, 1), rgba(29, 78, 216, 0.3))'
              }} />
            </div>
            
            {/* Scrubber (vertical) */}
            <div style={{
              position: 'absolute',
              top: `${trackedPath.length > 0 ? (currentPointIndex / (trackedPath.length - 1)) * 100 : 0}%`,
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '18px',
              height: '18px',
              background: isPlaying ? '#ef4444' : '#3b82f6',
              borderRadius: '50%',
              border: '2px solid white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              cursor: 'grab',
              transition: isDraggingTimeline ? 'none' : 'background 0.2s'
            }} />
            
            {/* Waypoint markers (vertical) */}
            {trackedPath.map((point, idx) => (
              idx % Math.max(1, Math.floor(trackedPath.length / 8)) === 0 && (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    top: `${(idx / (trackedPath.length - 1)) * 100}%`,
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '10px',
                    height: '2px',
                    background: idx <= currentPointIndex ? '#1d4ed8' : '#cbd5e1',
                    opacity: 0.6
                  }}
                />
              )
            ))}
          </div>
          
          {/* Timeline info */}
          <div style={{ fontSize: '10px', color: '#666', textAlign: 'center' }}>
            <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>
              {currentPointIndex + 1} / {trackedPath.length}
            </div>
            <div style={{ fontSize: '9px', marginBottom: '8px' }}>
              {trackedPath.length > 0 ? new Date(trackedPath[0].gps_time).toLocaleTimeString() : '--:--'}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}>
              Current
            </div>
            <div style={{ fontSize: '9px', marginBottom: '8px' }}>
              {trackedPath.length > 0 && currentPointIndex < trackedPath.length
                ? new Date(trackedPath[currentPointIndex].gps_time).toLocaleTimeString()
                : '--:--'}
            </div>
            <div style={{ fontSize: '9px', marginBottom: '4px' }}>
              {trackedPath.length > 0 ? new Date(trackedPath[trackedPath.length - 1].gps_time).toLocaleTimeString() : '--:--'}
            </div>
          </div>
        </div>
      )}
      
      {trackLoading && (
        <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 9999 }}>
          <div className="bg-white/90 px-3 py-2 rounded-md shadow">Loading track...</div>
        </div>
      )}
      {trackError && (
        <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 9999 }}>
          <div className="bg-rose-50 text-rose-700 px-3 py-2 rounded-md shadow">{trackError}</div>
        </div>
      )}
      {/* Reverse button - moved to top right - ONLY when playing */}
      {Array.isArray(trackedPath) && trackedPath.length > 0 && isPlaying && (
        <div style={{ position: 'absolute', right: 12, top: 12, zIndex: 9999 }}>
          <button 
            onClick={() => setIsReversed(!isReversed)}
            className={`px-3 py-2 rounded-md font-semibold text-sm transition-all shadow ${
              isReversed 
                ? 'bg-amber-500 text-black hover:bg-amber-600' 
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
            title={isReversed ? 'Show original path direction' : 'Reverse path direction'}
          >
            {isReversed ? '⟲ Reversed' : '↻ Reverse'}
          </button>
        </div>
      )}
      
      {/* Debug Panel - HIDDEN */}
    </div>
  );
};

export default VehicleTracker;