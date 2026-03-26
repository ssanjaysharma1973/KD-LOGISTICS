import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet marker icons in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

const makeColorIcon = (color, label = '') => L.divIcon({
  html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">${label}</div>`,
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -14],
});

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions && positions.length > 1) {
      const t = setTimeout(() => map.fitBounds(positions, { padding: [60, 60] }), 150);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(positions)]);
  return null;
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

const API = '/api';

// HERE Flexible Polyline decoder — spec: https://github.com/heremaps/flexible-polyline
// Structure: [format_version_byte][header_byte][lat_delta][lng_delta]...
// format_version = 1, header encodes precision (lower 4 bits)
function decodeHerePolyline(encoded) {
  const TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  try {
    // Decode one VBE-encoded unsigned integer starting at index, advance index
    let idx = 0;
    const nextUint = () => {
      let result = 0, shift = 0, val;
      do {
        val = TABLE.indexOf(encoded[idx++]);
        result |= (val & 0x1F) << shift;
        shift += 5;
      } while (val >= 0x20);
      return result;
    };
    const toSigned = v => (v & 1) ? ~v >> 1 : v >> 1;

    nextUint(); // skip format version (always 1)
    const header    = nextUint();
    const precision = header & 0x0F;
    const thirdDim  = (header >> 4) & 0x7; // 0 = no altitude
    const factor    = Math.pow(10, precision);

    const result = [];
    let lat = 0, lng = 0;
    while (idx < encoded.length) {
      lat += toSigned(nextUint());
      lng += toSigned(nextUint());
      if (thirdDim) nextUint(); // skip altitude if present
      result.push([lat / factor, lng / factor]);
    }
    return result;
  } catch { return []; }
}
const CLIENT_ID = 'CLIENT_001';

const SIZE_LABELS = {
  category_1_32ft_34ft: '32/34 FT (Cat 1)',
  category_2_22ft_24ft: '22/24 FT (Cat 2)',
  category_3_small: 'Small / Bolero (Cat 3)',
};

const STEPS = ['Munshi, Route & Vehicle', 'Route Details', 'Expense Summary', 'Confirm & Dispatch'];

export default function TripDispatchWizard() {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedTrip, setSavedTrip] = useState(null);
  const [ewbNo, setEwbNo] = useState('');
  const [partBStatus, setPartBStatus] = useState(null); // null | 'success' | 'skipped' | 'failed'
  const [isPartialRoute, setIsPartialRoute] = useState(false); // half-route: TO can be assigned later
  const [emptyReturn, setEmptyReturn] = useState(false);       // ↩ vehicle returns to own facility empty (no unloading at RETURN POI)
  const [tripType, setTripType] = useState('F'); // 'F'=Forward | 'R'=Return | 'E'=Extension | 'C'=Complete(F+R)
  const [savedGroup, setSavedGroup] = useState(null); // C mode response: { group_id, trips:[{id,type}] }

  // Step 1 state
  const [munshis, setMunshis] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesRefreshing, setVehiclesRefreshing] = useState(false);
  const [vehiclesLoadedAt, setVehiclesLoadedAt] = useState(null);
  const [selectedMunshi, setSelectedMunshi] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [tripHistory, setTripHistory] = useState([]); // past trips for selected munshi

  // Step 2 state
  const [pois, setPois] = useState([]);
  const [cities, setCities] = useState([]);
  const [unloadingRates, setUnloadingRates] = useState({});
  const [_fromCity, setFromCity] = useState('');
  const [_toCity, setToCity] = useState('');
  const [fromPOI, setFromPOI] = useState(null);
  const [toPOI, setToPOI] = useState(null);
  const [waypoints, setWaypoints] = useState([]); // array of POI ids
  const [routeKm, setRouteKm] = useState('');
  const [routeGeometry, setRouteGeometry] = useState([]);   // active route (selected)
  const [highwayGeometry, setHighwayGeometry] = useState([]); // fastest duration route
  const [localGeometry, setLocalGeometry] = useState([]);    // shortest distance route
  const [highwayKm, setHighwayKm] = useState('');            // km for highway option
  const [localKm, setLocalKm] = useState('');                // km for local option
  const [expresswayKm, setExpresswayKm] = useState('');      // km for expressway (Delhi bypass)
  const [expresswayGeometry, setExpresswayGeometry] = useState([]);
  const [kmFetching, setKmFetching] = useState(false);
  const [kmError, setKmError] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [tollCharges, setTollCharges] = useState('');
  const [tollMode, setTollMode] = useState(''); // '' = not set | 'cash' | 'card'
  const [tollAutoSource, setTollAutoSource] = useState(''); // 'here' | 'calc' | ''
  const [tollManuallyEdited, setTollManuallyEdited] = useState(false); // true only when user typed toll manually
  const [stopUnloadingOverrides, setStopUnloadingOverrides] = useState({}); // { [poiId]: amountStr }
  const [routeMode, setRouteMode] = useState('highway'); // 'highway' | 'local' | 'expressway'
  const useHighway = routeMode !== 'local'; // computed — true for both highway and expressway
  const [highwayName, setHighwayName] = useState('');
  const [kmManual, setKmManual] = useState(false);
  const [kmSanityWarn, setKmSanityWarn] = useState('');
  const [altIdentical, setAltIdentical] = useState(false);
  const kmFetchedRef = useRef(false);
  const highwayManualRef = useRef(false); // true when user manually toggled the checkbox
  const [fuelTypeRates, setFuelTypeRates] = useState({}); // { Diesel: 89.62, ... }
  const [_showAllFromPois, setShowAllFromPois] = useState(false);
  const [_showAllToPois, setShowAllToPois] = useState(false);
  const [_fromPoiSearch, setFromPoiSearch] = useState('');
  const [_toPoiSearch, setToPoiSearch] = useState('');
  const [stopCity, setStopCity] = useState('');
  const [stopPoiSearch, setStopPoiSearch] = useState('');
  const [showAllStopPois, setShowAllStopPois] = useState(false);
  const [kmLearned, setKmLearned] = useState(null); // { km, dispatches, last_used } from memory
  const [vehicleQuickEdit, setVehicleQuickEdit] = useState({}); // { fuel_type, kmpl, fuel_cost_per_liter }
  const [vehicleQuickSaving, setVehicleQuickSaving] = useState(false);
  const [selectedGridCity, setSelectedGridCity] = useState(null); // city selected in step-0 sidebar
  const [activeSlot, setActiveSlot] = useState('from'); // which slot the shared POI list assigns to
  const [driverAdvance, setDriverAdvance] = useState(''); // advance given to driver
  const [munshiAdvance, setMunshiAdvance] = useState(''); // advance given to munshi

  // Step 3 computed — vehicleQuickEdit values are "live" overrides before saving
  const effectiveFuelType = vehicleQuickEdit.fuel_type ?? selectedVehicle?.fuel_type;
  const effectiveKmpl = vehicleQuickEdit.kmpl ?? selectedVehicle?.kmpl;
  const effectiveCostPerLiter = vehicleQuickEdit.fuel_cost_per_liter ?? selectedVehicle?.fuel_cost_per_liter;
  const kmpl = parseFloat(effectiveKmpl) || 0;
  const masterRate = effectiveFuelType ? (fuelTypeRates[effectiveFuelType] || 0) : 0;
  const fuelRate = parseFloat(effectiveCostPerLiter) || masterRate;
  const fuelRateSource = !parseFloat(effectiveCostPerLiter) && masterRate ? 'master' : 'vehicle';
  const km = parseFloat(routeKm) || 0;
  const fuelLitres = kmpl > 0 ? (km / kmpl).toFixed(2) : 0;
  const fuelCost = (parseFloat(fuelLitres) * fuelRate).toFixed(2);
  const vehicleCat = selectedVehicle?.vehicle_size || 'category_1_32ft_34ft';
  const isBigVehicle = vehicleCat === 'category_1_32ft_34ft';
  const isHighwayRoute = useHighway; // all vehicle sizes are highway when routeMode !== 'local'
  // Default to highway=true since Cat 1 (big) is the default vehicle category
  // Primary/secondary POIs (or HAIER-named own facilities) — no unloading charge applies
  const isOwnFacility = (p) => !p ? false : (p.type === 'primary' || p.type === 'secondary' || (p.poi_name || '').toUpperCase().startsWith('HAIER'));
  const isNoUnloadPOI = (id) => { const p = pois.find(x => x.id === id); return isOwnFacility(p); };
  const _unloadingRaw = waypoints.reduce((sum, poiId) => {
    // Override always wins — even for own-facility POIs
    if (stopUnloadingOverrides[poiId] !== undefined) return sum + (parseFloat(stopUnloadingOverrides[poiId]) || 0);
    if (isNoUnloadPOI(poiId)) return sum;
    const r = unloadingRates[poiId];
    return sum + (r ? parseFloat(r[vehicleCat]) || 0 : 0);
  }, 0) + (toPOI && !isNoUnloadPOI(toPOI.id) && !emptyReturn && unloadingRates[toPOI.id] ? parseFloat(unloadingRates[toPOI.id][vehicleCat]) || 0 : 0);
  // R and E carry zero unloading (Rule 1: unloading only in Forward leg)
  const unloadingTotal = (tripType === 'R' || tripType === 'E') ? 0 : _unloadingRaw;
  const toll = parseFloat(tollCharges) || 0;
  const totalExpense = (parseFloat(fuelCost) + unloadingTotal + toll).toFixed(2);
  // C = Complete: combined expense (F + R = fuel×2 + unloading once + toll once)
  const totalExpenseC = tripType === 'C'
    ? (parseFloat(fuelCost) * 2 + unloadingTotal + toll).toFixed(2)
    : totalExpense;

  // ── Fetch munshis + all vehicles + POIs + rates on mount ──
  const refreshPois = () => {
    fetch(`${API}/pois?clientId=${CLIENT_ID}`)
      .then(r => r.json())
      .then(pData => {
        const poisArr = Array.isArray(pData) ? pData : [];
        setPois(poisArr);
        setCities([...new Set(poisArr.map(p => p.city).filter(Boolean))].sort());
      })
      .catch(console.error);
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API}/munshis?clientId=${CLIENT_ID}`).then(r => r.json()),
      fetch(`${API}/vehicles-master?clientId=${CLIENT_ID}`).then(r => r.json()),
      fetch(`${API}/pois?clientId=${CLIENT_ID}`).then(r => r.json()),
      fetch(`${API}/poi-unloading-rates?clientId=${CLIENT_ID}`).then(r => r.json()),
      fetch(`${API}/fuel-type-rates`).then(r => r.json()),
    ]).then(([mData, vData, pData, rData, ftData]) => {
      setMunshis(Array.isArray(mData) ? mData : []);
      setVehicles(Array.isArray(vData) ? vData : []);
      const poisArr = Array.isArray(pData) ? pData : [];
      setPois(poisArr);
      setCities([...new Set(poisArr.map(p => p.city).filter(Boolean))].sort());
      const map = {};
      (rData?.rates || []).forEach(r => { map[r.poi_id] = r; });
      setUnloadingRates(map);
      const ftMap = {};
      (Array.isArray(ftData) ? ftData : []).forEach(r => {
        ftMap[r.fuel_type] = r.cost_per_liter;
        ftMap[r.fuel_type.toUpperCase()] = r.cost_per_liter; // case-insensitive fallback
      });
      setFuelTypeRates(ftMap);
    }).catch(console.error);

    // Auto-refresh POIs when a new POI is added from anywhere in the app
    const onPoiAdded = () => refreshPois();
    window.addEventListener('poi-added', onPoiAdded);
    return () => window.removeEventListener('poi-added', onPoiAdded);
  }, []);

  // ── Refresh vehicles from backend ──
  const refreshVehicles = () => {
    setVehiclesRefreshing(true);
    fetch(`${API}/vehicles-master?clientId=${CLIENT_ID}`)
      .then(r => r.json())
      .then(d => { setVehicles(Array.isArray(d) ? d : []); setVehiclesLoadedAt(new Date()); })
      .catch(console.error)
      .finally(() => setVehiclesRefreshing(false));
  };

  // ── Auto-tick highway for Cat 1 (32/34ft) — fires on vehicle change ──
  // Always default highway=true for big vehicles; km effect handles km≤25 off-case
  // For small/medium: default local, BUT keep highway if route is already >40km
  useEffect(() => {
    if (!selectedVehicle) return;
    highwayManualRef.current = false; // reset manual override on vehicle change
    if (isBigVehicle) {
      if (routeMode !== 'expressway') setRouteMode('highway');
    } else {
      // Keep highway for long routes (>40km) even on small/medium vehicles
      if (km <= 40) setRouteMode('local');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle]);

  // ── Fetch trip history when munshi changes (for intelligent vehicle ordering) ──
  useEffect(() => {
    if (!selectedMunshi) { setTripHistory([]); return; }
    setShowAllFromPois(false);
    setShowAllToPois(false);
    fetch(`${API}/trip-dispatches?munshiId=${selectedMunshi.id}`)
      .then(r => r.json())
      .then(d => setTripHistory(Array.isArray(d.trips) ? d.trips : []))
      .catch(() => setTripHistory([]));
  }, [selectedMunshi]);

  // ── Auto-set emptyReturn when RETURN POI changes (own facilities default to empty return) ──
  useEffect(() => {
    setEmptyReturn(toPOI ? isOwnFacility(toPOI) : false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toPOI?.id]);

  // ── Auto-set highway based on km (all vehicles) — also forces highway >40km for small/medium ──
  // Big vehicles: highway >25km, local ≤25km (unless manually overridden)
  // All vehicles: force highway when km >40 (long routes are never local)
  useEffect(() => {
    if (highwayManualRef.current) return;
    // Partial mode: auto-prefer expressway when available (vehicles go via WPE/KMP or EPE bypass)
    if (isPartialRoute && expresswayKm && routeMode !== 'expressway') {
      setRouteMode('expressway');
      setRouteKm(expresswayKm);
      if (expresswayGeometry.length) setRouteGeometry(expresswayGeometry);
      // WPE (KMP) for western origins (Bahadurgarh ~76.9°E), EPE for eastern/northern origins
      setHighwayName(fromPOI?.longitude < 77.0 ? 'Western Peripheral Expressway (KMP)' : 'Eastern Peripheral Expressway + KMP');
      return;
    }
    if (km > 0 && !isPartialRoute && routeMode !== 'expressway') {
      if (km > 40) {
        // Long route — always highway regardless of vehicle size
        setRouteMode('highway');
      } else if (isBigVehicle) {
        // Big vehicle — highway >25km, local ≤25km
        setRouteMode(km > 25 ? 'highway' : 'local');
      }
      // Small/medium vehicles ≤40km: keep their current mode (local by default)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBigVehicle, km, routeMode]);

  // ── Auto-fetch road KM when from+to change (skip if manual lock) ──
  useEffect(() => {
    if (!fromPOI || !toPOI || kmManual) return;
    kmFetchedRef.current = false;
    setKmLearned(null);
    // Check route memory first — use learned KM if available, then fall back to OSRM
    const hw = useHighway ? 1 : 0;
    fetch(`${API}/route-km-memory?from=${encodeURIComponent(fromPOI.poi_name)}&to=${encodeURIComponent(toPOI.poi_name)}&highway=${hw}`)
      .then(r => r.json())
      .then(d => {
        if (d.found) {
          setKmLearned({ km: d.km, toll: d.toll || 0, dispatches: d.dispatches, last_used: d.last_used });
          setRouteKm(String(d.km));
          setKmError('');
          // Auto-fill toll: use stored value if > 0, else fall back to km × rate formula
          if (!tollManuallyEdited && !tollCharges) {
            if ((d.toll || 0) > 0) {
              setTollCharges(String(Math.round(d.toll)));
              setTollAutoSource('learned');
            } else {
              const TOLL_RATE_HW   = { category_1_32ft_34ft: 5.5, category_2_22ft_24ft: 4, category_3_small: 3 };
              const TOLL_RATE_EXPR = { category_1_32ft_34ft: 7,   category_2_22ft_24ft: 4, category_3_small: 3 };
              const cat = selectedVehicle?.vehicle_size || 'category_1_32ft_34ft';
              const isHW = routeMode === 'highway' || routeMode === 'expressway';
              if (isHW) {
                const rate = routeMode === 'expressway' ? (TOLL_RATE_EXPR[cat] || 7) : (TOLL_RATE_HW[cat] || 5.5);
                setTollCharges(String(Math.round(d.km * rate)));
                setTollAutoSource('calc');
              }
            }
          }
          // Still fetch road options in background so Expressway/Highway/Local buttons are populated
          fetchRoadKm(fromPOI, toPOI, waypoints, routeMode, true);
        } else {
          fetchRoadKm(fromPOI, toPOI, waypoints, routeMode);
        }
      })
      .catch(() => fetchRoadKm(fromPOI, toPOI, waypoints, routeMode));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromPOI, toPOI]);

  // ── Half-route: auto-fetch KM from FROM → last stop POI whenever waypoints change ──
  useEffect(() => {
    if (!isPartialRoute || !fromPOI || waypoints.length === 0 || kmManual) return;
    const wpPois = waypoints.map(id => pois.find(x => x.id === id)).filter(Boolean);
    if (!wpPois.length) return;
    const tp = wpPois[wpPois.length - 1];       // last added stop = destination
    const wpsIds = waypoints.slice(0, -1);       // everything before it = via
    fetchRoadKm(fromPOI, tp, wpsIds, routeMode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPartialRoute, fromPOI, waypoints]);

  // ── Half-route: when routeMode changes manually, apply cached km without re-fetch ──
  useEffect(() => {
    if (!isPartialRoute || !fromPOI || waypoints.length === 0 || kmManual) return;
    const cachedKm   = routeMode === 'expressway' ? expresswayKm   : routeMode === 'highway' ? highwayKm   : localKm;
    const cachedGeom = routeMode === 'expressway' ? expresswayGeometry : routeMode === 'highway' ? highwayGeometry : localGeometry;
    if (cachedKm) { setRouteKm(cachedKm); if (cachedGeom.length) setRouteGeometry(cachedGeom); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeMode]);

  // ── Recalculate toll whenever routeMode changes (user switching Highway ↔ Expressway ↔ Local) ──
  useEffect(() => {
    if (tollManuallyEdited) return; // don't overwrite user-typed toll
    const TOLL_RATE_HW   = { category_1_32ft_34ft: 5.5, category_2_22ft_24ft: 4, category_3_small: 3 };
    const TOLL_RATE_EXPR = { category_1_32ft_34ft: 7,   category_2_22ft_24ft: 4, category_3_small: 3 };
    const cat = selectedVehicle?.vehicle_size || 'category_1_32ft_34ft';
    if (routeMode === 'local') { setTollCharges(''); setTollAutoSource(''); return; }
    // Use OSRM-fetched km if available, fall back to routeKm (covers learned-KM case)
    const activeKm = parseFloat(routeMode === 'expressway' ? (expresswayKm || highwayKm || routeKm) : (highwayKm || routeKm)) || 0;
    if (activeKm <= 0) return;
    const rate = routeMode === 'expressway' ? (TOLL_RATE_EXPR[cat] || 7) : (TOLL_RATE_HW[cat] || 5.5);
    setTollCharges(String(Math.round(activeKm * rate)));
    setTollAutoSource('calc');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeMode]);

  // ── Auto-lookup EWB when vehicle + TO POI are both selected ──
  const [ewbAutoMatched, setEwbAutoMatched] = useState(false);
  useEffect(() => {
    if (!selectedVehicle || !toPOI) return;
    // Don't overwrite manually entered EWB
    if (ewbNo && !ewbAutoMatched) return;
    const vno = (selectedVehicle.vehicle_no || '').replace(/\s+/g, '');
    const pin  = toPOI.pin_code || '';
    const place = toPOI.city || toPOI.poi_name || '';
    const params = new URLSearchParams({ vehicle_no: vno });
    if (pin)   params.set('to_pin', pin);
    if (place) params.set('to_place', place);
    fetch(`${API}/ewb/match?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.found) {
          setEwbNo(d.ewb_no);
          setEwbAutoMatched(true);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle, toPOI]);

  // ── Re-fetch when route mode changes ──
  useEffect(() => {
    if (!fromPOI || !toPOI || kmManual) return;

    // Expressway: data already applied by the onClick handler — nothing to do here.
    // (avoiding stale closure over expresswayKm/expresswayGeometry)
    if (routeMode === 'expressway') return;

    // If geometries were already fetched from the initial bulk call, just swap — no re-fetch needed
    const cachedGeom = routeMode === 'highway' ? highwayGeometry : localGeometry;
    const cachedKm   = routeMode === 'highway' ? highwayKm : localKm;
    if (cachedGeom.length && cachedKm) {
      setRouteGeometry(cachedGeom);
      setRouteKm(cachedKm);
      return;
    }

    // Highway / Local: check route memory then fetch
    setKmLearned(null);
    const hw = routeMode === 'highway' ? 1 : 0;
    fetch(`${API}/route-km-memory?from=${encodeURIComponent(fromPOI.poi_name)}&to=${encodeURIComponent(toPOI.poi_name)}&highway=${hw}`)
      .then(r => r.json())
      .then(d => {
        if (d.found) {
          setKmLearned({ km: d.km, toll: d.toll || 0, dispatches: d.dispatches, last_used: d.last_used });
          setRouteKm(String(d.km));
          setKmError('');
          // Auto-fill toll: use stored value if > 0, else fall back to km × rate formula
          if (!tollManuallyEdited) {
            if ((d.toll || 0) > 0) {
              setTollCharges(String(Math.round(d.toll)));
              setTollAutoSource('learned');
            } else {
              const TOLL_RATE_HW   = { category_1_32ft_34ft: 5.5, category_2_22ft_24ft: 4, category_3_small: 3 };
              const TOLL_RATE_EXPR = { category_1_32ft_34ft: 7,   category_2_22ft_24ft: 4, category_3_small: 3 };
              const cat = selectedVehicle?.vehicle_size || 'category_1_32ft_34ft';
              const isHW = routeMode === 'highway' || routeMode === 'expressway';
              if (isHW) {
                const rate = routeMode === 'expressway' ? (TOLL_RATE_EXPR[cat] || 7) : (TOLL_RATE_HW[cat] || 5.5);
                setTollCharges(String(Math.round(d.km * rate)));
                setTollAutoSource('calc');
              } else {
                setTollCharges(''); setTollAutoSource('');
              }
            }
          }
          // Re-use already-fetched geometry if available, else fetch geometry-only
          const cachedGeom = routeMode === 'highway' ? highwayGeometry : localGeometry;
          if (cachedGeom.length) setRouteGeometry(cachedGeom);
          else fetchRoadKm(fromPOI, toPOI, waypoints, routeMode, true);
        } else {
          fetchRoadKm(fromPOI, toPOI, waypoints, routeMode);
        }
      })
      .catch(() => fetchRoadKm(fromPOI, toPOI, waypoints, routeMode));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeMode]);

  const fetchRoadKm = async (fp, tp, wps, mode = 'highway', geometryOnly = false) => {
    if (!fp?.latitude || !tp?.latitude) return;

    const haversine = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    const straightKm = haversine(fp.latitude, fp.longitude, tp.latitude, tp.longitude);

    // ── Smart stop ordering: sort all stops (waypoints + TO) by distance from FROM ──
    // Special case: circular route (FROM === TO) — keep waypoints in their natural order,
    // set routeDest = TO (same as FROM), all waypoints are via points.
    const wpPoiList = wps.map(id => pois.find(x => x.id === id)).filter(Boolean);
    let routeDest, routeVia;
    if (fp.id === tp.id) {
      // Circular: FROM → wp1 → wp2 → ... → FROM
      // Sort waypoints by distance from FROM so route is logical (nearest first)
      const sortedWps = [...wpPoiList].sort((a, b) =>
        haversine(fp.latitude, fp.longitude, a.latitude, a.longitude) -
        haversine(fp.latitude, fp.longitude, b.latitude, b.longitude)
      );
      routeDest = tp;          // destination = FROM again (close the loop)
      routeVia  = sortedWps;   // all waypoints as via
    } else {
      const allStopsSorted = [...wpPoiList, tp].sort((a, b) =>
        haversine(fp.latitude, fp.longitude, a.latitude, a.longitude) -
        haversine(fp.latitude, fp.longitude, b.latitude, b.longitude)
      );
      routeDest = allStopsSorted[allStopsSorted.length - 1]; // farthest = API destination
      routeVia  = allStopsSorted.slice(0, -1);               // all others = via points
    }

    const coords = [
      [fp.longitude, fp.latitude],
      ...routeVia.map(p => [p.longitude, p.latitude]),
      [routeDest.longitude, routeDest.latitude],
    ];
    const coordStr = coords.map(c => `${c[0]},${c[1]}`).join(';');

    if (!geometryOnly) {
      setKmFetching(true);
      setKmError('');
      setKmSanityWarn('');
      setAltIdentical(false);
    }

    // ── HERE Routing API (primary) ──
    const tryHERE = async () => {
      const apiKey = import.meta.env.VITE_HERE_API_KEY;
      if (!apiKey || apiKey === 'YOUR_HERE_API_KEY_HERE') throw new Error('no key');
      const origin = `${fp.latitude},${fp.longitude}`;
      const dest   = `${routeDest.latitude},${routeDest.longitude}`; // farthest stop
      const viaStr = routeVia.map(p => `&via=${p.latitude},${p.longitude}`).join('');
      const base = `https://router.hereapi.com/v8/routes?transportMode=truck&origin=${origin}&destination=${dest}${viaStr}&return=summary,polyline,tolls&currency=INR&apikey=${apiKey}`;
      // Avoid Delhi city proper — west boundary 77.02°E keeps Bahadurgarh (76.92°E) outside the excluded zone
      // Southern edge 28.48°N keeps Gurgaon (28.46°N) outside the excluded zone
      // This forces HERE to use KMP (Western Peripheral) or EPE bypass around Delhi
      const delhiCityAvoid = 'avoid%5Bareas%5D=bbox%3A77.02%2C28.48%2C77.35%2C28.88';
      const [rFast, rShort, rExpr] = await Promise.all([
        fetch(`${base}&routingMode=fast`),
        fetch(`${base}&routingMode=short`),
        fetch(`${base}&routingMode=fast&${delhiCityAvoid}`),
      ]);
      if (!rFast.ok || !rShort.ok) throw new Error('HERE error');
      const [dFast, dShort, dExpr] = await Promise.all([
        rFast.json(), rShort.json(),
        rExpr.ok ? rExpr.json() : Promise.resolve({}),
      ]);
      const fastRoutes  = dFast.routes  || [];
      const shortRoutes = dShort.routes || [];
      const exprRoutes  = dExpr.routes  || [];
      if (!fastRoutes.length) throw new Error('no routes');

      const summarize = r => r.sections.reduce((s, sec) => ({
        distance: s.distance + sec.summary.length,
        duration: s.duration + sec.summary.duration,
        polyline: [...s.polyline, ...(sec.polyline ? decodeHerePolyline(sec.polyline) : [])],
        // fares[] contains multiple payment-method options (cash / transponder / card) — pick cheapest one, don't sum
        tollCost: s.tollCost + (sec.tolls?.reduce((t, toll) =>
          t + Math.min(...(toll.fares?.map(f => f.price?.value || 0) || [0])), 0) || 0),
      }), { distance: 0, duration: 0, polyline: [], tollCost: 0 });

      const hwSummary    = summarize(fastRoutes[0]);
      const localSummary = shortRoutes.length
        ? summarize(shortRoutes.reduce((a, b) =>
            summarize(a).distance < summarize(b).distance ? a : b))
        : hwSummary;

      // Expressway: use avoid-Delhi-city result; discard if same distance as highway (HERE fell back)
      // KMP bypass from Bahadurgarh → Greater Noida can be ~2× direct so allow up to 2.5× highway dist
      let exprSummary = null;
      if (exprRoutes.length) {
        const candidate = summarize(exprRoutes[0]);
        const hwDist    = hwSummary.distance;
        const exDist    = candidate.distance;
        const diff      = Math.abs(exDist - hwDist);
        if (diff > 500 && exDist < hwDist * 2.5) {
          exprSummary = candidate;
        }
      }

      return {
        fastKm:   (hwSummary.distance / 1000).toFixed(1),
        shortKm:  (localSummary.distance / 1000).toFixed(1),
        exprKm:   exprSummary ? (exprSummary.distance / 1000).toFixed(1) : null,
        fastGeom:  hwSummary.polyline,
        shortGeom: localSummary.polyline,
        exprGeom:  exprSummary ? exprSummary.polyline : [],
        hwToll:    Math.round(hwSummary.tollCost),
        exprToll:  exprSummary ? Math.round(exprSummary.tollCost) : 0,
        source: 'HERE',
      };
    };

    // ── OSRM (fallback for km-only — no route geometry drawn) ──
    const tryOSRM = async () => {
      const base = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=false`;
      const res = await fetch(`${base}&alternatives=false`);
      const data = await res.json();
      const hwRoute = data.code === 'Ok' ? data.routes[0] : null;
      if (!hwRoute) throw new Error('OSRM no route');
      const kmVal = (hwRoute.distance / 1000).toFixed(1);
      return {
        fastKm:  kmVal,
        shortKm: kmVal,
        exprKm:  kmVal,
        fastGeom:  [],   // no geometry — HERE unavailable
        shortGeom: [],
        exprGeom:  [],
        source: 'OSRM',
      };
    };

    try {
      let result;
      try {
        result = await tryHERE();
      } catch {
        // HERE failed — use OSRM for distance only, no route lines drawn
        result = await tryOSRM();
      }

      const { fastKm, shortKm, exprKm, fastGeom, shortGeom, exprGeom, source } = result;

      setHighwayGeometry(fastGeom);
      setLocalGeometry(shortGeom);
      // If HERE didn't detect a separate expressway route (route already uses EPE+KMP naturally),
      // fall back to highway route so user can still select the expressway toll tier.
      setExpresswayGeometry(exprGeom.length ? exprGeom : fastGeom);
      setHighwayKm(fastKm);
      setLocalKm(shortKm);
      setExpresswayKm(exprKm || fastKm);

      // Auto-fill toll: always use km × rate per vehicle category for highway/expressway routes
      // Highway rates: Cat1 32/34ft = ₹5.5/km, Cat2 22/24ft = ₹4/km, Cat3 small = ₹3/km
      // Expressway rates: Cat1 32/34ft = ₹7/km (EPE+KMP premium), Cat2 = ₹4/km, Cat3 = ₹3/km
      const TOLL_RATE_HW   = { category_1_32ft_34ft: 5.5, category_2_22ft_24ft: 4, category_3_small: 3 };
      const TOLL_RATE_EXPR = { category_1_32ft_34ft: 7,   category_2_22ft_24ft: 4, category_3_small: 3 };
      const cat = selectedVehicle?.vehicle_size || 'category_1_32ft_34ft';
      const tollRate = mode === 'expressway' ? (TOLL_RATE_EXPR[cat] || 7) : (TOLL_RATE_HW[cat] || 5.5);
      if (!kmManual && !tollCharges) {
        const activeKmVal = parseFloat(mode === 'expressway' ? (exprKm || fastKm) : (mode === 'highway' ? fastKm : shortKm)) || 0;
        const isHWMode = mode === 'highway' || mode === 'expressway';
        if (isHWMode && activeKmVal > 0) {
          const calcToll = Math.round(activeKmVal * tollRate);
          setTollCharges(String(calcToll));
          setTollAutoSource('calc');
          setTollManuallyEdited(false);
        }
      }

      const diffKm = Math.abs(parseFloat(fastKm) - parseFloat(shortKm));
      setAltIdentical(diffKm < 0.5);

      const activeKm   = mode === 'expressway' ? (exprKm || fastKm) : (mode === 'highway' ? fastKm : shortKm);
      const activeGeom = mode === 'expressway' ? (exprGeom.length ? exprGeom : fastGeom) : (mode === 'highway' ? fastGeom : shortGeom);
      if (!geometryOnly) setRouteKm(activeKm);
      if (!geometryOnly) setRouteGeometry(activeGeom);

      if (!geometryOnly) {
        const ratio = parseFloat(activeKm) / straightKm;
        if (ratio > 2.5) {
          setKmSanityWarn(`⚠ ${source} result (${activeKm} km) seems high vs straight-line (${straightKm.toFixed(0)} km). Verify or enter manually.`);
        }
      }
    } catch {
      if (!geometryOnly) {
        setKmError('Road distance fetch failed. Enter manually.');
        setRouteGeometry([]);
        setHighwayGeometry([]);
        setLocalGeometry([]);
      }
    } finally {
      if (!geometryOnly) setKmFetching(false);
    }
  };

  const toggleWaypoint = (poiId) => {
    const updated = waypoints.includes(poiId)
      ? waypoints.filter(id => id !== poiId)
      : [...waypoints, poiId];
    setWaypoints(updated);
    if (fromPOI && toPOI && !kmManual) {
      fetchRoadKm(fromPOI, toPOI, updated, routeMode);
    }
  };

  // ── Step validation ──
  const canNext = [
    () => !!selectedMunshi && !!fromPOI && (isPartialRoute || (!!toPOI && (fromPOI.id !== toPOI.id || waypoints.length > 0))) && !!selectedVehicle,
    () => isPartialRoute || km > 0,
    () => true,
  ];

  // ── Vehicles for selected munshi ──
  const munshiVehicles = selectedMunshi
    ? vehicles.filter(v => v.munshi_id === selectedMunshi.id)
    : [];

  // Pre-vehicle fuel estimate range from munshi's Cat-1 vehicles
  const previewFuelCosts = !selectedVehicle && km > 0
    ? munshiVehicles
        .filter(v => v.vehicle_size === 'category_1_32ft_34ft')
        .map(v => {
          const vk = parseFloat(v.kmpl) || 0;
          const vr = parseFloat(v.fuel_cost_per_liter) || (fuelTypeRates[v.fuel_type] || 0);
          return vk > 0 && vr > 0 ? Math.round(km / vk * vr) : null;
        })
        .filter(Boolean)
    : [];
  const previewFuelMin = previewFuelCosts.length ? Math.min(...previewFuelCosts) : 0;

  const searchFiltered = vehicles.filter(v =>
    v.vehicle_no?.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
    v.driver_name?.toLowerCase().includes(vehicleSearch.toLowerCase())
  );

  // ── Vehicle trip-frequency map from history (vehicle_no → count) ──
  const vehicleFreq = tripHistory.reduce((acc, t) => {
    if (t.vehicle_number) acc[t.vehicle_number] = (acc[t.vehicle_number] || 0) + 1;
    return acc;
  }, {});

  // ── Group vehicles by size, sorted by frequency desc within each group ──
  const vehiclesByCat = munshiVehicles.reduce((acc, v) => {
    const cat = v.vehicle_size || 'unassigned';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(v);
    return acc;
  }, {});
  // Sort each group by trip frequency descending
  Object.keys(vehiclesByCat).forEach(cat => {
    vehiclesByCat[cat].sort((a, b) => (vehicleFreq[b.vehicle_no] || 0) - (vehicleFreq[a.vehicle_no] || 0));
  });

  // Primary-only POIs (from primary_poi_ids on vehicles + munshi itself — not trip history)
  const munshiPrimaryPois = (() => {
    const byId = new Set([
      ...munshiVehicles.flatMap(v => { try { return JSON.parse(v.primary_poi_ids || '[]'); } catch { return []; } }),
      ...(() => { try { return JSON.parse(selectedMunshi?.primary_poi_ids || '[]'); } catch { return []; } })()
    ]);
    return pois.filter(p => byId.has(p.id));
  })();

  // Cities for FROM chips — primary + secondary (dispatch hubs, common to all) cities
  const secondaryPoiCities = pois.filter(p => p.type === 'secondary').map(p => p.city).filter(Boolean);
  const munshiCities = [...new Set(
    munshiPrimaryPois.length > 0
      ? [...munshiPrimaryPois.map(p => p.city), ...secondaryPoiCities].filter(Boolean)
      : cities
  )].sort();

  // Cities for TO chips — past delivery destinations (to_location from trip history)
  // Also include from_location cities so return trips (back to Haier etc.) appear in TO picker
  const munshiToCities = (() => {
    if (tripHistory.length === 0) return cities;
    const citySet = new Set();
    // Method 1: exact POI name match in history → city
    const allNames = new Set([
      ...tripHistory.map(t => t.to_location?.toLowerCase()),
      ...tripHistory.map(t => t.from_location?.toLowerCase()),
    ].filter(Boolean));
    pois.filter(p => allNames.has(p.poi_name?.toLowerCase()))
      .forEach(p => { if (p.city) citySet.add(p.city); });
    // Method 2: parse city directly from last comma-segment of location strings
    // e.g. "Haier Appliances, Greater Noida" → "Greater Noida"
    const allLocs = [
      ...tripHistory.map(t => t.to_location),
      ...tripHistory.map(t => t.from_location),
    ].filter(Boolean);
    allLocs.forEach(loc => {
      const parts = loc.split(',');
      if (parts.length > 1) {
        const cityPart = parts[parts.length - 1].trim();
        const mc = cities.find(c => c.toLowerCase() === cityPart.toLowerCase());
        if (mc) citySet.add(mc);
      }
    });
    const result = [...citySet].sort();
    return result.length > 0 ? result : cities;
  })();

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build stop POIs list for server-side geofence tracking
      const stopPois = [];
      let seq = 0;
      if (fromPOI) stopPois.push({ poi_id: fromPOI.id, poi_name: fromPOI.poi_name, lat: fromPOI.latitude, lon: fromPOI.longitude, radius: fromPOI.radius_meters || 1500, type: 'from', seq: seq++ });
      waypoints.forEach(id => {
        const p = pois.find(x => x.id === id);
        if (p) {
          const overrideAmt = stopUnloadingOverrides[id] !== undefined ? parseFloat(stopUnloadingOverrides[id]) || 0 : null;
          const noUnloadSave = p.type === 'primary' || p.type === 'secondary';
          const configuredAmt = !noUnloadSave && unloadingRates[id] ? parseFloat(unloadingRates[id][vehicleCat]) || 0 : 0;
          const finalUnloadAmt = noUnloadSave ? 0 : (overrideAmt !== null ? overrideAmt : configuredAmt);
          stopPois.push({ poi_id: p.id, poi_name: p.poi_name, lat: p.latitude, lon: p.longitude, radius: p.radius_meters || 1500, type: 'waypoint', seq: seq++, unloading_charge: finalUnloadAmt });
        }
      });
      if (toPOI) stopPois.push({ poi_id: toPOI.id, poi_name: toPOI.poi_name, lat: toPOI.latitude, lon: toPOI.longitude, radius: toPOI.radius_meters || 1500, type: 'to', seq: seq++ });

      const body = {
        client_id: CLIENT_ID,
        munshi_id: selectedMunshi?.id,
        munshi_name: selectedMunshi?.name,
        vehicle_number: selectedVehicle.vehicle_no,
        driver_name: selectedVehicle.driver_name,
        vehicle_size: vehicleCat,
        kmpl: selectedVehicle.kmpl,
        fuel_type: selectedVehicle.fuel_type || '',
        fuel_cost_per_liter: fuelRate,
        from_location: fromPOI.poi_name,
        to_location: toPOI ? toPOI.poi_name : '',
        waypoints_json: JSON.stringify(waypoints.map(id => pois.find(p => p.id === id)?.poi_name).filter(Boolean)),
        route_km: km,
        fuel_litres: parseFloat(fuelLitres),
        fuel_cost: parseFloat(fuelCost),
        unloading_charges: unloadingTotal,
        toll_charges: toll,
        is_highway_route: isHighwayRoute,
        highway_name: isHighwayRoute ? highwayName : '',
        total_expense: parseFloat(totalExpense),
        notes: isHighwayRoute ? `🛣️ Highway route${highwayName ? ` via ${highwayName}` : ''}` : '',
        driver_debit: parseFloat(driverAdvance) || 0,
        munshi_debit: parseFloat(munshiAdvance) || 0,
        is_partial: isPartialRoute,
        empty_return: emptyReturn,
        trip_type: tripType,
        stop_pois: stopPois,
      };
      const res = await fetch(`${API}/trip-dispatches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSaveError('');
        setSavedTrip(data.trip_id || data.group_id);
        if (data.trips) setSavedGroup(data);
        // ── Attempt Part B update (fire-and-forget, won't block dispatch) ──
        fetch(`${API}/ewb/update-partb`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trip_id: data.trip_id,
            ewb_no: ewbNo.trim(),
            vehicle_no: selectedVehicle.vehicle_no,
            from_place: fromPOI?.city || fromPOI?.poi_name || '',
          }),
        })
          .then(r => r.json())
          .then(r => setPartBStatus(r.status || 'skipped'))
          .catch(() => setPartBStatus('skipped'));
        setStep(4);
      } else {
        const msg = data.conflict_trip
          ? `🚫 Vehicle ${selectedVehicle.vehicle_no} is already on an active trip (${data.conflict_trip} · ${data.conflict_status}). Complete or cancel that trip first.`
          : `Error: ${data.error || 'Unknown error'}`;
        setSaveError(msg);
      }
    } catch (e) {
      setSaveError(`Failed to save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Save missing vehicle fields to master ──
  const saveVehicleQuickEdit = async () => {
    if (!selectedVehicle) return;
    setVehicleQuickSaving(true);
    try {
      const patch = {
        // send all existing fields to satisfy the PUT (full-replace endpoint)
        ...selectedVehicle,
        fuel_type: vehicleQuickEdit.fuel_type ?? selectedVehicle.fuel_type ?? '',
        kmpl: vehicleQuickEdit.kmpl ?? selectedVehicle.kmpl ?? null,
        fuel_cost_per_liter: vehicleQuickEdit.fuel_cost_per_liter ?? selectedVehicle.fuel_cost_per_liter ?? null,
      };
      const res = await fetch(`${API}/vehicles-master/${selectedVehicle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.success) {
        // update local vehicles list so computed values immediately reflect
        setVehicles(prev => prev.map(v => v.id === selectedVehicle.id ? { ...v, ...patch } : v));
        setSelectedVehicle(prev => ({ ...prev, ...patch }));
        setVehicleQuickEdit({});
      } else {
        alert('Save failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setVehicleQuickSaving(false);
    }
  };

  const reset = () => {
    setStep(0);
    setSelectedMunshi(null);
    setSelectedVehicle(null);
    setVehicleSearch('');
    setFromCity('');
    setToCity('');
    setFromPOI(null);
    setToPOI(null);
    setWaypoints([]);
    setRouteKm('');
    setSavedTrip(null);
    setShowAllFromPois(false);
    setShowAllToPois(false);
    setFromPoiSearch('');
    setToPoiSearch('');
    setStopCity('');
    setStopPoiSearch('');
    setShowAllStopPois(false);
    setTripHistory([]);
    setKmLearned(null);
    setVehicleQuickEdit({});
    setTollCharges('');
    setTollMode('');
    setTollAutoSource('');
    setTollManuallyEdited(false);
    setStopUnloadingOverrides({});
    setExpresswayKm('');
    setExpresswayGeometry([]);
    setHighwayName('');
    setEwbNo('');
    setPartBStatus(null);
    setEwbAutoMatched(false);
    setIsPartialRoute(false);
    setEmptyReturn(false);
    setDriverAdvance('');
    setMunshiAdvance('');
    setTripType('F');
    setSavedGroup(null);
  };

  // ── Styles ──
  const inputStyle = { width: '100%', padding: '9px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' };
  const sectionTitle = { fontSize: 13, fontWeight: 700, color: '#0066cc', textTransform: 'uppercase', marginBottom: 8 };
  const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', marginBottom: 10 };

  const getPOIsForCity = (city, search = '') => {
    const base = city ? pois.filter(p => p.city === city) : pois;
    const s = search.trim().toLowerCase();
    return (s ? base.filter(p => p.poi_name.toLowerCase().includes(s) || (p.city || '').toLowerCase().includes(s)) : base)
      .sort((a, b) => a.poi_name.localeCompare(b.poi_name));
  };

  return (
    <div style={{ maxWidth: step === 0 ? '100%' : 900, margin: '0 auto', padding: step === 0 ? '16px 12px' : '16px 20px',
      ...(step !== 0 ? { height: 'calc(100vh - 60px)', overflowY: 'auto', boxSizing: 'border-box' } : {}) }}>
      {/* ── Blue Header ── */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', borderRadius: 8, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>🚚 Trip Dispatch</h2>
        <div style={{ color: '#93c5fd', fontSize: 11 }}>Create and dispatch trips step by step</div>
        <button onClick={refreshPois} title="Refresh POI list" style={{ marginLeft: 'auto', padding: '4px 10px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
          🔄 Refresh POIs ({pois.length})
        </button>
      </div>
      {/* ── Stepper Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 0 }}>
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                background: step > i ? '#16a34a' : step === i ? '#0066cc' : '#e2e8f0',
                color: step >= i ? '#fff' : '#64748b',
                transition: 'all 0.2s',
              }}>
                {step > i ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 10, marginTop: 2, color: step === i ? '#0066cc' : '#64748b', fontWeight: step === i ? 700 : 400, textAlign: 'center' }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ height: 2, flex: 1, background: step > i ? '#16a34a' : '#e2e8f0', marginBottom: 20, transition: 'all 0.2s' }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════
          STEP 0 — MUNSHI & VEHICLE
      ════════════════════════════════════════════════════════════ */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 185px)', overflow: 'hidden' }}>

          {/* ── Munshi selector row ── */}
          <div style={{ padding: '6px 0 8px', borderBottom: '2px solid #e2e8f0', display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', paddingRight: 4, flexShrink: 0 }}>MUNSHI</span>
            {munshis.map((m) => (
              <button key={m.id ?? m.name} onClick={() => {
                const mvehicles = vehicles.filter(v => v.munshi_id === m.id);
                const byId = new Set([
                  ...mvehicles.flatMap(v => { try { return JSON.parse(v.primary_poi_ids || '[]'); } catch { return []; } }),
                  ...(() => { try { return JSON.parse(m.primary_poi_ids || '[]'); } catch { return []; } })()
                ]);
                const primaryPois = pois.filter(p => byId.has(p.id));
                setSelectedMunshi(m); setSelectedVehicle(null); setVehicleSearch(''); setVehicleQuickEdit({});
                setToCity(''); setToPOI(null); setShowAllFromPois(false); setShowAllToPois(false);
                setSelectedGridCity(null); setActiveSlot('from');
                if (primaryPois.length === 1) { setFromPOI(primaryPois[0]); setFromCity(primaryPois[0].city || ''); }
                else { setFromCity(''); setFromPOI(null); }
              }} style={{
                padding: '4px 14px', borderRadius: 20, cursor: 'pointer', flexShrink: 0,
                border: selectedMunshi?.id === m.id ? '2px solid #1d4ed8' : '1px solid #cbd5e1',
                background: selectedMunshi?.id === m.id ? '#1d4ed8' : '#fff',
                color: selectedMunshi?.id === m.id ? '#fff' : '#374151',
                fontSize: 11, fontWeight: selectedMunshi?.id === m.id ? 700 : 400,
              }}>
                <span style={{ fontWeight: 700 }}>{m.name}</span>
                <span style={{ fontSize: 9, opacity: 0.75, marginLeft: 5 }}>{m.area}{m.region ? ` · ${m.region}` : ''} · {vehicles.filter(v => v.munshi_id === m.id).length}v</span>
              </button>
            ))}
          </div>

          {!selectedMunshi ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>
              ← Select a munshi above to begin
            </div>
          ) : (() => {
            /* ── Slot helpers ─────────────────────────────────── */
            const routeSlotCols = [
              { key: 'from',     label: 'POI',            sub: 'FROM',       color: '#16a34a' },
              ...waypoints.map((id, i) => ({ key: `stop${i}`, label: `POI${i + 2}`, sub: `STOP ${i + 1}`, color: '#2563eb' })),
              { key: 'nextstop', label: `POI${waypoints.length + 2}`, sub: '+ ADD STOP', color: '#94a3b8', isNew: true },
              {
                key: 'to', label: 'RETURN POI', color: '#dc2626',
                sub: isPartialRoute ? '⏳ ASSIGN LATER' : 'TO',
                isPartialSlot: isPartialRoute,
              },
            ];
            const getSlotPOI = key => {
              if (key === 'from') return fromPOI;
              if (key === 'to') return toPOI;
              if (key === 'nextstop') return null;
              const id = waypoints[parseInt(key.replace('stop', ''))];
              return id ? pois.find(p => p.id === id) : null;
            };
            const assignPOI = (p, key) => {
              if (key === 'from') { setFromPOI(p); setFromCity(p.city || ''); setFromPoiSearch(''); }
              else if (key === 'to') { setToPOI(p); setToCity(p.city || ''); setToPoiSearch(''); }
              else if (key === 'nextstop') setWaypoints(prev => [...prev, p.id]);
              else { const idx = parseInt(key.replace('stop', '')); setWaypoints(prev => { const n = [...prev]; n[idx] = p.id; return n; }); }
            };
            const clearSlot = (key, e) => {
              e && e.stopPropagation();
              if (key === 'from') { setFromPOI(null); setFromCity(''); }
              else if (key === 'to') { setToPOI(null); setToCity(''); }
              else { const idx = parseInt(key.replace('stop', '')); setWaypoints(prev => prev.filter((_, i) => i !== idx)); }
            };
            const isUsedElsewhere = (p, currentSlot) => {
              // FROM and TO can be the same POI (return trip) — only block waypoint duplicates
              if (fromPOI?.id === p.id && currentSlot !== 'from' && currentSlot !== 'to') return true;
              if (toPOI?.id === p.id && currentSlot !== 'to' && currentSlot !== 'from') return true;
              return waypoints.some((id, i) => id === p.id && `stop${i}` !== currentSlot);
            };
            const usedCitySet = new Set([fromPOI?.city, toPOI?.city, ...waypoints.map(id => pois.find(p => p.id === id)?.city)].filter(Boolean));
            const gridCitiesList = [...new Set([...munshiCities, ...munshiToCities])].sort();
            const sortedGridCities = [...gridCitiesList.filter(c => usedCitySet.has(c)), ...gridCitiesList.filter(c => !usedCitySet.has(c))];

            return (
              <>
                {/* ── Trip Type selector ── */}
                <div style={{ padding: '4px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', flexShrink: 0 }}>TRIP TYPE</span>
                  {[{ key: 'F', label: 'Forward', bg: '#16a34a' }, { key: 'R', label: 'Return', bg: '#dc2626' }, { key: 'E', label: 'Extension', bg: '#7c3aed' }, { key: 'C', label: '● Complete', bg: '#0066cc' }].map(t => (
                    <button key={t.key} onClick={() => setTripType(t.key)} style={{
                      padding: '2px 10px', borderRadius: 12, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                      border: tripType === t.key ? `2px solid ${t.bg}` : '1px solid #cbd5e1',
                      background: tripType === t.key ? t.bg : '#fff',
                      color: tripType === t.key ? '#fff' : '#374151',
                    }}>{t.key} · {t.label}</button>
                  ))}
                  <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>
                    {tripType === 'R' ? '↩ Return leg — no unloading charge'
                      : tripType === 'E' ? '➕ Extension — no unloading charge'
                      : tripType === 'C' ? '● Creates linked F + R trips · unloading in F only · advance once'
                      : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* ── LEFT: City sidebar ── */}
                <div style={{ width: 148, background: '#1e3a8a', overflowY: 'auto', flexShrink: 0 }}>
                  <div style={{ padding: '8px 12px', color: '#93c5fd', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>CITY</div>
                  {sortedGridCities.map(city => {
                    const used = usedCitySet.has(city);
                    const cnt = routeSlotCols.filter(sl => getSlotPOI(sl.key)?.city === city).length;
                    const isActive = selectedGridCity === city;
                    return (
                      <div key={city} onClick={() => {
                          setSelectedGridCity(city);
                          setTimeout(() => {
                            const row = document.getElementById(`grid-row-${city.replace(/\s+/g, '-')}`);
                            if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          }, 50);
                        }} style={{ padding: '9px 10px 9px 12px', fontSize: 11, cursor: 'pointer', fontWeight: used || isActive ? 700 : 400, color: isActive ? '#fff' : used ? '#e0f2fe' : '#93c5fd', borderLeft: `4px solid ${isActive ? '#22d3ee' : used ? '#3b82f6' : 'transparent'}`, background: isActive ? 'rgba(34,211,238,0.22)' : used ? 'rgba(29,78,216,0.35)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', transition: 'background 0.15s' }}>
                        <span>{city}</span>
                        {cnt > 0 ? <span style={{ background: '#22d3ee', color: '#0e7490', borderRadius: 8, fontSize: 9, fontWeight: 800, padding: '1px 5px' }}>{cnt}</span> : <span style={{ color: isActive ? '#22d3ee' : '#3b82f6', fontSize: 10 }}>→</span>}
                      </div>
                    );
                  })}
                </div>

                {/* ── CENTER: Slot headers + shared POI list ── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f1f5f9' }}>

                  {/* ── Row 1: Pentagon slot headers ── */}
                  <div style={{ display: 'flex', flexShrink: 0, background: '#1e3a8a' }}>
                    {routeSlotCols.map((slot, i) => {
                      const isActive = activeSlot === slot.key;
                      return (
                        <div key={slot.key} onClick={() => setActiveSlot(slot.key)}
                          style={{
                            flex: '1 1 0', minWidth: 100, padding: '9px 14px 9px ' + (i === 0 ? '14px' : '26px'),
                            background: isActive ? (slot.isNew ? '#475569' : slot.color) : (slot.isNew ? '#334155' : '#1e40af'),
                            borderTop: `4px solid ${slot.color}`,
                            clipPath: i === 0
                              ? 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)'
                              : 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 16px 100%, 0 50%)',
                            marginLeft: i === 0 ? 0 : -2,
                            zIndex: routeSlotCols.length - i,
                            cursor: 'pointer', transition: 'background 0.15s',
                            display: 'flex', flexDirection: 'column', justifyContent: 'center',
                          }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.label}</div>
                          <div style={{ fontSize: 9, color: isActive ? 'rgba(255,255,255,0.85)' : slot.color, marginTop: 2, fontWeight: 700 }}>
                            {isActive ? '▶ ACTIVE' : slot.sub}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Partial route toggle banner ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: isPartialRoute ? '#fef3c7' : '#f0fdf4', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', fontSize: 12, fontWeight: 600, color: isPartialRoute ? '#92400e' : '#15803d' }}>
                      <input
                        type="checkbox"
                        checked={isPartialRoute}
                        onChange={e => {
                          const checked = e.target.checked;
                          setIsPartialRoute(checked);
                          if (checked) {
                            setToPOI(null); setToCity('');
                            setRouteKm(''); setKmManual(false); setKmLearned(null);
                          } else {
                            setKmManual(false);
                          }
                        }}
                        style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#d97706' }}
                      />
                      {isPartialRoute ? '⏳ Half-Route Mode — RETURN POI will be assigned later (Extend Route in Trip Monitor)' : '✅ Full Route — assign both FROM and RETURN POI now'}
                    </label>
                  </div>
                  <div style={{ display: 'flex', flexShrink: 0, borderBottom: '2px solid #e2e8f0', background: '#fff' }}>
                    {routeSlotCols.map(slot => {
                      const sel = getSlotPOI(slot.key);
                      const isActive = activeSlot === slot.key;
                      return (
                        <div key={slot.key} onClick={() => { if (slot.key === 'to' && isPartialRoute) return; setActiveSlot(slot.key); }}
                          style={{ flex: '1 1 0', minWidth: 100, padding: '6px 8px', borderRight: '1px solid #e2e8f0',
                            background: isActive ? slot.color + '0d' : (slot.key === 'to' && isPartialRoute ? '#fef9c3' : '#fff'),
                            borderBottom: isActive ? `2px solid ${slot.color}` : '2px solid transparent',
                            cursor: slot.key === 'to' && isPartialRoute ? 'not-allowed' : 'pointer', transition: 'all 0.15s', minHeight: 46, display: 'flex', alignItems: 'center', opacity: slot.key === 'to' && isPartialRoute ? 0.6 : 1 }}>
                          {slot.key === 'to' && isPartialRoute ? (
                            <span style={{ fontSize: 10, color: '#92400e', fontStyle: 'italic', fontWeight: 600 }}>⏳ Assign later</span>
                          ) : sel ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: slot.color, color: '#fff', borderRadius: 7, padding: '4px 6px 4px 9px', width: '100%', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                              <div style={{ overflow: 'hidden', minWidth: 0 }}>
                                <div style={{ fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>✓ {sel.poi_name.split(',')[0]}</div>
                                <div style={{ fontSize: 9, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {sel.city}
                                  {slot.key === 'to' && (
                                    <label onClick={e => e.stopPropagation()} style={{ marginLeft: 5, display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer', userSelect: 'none' }}>
                                      <input type="checkbox" checked={emptyReturn} onChange={e => setEmptyReturn(e.target.checked)} style={{ width: 9, height: 9, accentColor: '#fca5a5', cursor: 'pointer' }} />
                                      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.05em', color: emptyReturn ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>↩EMPTY</span>
                                    </label>
                                  )}
                                </div>
                              </div>
                              <button onClick={e => clearSlot(slot.key, e)} style={{ background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: '50%', color: '#fff', cursor: 'pointer', fontSize: 10, width: 17, height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>✕</button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 10, color: isActive ? slot.color : '#94a3b8', fontStyle: 'italic', fontWeight: isActive ? 700 : 400 }}>
                              {slot.isNew ? '+ add stop' : `No ${slot.sub}`}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Row 3: Shared POI list from selected city → assigns to activeSlot ── */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
                    {(() => {
                      const slot = routeSlotCols.find(s => s.key === activeSlot) || routeSlotCols[0];
                      const cityPois = selectedGridCity ? pois.filter(p => p.city === selectedGridCity) : [];
                      const avail = cityPois.filter(p => !isUsedElsewhere(p, slot.key));
                      const sel = getSlotPOI(slot.key);
                      if (!selectedGridCity) return (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8, color: '#94a3b8' }}>
                          <span style={{ fontSize: 24 }}>👈</span>
                          <span style={{ fontSize: 13 }}>Click a city on the left</span>
                        </div>
                      );
                      if (avail.length === 0) return (
                        <div style={{ color: '#94a3b8', fontSize: 12, padding: 16, textAlign: 'center' }}>No POIs available in {selectedGridCity}</div>
                      );
                      // ── Build POI frequency map from trip history ──
                      const poiFreq = {};
                      tripHistory.forEach(t => {
                        const locs = [t.from_location, t.to_location];
                        try { const wps = JSON.parse(t.waypoints_json || '[]'); wps.forEach(w => locs.push(w?.poi_name || w?.name || w)); } catch { locs.push(''); }
                        locs.filter(Boolean).forEach(loc => {
                          const locL = loc.toLowerCase();
                          avail.forEach(p => {
                            if (p.poi_name.toLowerCase() === locL || locL.includes(p.poi_name.toLowerCase())) {
                              poiFreq[p.id] = (poiFreq[p.id] || 0) + 1;
                            }
                          });
                        });
                      });
                      // ── Group POIs by brand/client ──
                      const KNOWN_BRANDS = ['HAIER','RELIANCE','SHREEJI','GODREJ','SAMSUNG','WHIRLPOOL','LG','BOSCH','FLIPKART','AMAZON','DMART','BIGBASKET','JIOMART'];
                      const getBrand = (p) => {
                        if (p.poi_category && p.poi_category !== 'general') return p.poi_category.toUpperCase();
                        const name = (p.poi_name || '').toUpperCase();
                        const knownMatch = KNOWN_BRANDS.find(b => name.startsWith(b));
                        if (knownMatch) return knownMatch;
                        return (p.poi_name || '').split(/[\s,]/)[0].toUpperCase() || 'OTHER';
                      };
                      const grouped = {};
                      avail.forEach(p => { const b = getBrand(p); if (!grouped[b]) grouped[b] = []; grouped[b].push(p); });
                      // Merge singleton groups into 'OTHER' only if they aren't known brands
                      const finalGrouped = {};
                      Object.entries(grouped).forEach(([brand, bpois]) => {
                        if (bpois.length === 1 && !KNOWN_BRANDS.includes(brand)) {
                          if (!finalGrouped['OTHER']) finalGrouped['OTHER'] = [];
                          finalGrouped['OTHER'].push(...bpois);
                        } else {
                          finalGrouped[brand] = bpois;
                        }
                      });
                      // Mark brands that have at least one secondary POI (own dispatch hubs — always show first)
                      const hasSecondary = (brand) => (finalGrouped[brand] || []).some(p => p.type === 'secondary');
                      // Sort brand groups: secondary-containing first, then by freq desc, OTHER always last
                      const sortedBrands = Object.keys(finalGrouped).sort((a, b) => {
                        if (a === 'OTHER') return 1; if (b === 'OTHER') return -1;
                        const secA = hasSecondary(a) ? 1 : 0;
                        const secB = hasSecondary(b) ? 1 : 0;
                        if (secB !== secA) return secB - secA; // secondary brands first
                        const freqA = finalGrouped[a].reduce((s, p) => s + (poiFreq[p.id] || 0), 0);
                        const freqB = finalGrouped[b].reduce((s, p) => s + (poiFreq[p.id] || 0), 0);
                        return freqB - freqA;
                      });
                      // Within each brand group: secondary POIs before others, then by freq
                      Object.values(finalGrouped).forEach(bpois => bpois.sort((a, b) => {
                        const secA = a.type === 'secondary' ? 1 : 0;
                        const secB = b.type === 'secondary' ? 1 : 0;
                        if (secB !== secA) return secB - secA;
                        return (poiFreq[b.id] || 0) - (poiFreq[a.id] || 0);
                      }));
                      const brandColors = { 'HAIER':'#1d4ed8','RELIANCE':'#0f766e','SHREEJI':'#b45309','GODREJ':'#0891b2','SAMSUNG':'#1d4ed8','WHIRLPOOL':'#7c3aed','LG':'#c2410c','BOSCH':'#374151','OTHER':'#475569' };
                      // Strip brand prefix from label only for known brands
                      const getLabel = (p, brand) => {
                        if (!KNOWN_BRANDS.includes(brand)) return p.poi_name;
                        const stripped = p.poi_name.replace(new RegExp('^' + brand + '[\\s\\-_]*', 'i'), '').trim();
                        return stripped || p.poi_name;
                      };
                      // Split brands: priority row = has secondary POI OR exactly 1 POI; remainder row = multi-POI primary-only
                      const priorityBrands = sortedBrands.filter(b => hasSecondary(b) || finalGrouped[b].length === 1);
                      const regularBrands  = sortedBrands.filter(b => !hasSecondary(b) && finalGrouped[b].length > 1);
                      const buildItems = (brands) => {
                        const items = [];
                        brands.forEach(brand => {
                          const bpois = finalGrouped[brand];
                          const bc = brandColors[brand] || '#1d4ed8';
                          const brandFreq = bpois.reduce((s, p) => s + (poiFreq[p.id] || 0), 0);
                          items.push({ type: 'brand', brand, bc, count: bpois.length, freq: brandFreq });
                          bpois.forEach(p => items.push({ type: 'poi', p, brand, bc }));
                        });
                        return items;
                      };
                      const renderItems = (items) => items.map((item) => {
                        if (item.type === 'brand') {
                          return (
                            <span key={`brand-${item.brand}`} style={{
                              background: item.bc, color: '#fff', borderRadius: 5,
                              padding: '6px 10px', fontSize: 10, fontWeight: 800,
                              letterSpacing: '0.07em', flexShrink: 0, lineHeight: 1,
                              boxShadow: `0 1px 4px ${item.bc}55`,
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                            }}>
                              {item.brand}
                              {item.freq > 0 && <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 3, padding: '1px 4px', fontSize: 9, fontWeight: 700 }}>{item.freq}✕</span>}
                            </span>
                          );
                        }
                        const { p, bc } = item;
                        const isSelected = sel?.id === p.id;
                        const isSecondary = p.type === 'secondary';
                        const label = getLabel(p, item.brand);
                        const freq = poiFreq[p.id] || 0;
                        return (
                          <button key={p.id} onClick={() => { assignPOI(p, slot.key); }}
                            title={`${p.poi_name}${isSecondary ? ' · own hub' : ''}${freq > 0 ? ` · ${freq} trips` : ''}`}
                            style={{
                              padding: '7px 14px', borderRadius: 6, fontSize: 12,
                              fontWeight: isSelected ? 700 : 600, cursor: 'pointer',
                              border: `2px solid ${isSelected ? bc : isSecondary ? bc : freq > 0 ? bc + '99' : '#bfdbfe'}`,
                              background: isSelected ? bc : isSecondary ? bc + '22' : freq > 0 ? bc + '15' : '#eff6ff',
                              color: isSelected ? '#fff' : '#1e40af',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                  maxWidth: 240, flexShrink: 0,
                                  boxShadow: isSelected ? `0 2px 8px ${bc}55` : isSecondary ? `0 0 0 1px ${bc}44` : 'none',
                                  transition: 'all 0.12s',
                                  position: 'relative',
                                }}>
                                {isSecondary && <span style={{ marginRight: 4, fontSize: 10 }}>🏢</span>}{label}{freq > 1 ? <span style={{ fontSize: 9, opacity: 0.65, marginLeft: 4 }}>{freq}✕</span> : null}
                              </button>
                            );
                          });
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {/* Row 1 — secondary POIs + single-POI brands (priority, always visible in first row) */}
                          {priorityBrands.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, padding: '8px 8px 6px', background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
                              {renderItems(buildItems(priorityBrands))}
                            </div>
                          )}
                          {/* Row 2 — remaining multi-POI brands */}
                          {regularBrands.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, padding: '6px 8px 8px' }}>
                              {renderItems(buildItems(regularBrands))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* ── RIGHT: Expense + Vehicle ── */}
                <div style={{ width: 250, flexShrink: 0, borderLeft: '2px solid #e2e8f0', overflowY: 'auto', background: '#fff', display: 'flex', flexDirection: 'column' }}>

                  {/* Expense panel */}
                  <div style={{ padding: '10px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#1e293b', letterSpacing: '0.07em', marginBottom: 6 }}>EXPENSE</div>
                    {fromPOI && (toPOI || isPartialRoute) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {/* KM row — always visible so it's never missed */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          <span style={{ fontSize: 10, color: '#64748b', flexShrink: 0 }}>
                            {kmFetching ? '⏳' : km > 0 && !kmManual ? '📏 Auto' : '📏 KM'}
                          </span>
                          <input
                            type="number" min="0" placeholder={kmFetching ? '…' : '0'}
                            value={routeKm}
                            onChange={e => { setRouteKm(e.target.value); setKmManual(true); }}
                            style={{ width: 64, padding: '2px 6px', border: `1px solid ${kmManual ? '#7c3aed' : km > 0 ? '#cbd5e1' : '#f59e0b'}`, borderRadius: 4, fontSize: 11, textAlign: 'right', background: kmManual ? '#faf5ff' : '#fff', fontWeight: km > 0 ? 700 : 400 }}
                          />
                          <span style={{ fontSize: 9, color: '#94a3b8' }}>km</span>
                          {km > 0 && <span style={{ fontSize: 9, color: '#64748b' }}>{routeMode === 'expressway' ? '🚀' : routeMode === 'highway' ? '🛣️' : '🏙️'}{isPartialRoute ? '⏳' : ''}</span>}
                        </div>
                        {/* Fuel row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, gap: 4 }}>
                          <span style={{ color: '#64748b', flexShrink: 0 }}>
                            ⛽ Fuel{kmpl > 0 && km > 0 && <span style={{ color: '#94a3b8', fontSize: 9, marginLeft: 3 }}>{(km/kmpl).toFixed(1)}L</span>}
                          </span>
                          {fuelRate > 0 && kmpl > 0 && km > 0
                            ? <span style={{ fontWeight: 700 }}>₹{Number(fuelCost).toLocaleString('en-IN')}</span>
                            : fuelRate === 0 && kmpl > 0 && km > 0
                              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                                  <span style={{ fontSize: 9, color: '#ef4444' }}>₹/L?</span>
                                  <input
                                    type="number" min="0" step="0.5" placeholder="rate"
                                    value={vehicleQuickEdit.fuel_cost_per_liter ?? ''}
                                    onChange={e => setVehicleQuickEdit(p => ({ ...p, fuel_cost_per_liter: e.target.value }))}
                                    onBlur={e => {
                                      const val = parseFloat(e.target.value);
                                      if (val > 0 && effectiveFuelType) {
                                        // Auto-save as master rate for this fuel type so it persists for all future trips
                                        fetch(`${API}/fuel-type-rates/${encodeURIComponent(effectiveFuelType)}`, {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ cost_per_liter: val }),
                                        }).then(r => r.json()).then(() => {
                                          setFuelTypeRates(prev => ({ ...prev, [effectiveFuelType]: val }));
                                        }).catch(() => {});
                                      }
                                    }}
                                    style={{ width: 52, padding: '1px 4px', fontSize: 11, border: '1px solid #ef4444', borderRadius: 4, textAlign: 'right', fontWeight: 700 }}
                                  />
                                </span>
                              : <span style={{ fontWeight: 700, color: '#94a3b8' }}>{previewFuelMin > 0 ? `~₹${previewFuelMin.toLocaleString('en-IN')}` : isPartialRoute && km === 0 ? '← KM' : '—'}</span>
                          }
                        </div>
                        {/* Per-stop unloading rows — always editable; own facilities default to ₹0 but can be overridden */}
                        {waypoints.map(id => {
                          const p = pois.find(x => x.id === id);
                          if (!p) return null;
                          const ownFac = isOwnFacility(p);
                          const configured = !ownFac && unloadingRates[id] ? parseFloat(unloadingRates[id][vehicleCat]) || 0 : 0;
                          const override = stopUnloadingOverrides[id];
                          const displayVal = override !== undefined ? override : (configured > 0 ? String(configured) : '');
                          return (
                            <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, gap: 4 }}>
                              <span style={{ color: '#64748b', fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                📦 {p.poi_name.split(',')[0]}{ownFac && (override === undefined || parseFloat(override) === 0) && <span style={{ color: '#94a3b8', marginLeft: 3 }}>(own)</span>}
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 10, flexShrink: 0 }}>
                                ₹<input
                                  type="number" min="0" placeholder="0"
                                  value={displayVal}
                                  onChange={e => setStopUnloadingOverrides(prev => ({ ...prev, [id]: e.target.value }))}
                                  style={{ width: 46, padding: '1px 3px', fontSize: 11, border: `1px solid ${ownFac && !displayVal ? '#e2e8f0' : '#cbd5e1'}`, borderRadius: 4, outline: 'none', textAlign: 'right', fontWeight: 700, background: ownFac && !displayVal ? '#f8fafc' : '#fff' }}
                                />
                              </span>
                            </div>
                          );
                        })}
                        {toPOI && (() => {
                          const ownFacility = isOwnFacility(toPOI);
                          const noUnload = ownFacility || emptyReturn;
                          const configured = !noUnload && unloadingRates[toPOI.id] ? parseFloat(unloadingRates[toPOI.id][vehicleCat]) || 0 : 0;
                          const override = !noUnload ? stopUnloadingOverrides[toPOI.id] : undefined;
                          const displayVal = override !== undefined ? override : (configured > 0 ? String(configured) : '');
                          return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, gap: 4 }}>
                              <span style={{ color: '#64748b', fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                🏁 {toPOI.poi_name.split(',')[0]}{ownFacility ? <span style={{ color: '#94a3b8', marginLeft: 3 }}>(own)</span> : emptyReturn ? <span style={{ color: '#94a3b8', marginLeft: 3 }}>↩</span> : null}
                              </span>
                              {noUnload
                                ? <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>₹0</span>
                                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 10, flexShrink: 0 }}>
                                    ₹<input
                                      type="number" min="0" placeholder="0"
                                      value={displayVal}
                                      onChange={e => setStopUnloadingOverrides(prev => ({ ...prev, [toPOI.id]: e.target.value }))}
                                      style={{ width: 46, padding: '1px 3px', fontSize: 11, border: '1px solid #cbd5e1', borderRadius: 4, outline: 'none', textAlign: 'right', fontWeight: 700 }}
                                    />
                                  </span>
                              }
                            </div>
                          );
                        })()}
                        {waypoints.length === 0 && !toPOI && unloadingTotal > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ color: '#64748b' }}>🏭 Unloading</span>
                            <span style={{ fontWeight: 700 }}>₹{unloadingTotal.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        {toll > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                            <span style={{ color: '#64748b' }}>💳 Toll</span>
                            <span style={{ fontWeight: 700 }}>₹{toll.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, borderTop: '1px solid #e2e8f0', paddingTop: 5, marginTop: 2, color: '#15803d' }}>
                          <span>💰 Total{tripType === 'C' ? ' (F+R)' : ''}</span>
                          <span>{selectedVehicle && kmpl > 0 && fuelRate > 0 && km > 0 ? `₹${Number(totalExpenseC).toLocaleString('en-IN')}` : previewFuelMin > 0 ? `~₹${(unloadingTotal + toll + previewFuelMin).toLocaleString('en-IN')}` : `₹${unloadingTotal.toLocaleString('en-IN')}`}</span>
                        </div>
                        {canNext[0]?.() && (
                          <button
                            onClick={() => setStep(1)}
                            style={{ marginTop: 8, width: '100%', padding: '7px 0', background: '#0066cc', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Next → Route Details
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>Select POI & RETURN POI to estimate</div>
                    )}
                  </div>

                  {/* Vehicle list */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>VEHICLE{selectedVehicle ? ` — ${selectedVehicle.vehicle_no}` : ''}</span>
                      <button onClick={refreshVehicles} disabled={vehiclesRefreshing} title={vehiclesLoadedAt ? `Loaded ${vehiclesLoadedAt.toLocaleTimeString('en-IN')}` : 'Refresh'} style={{ fontSize: 10, background: 'none', border: '1px solid #cbd5e1', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', color: '#475569' }}>{vehiclesRefreshing ? '⏳' : '🔄'}</button>
                    </div>
                    {!fromPOI || (!toPOI && !isPartialRoute) ? (
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>Select route first</div>
                    ) : munshiVehicles.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {munshiVehicles.map(v => {
                          const histTrips = tripHistory.filter(t => t.vehicle_number === v.vehicle_no);
                          const lastHistDriver = histTrips.length > 0 ? histTrips[0].driver_name : null;
                          const driverMismatch = lastHistDriver && lastHistDriver !== v.driver_name;
                          const syncAge = v.updated_at ? (() => { const s = Math.floor((Date.now() - new Date(v.updated_at.replace(' ', 'T') + 'Z')) / 60000); return s < 60 ? `${s}m ago` : s < 1440 ? `${Math.floor(s/60)}h ago` : `${Math.floor(s/1440)}d ago`; })() : null;
                          return (
                            <button key={v.id} onClick={() => { setSelectedVehicle(v); setVehicleQuickEdit({}); setSaveError(''); }} style={{ padding: '7px 10px', borderRadius: 7, textAlign: 'left', cursor: 'pointer', fontSize: 11, border: selectedVehicle?.id === v.id ? '2px solid #0066cc' : '1px solid #e2e8f0', background: selectedVehicle?.id === v.id ? '#eff6ff' : '#fff' }}>
                              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                {v.vehicle_no}
                                {vehicleFreq[v.vehicle_no] > 0 && <span style={{ fontSize: 9, background: vehicleFreq[v.vehicle_no] >= 5 ? '#dc2626' : '#f97316', color: '#fff', borderRadius: 8, padding: '1px 5px' }}>🔥{vehicleFreq[v.vehicle_no]}</span>}
                                {syncAge && <span style={{ fontSize: 8, color: '#94a3b8', marginLeft: 'auto' }}>{syncAge}</span>}
                              </div>
                              <div style={{ color: '#475569', fontSize: 10 }}>👤 {v.driver_name || '—'} · {v.kmpl ? `${v.kmpl}k` : '?'} · {SIZE_LABELS[v.vehicle_size]?.split(' ')[0] || '?'}</div>
                              {driverMismatch && <div style={{ fontSize: 9, color: '#b45309', fontStyle: 'italic' }}>⚠ Was: {lastHistDriver}</div>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 10, color: '#b45309', marginBottom: 6 }}>No vehicles assigned — search below</div>
                        <input placeholder="Search vehicle / driver..." value={vehicleSearch} onChange={e => setVehicleSearch(e.target.value)} style={{ width: '100%', padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 11, boxSizing: 'border-box' }} />
                        {vehicleSearch.length >= 1 && searchFiltered.slice(0, 8).map(v => (
                          <button key={v.id} onClick={() => { setSelectedVehicle(v); setVehicleQuickEdit({}); setVehicleSearch(''); setSaveError(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 5, background: '#fff', cursor: 'pointer', marginTop: 4, boxSizing: 'border-box' }}>
                            <div style={{ fontWeight: 700 }}>{v.vehicle_no}</div>
                            <div style={{ color: '#64748b', fontSize: 10 }}>{v.driver_name || '—'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Back-route chip */}
                  {selectedVehicle && (() => {
                    const lastTrip = tripHistory.find(t => t.vehicle_number === selectedVehicle.vehicle_no);
                    if (!lastTrip?.to_location) return null;
                    const currentPOI = pois.find(p => p.poi_name?.trim().toLowerCase() === lastTrip.to_location?.trim().toLowerCase());
                    const originPOI  = pois.find(p => p.poi_name?.trim().toLowerCase() === lastTrip.from_location?.trim().toLowerCase());
                    const fromLocParts = (lastTrip.from_location || '').split(',');
                    const fromLocCity  = fromLocParts.length > 1 ? fromLocParts[fromLocParts.length - 1].trim() : fromLocParts[0].trim();
                    const matchedFromCity = cities.find(c => c.toLowerCase() === fromLocCity.toLowerCase());
                    const fromKeyword = fromLocParts[0].trim().toLowerCase();
                    const fuzzyOriginPOI = !originPOI && matchedFromCity ? pois.find(p => p.city?.toLowerCase() === matchedFromCity.toLowerCase() && p.poi_name?.toLowerCase().includes(fromKeyword.split(' ')[0])) : null;
                    const resolvedOriginPOI = originPOI || fuzzyOriginPOI;
                    if (!currentPOI && !resolvedOriginPOI && !matchedFromCity) return null;
                    return (
                      <div style={{ padding: '8px 10px', borderTop: '1px solid #bfdbfe', background: '#eff6ff', flexShrink: 0 }}>
                        <div style={{ fontSize: 10, color: '#1d4ed8', marginBottom: 4 }}>📦 Last: {lastTrip.from_location?.split(',')[0]} → {lastTrip.to_location?.split(',')[0]}</div>
                        <button onClick={() => {
                          if (currentPOI) { setFromPOI(currentPOI); setFromCity(currentPOI.city || ''); }
                          if (resolvedOriginPOI) { setToPOI(resolvedOriginPOI); setToCity(resolvedOriginPOI.city || ''); }
                          else if (matchedFromCity) { setToCity(matchedFromCity); setToPOI(null); }
                        }} style={{ padding: '3px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                          ↩ Return{resolvedOriginPOI ? ` → ${resolvedOriginPOI.poi_name.split(',')[0]}` : matchedFromCity ? ` → ${matchedFromCity}` : ''}
                        </button>
                      </div>
                    );
                  })()}

                  {/* Vehicle quick-edit for missing fields */}
                  {selectedVehicle && (() => {
                    const missingFuelType = !selectedVehicle.fuel_type;
                    const missingKmpl = !selectedVehicle.kmpl || parseFloat(selectedVehicle.kmpl) === 0;
                    const missingRate = !selectedVehicle.fuel_cost_per_liter;
                    const hasMissing = missingFuelType || missingKmpl || missingRate;
                    if (!hasMissing) return null;
                    const editFuelType = vehicleQuickEdit.fuel_type ?? selectedVehicle.fuel_type ?? '';
                    const editKmpl = vehicleQuickEdit.kmpl ?? selectedVehicle.kmpl ?? '';
                    const editRate = vehicleQuickEdit.fuel_cost_per_liter ?? selectedVehicle.fuel_cost_per_liter ?? '';
                    return (
                      <div style={{ padding: '8px 10px', borderTop: '1px solid #fde68a', background: '#fffbeb', flexShrink: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>⚠ Missing vehicle data</div>
                        {missingFuelType && (
                          <select value={editFuelType} onChange={e => setVehicleQuickEdit(p => ({ ...p, fuel_type: e.target.value }))} style={{ width: '100%', padding: '4px 6px', fontSize: 11, border: '1px solid #f59e0b', borderRadius: 5, marginBottom: 4, boxSizing: 'border-box' }}>
                            <option value="">Fuel type?</option>
                            <option value="Diesel">🟤 Diesel</option>
                            <option value="Petrol">🟡 Petrol</option>
                            <option value="CNG">🟢 CNG</option>
                            <option value="Electric">⚡ Electric</option>
                          </select>
                        )}
                        {missingKmpl && <input type="number" min="0" step="0.1" value={editKmpl} onChange={e => setVehicleQuickEdit(p => ({ ...p, kmpl: e.target.value }))} placeholder="kmpl?" style={{ width: '100%', padding: '4px 6px', fontSize: 11, border: '1px solid #f59e0b', borderRadius: 5, marginBottom: 4, boxSizing: 'border-box' }} />}
                        {missingRate && <input type="number" min="0" step="0.5" value={editRate} onChange={e => setVehicleQuickEdit(p => ({ ...p, fuel_cost_per_liter: e.target.value }))} placeholder="₹/litre (optional)" style={{ width: '100%', padding: '4px 6px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 5, marginBottom: 4, boxSizing: 'border-box' }} />}
                        <button onClick={saveVehicleQuickEdit} disabled={vehicleQuickSaving} style={{ width: '100%', padding: '5px', background: vehicleQuickSaving ? '#9ca3af' : '#0066cc', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: vehicleQuickSaving ? 'wait' : 'pointer', boxSizing: 'border-box' }}>
                          {vehicleQuickSaving ? '⏳ Saving…' : '💾 Save to Master'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
              </>
            );
          })()}
        </div>
      )}


      {step === 1 && (
        <div>
          {/* Route summary bar */}
          <div style={{ background: isPartialRoute ? '#fffbeb' : '#f0f9ff', border: `1px solid ${isPartialRoute ? '#fde68a' : '#bae6fd'}`, borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontWeight: 700, color: '#0c4a6e' }}>📍 {fromPOI?.poi_name}</span>
            <span style={{ color: '#94a3b8' }}>→</span>
            <span style={{ fontWeight: 700, color: isPartialRoute ? '#b45309' : '#0c4a6e' }}>{isPartialRoute ? '⏳ RETURN POI — assign later' : `📍 ${toPOI?.poi_name}`}</span>
            <span style={{ color: '#64748b', marginLeft: 'auto', fontSize: 12 }}>{selectedVehicle?.vehicle_no} · {selectedMunshi?.name}</span>
          </div>

          {/* WAYPOINTS */}
          {fromPOI && (
            <div style={card}>
              <p style={sectionTitle}>Intermediate Stops (Optional)</p>

              {/* ── Added stops as removable chips (sorted nearest→farthest from FROM) ── */}
              {(() => {
                if (waypoints.length === 0) return null;
                // Sort waypoints by distance from FROM for display + route order
                const dist = p => Math.hypot(p.latitude - fromPOI.latitude, p.longitude - fromPOI.longitude);
                const toDist = toPOI ? dist(toPOI) : Infinity;
                const sortedIds = [...waypoints].sort((a, b) => {
                  const pa = pois.find(x => x.id === a);
                  const pb = pois.find(x => x.id === b);
                  if (!pa || !pb) return 0;
                  return dist(pa) - dist(pb);
                });
                // Build full route path: insert TO in its correct position among stops
                const allPoints = [
                  { label: fromPOI.poi_name.split(',')[0], type: 'from' },
                  ...sortedIds.map(id => {
                    const p = pois.find(x => x.id === id);
                    const isExtension = p && dist(p) > toDist;
                    return { id, label: p?.poi_name.split(',')[0], city: p?.city, type: isExtension ? 'ext' : 'stop', p };
                  }).reduce((acc, item) => {
                    // Insert TO before first extension stop (only when TO is known)
                    if (toPOI && item.type === 'ext' && !acc.find(x => x.type === 'to'))
                      acc.push({ label: toPOI.poi_name.split(',')[0], type: 'to' });
                    acc.push(item);
                    return acc;
                  }, []),
                ];
                // Add TO at end if no extension stops
                if (toPOI && !allPoints.find(x => x.type === 'to'))
                  allPoints.push({ label: toPOI.poi_name.split(',')[0], type: 'to' });
                else if (!toPOI)
                  allPoints.push({ label: '⏳ Assign later', type: 'to' });

                const hasExtensions = sortedIds.some(id => { const p = pois.find(x => x.id === id); return p && dist(p) > toDist; });

                // Stop counter (only for stop/ext types, not from/to)
                let stopNum = 0;
                return (
                  <div style={{ marginBottom: 10 }}>
                    {/* Route path breadcrumb */}
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 8,
                      padding: '6px 10px', background: '#f8fafc', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 11 }}>
                      {allPoints.map((pt, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span style={{ color: '#94a3b8' }}>→</span>}
                          <span style={{
                            fontWeight: pt.type === 'from' || pt.type === 'to' ? 700 : 600,
                            color: pt.type === 'from' ? '#16a34a' : pt.type === 'to' ? '#dc2626' : pt.type === 'ext' ? '#7c3aed' : '#1d4ed8',
                            background: pt.type === 'ext' ? '#f5f3ff' : 'transparent',
                            padding: pt.type === 'ext' ? '1px 5px' : 0, borderRadius: 4,
                          }}>
                            {pt.type === 'ext' ? '📍' : pt.type === 'stop' ? '🔵' : ''}{pt.label}
                            {pt.type === 'ext' && <span style={{ fontSize: 9, marginLeft: 3, color: '#7c3aed' }}>EXT</span>}
                          </span>
                        </React.Fragment>
                      ))}
                      {hasExtensions && <span style={{ fontSize: 10, color: '#7c3aed', marginLeft: 4, fontStyle: 'italic' }}>route extends beyond TO</span>}
                    </div>
                    {/* Stop chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {sortedIds.map(id => {
                        const p = pois.find(x => x.id === id);
                        if (!p) return null;
                        const isExt = dist(p) > toDist;
                        stopNum++;
                        const noUnloadChip = p.type === 'primary' || p.type === 'secondary';
                        const preConfigured = !noUnloadChip && unloadingRates[id] ? parseFloat(unloadingRates[id][vehicleCat]) || 0 : 0;
                        const overrideVal = !noUnloadChip ? stopUnloadingOverrides[id] : undefined;
                        const chargeDisplay = overrideVal !== undefined ? overrideVal : (preConfigured > 0 ? String(preConfigured) : '');
                        return (
                          <span key={id} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            background: isExt ? '#f5f3ff' : '#eff6ff',
                            border: `1px solid ${isExt ? '#c4b5fd' : '#bfdbfe'}`,
                            borderRadius: 14, padding: '3px 10px', fontSize: 12, fontWeight: 600,
                            color: isExt ? '#6d28d9' : '#1d4ed8'
                          }}>
                            {isExt ? '📍' : '🔵'} {isExt ? 'Ext' : 'Stop'} {stopNum}: {p.poi_name.split(',')[0]}
                            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>{p.city}</span>
                            {noUnloadChip
                              ? <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400 }}>₹0</span>
                              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 11, fontWeight: 400, color: '#475569' }}>
                                  ₹<input
                                    type="number" min="0" placeholder="unload"
                                    value={chargeDisplay}
                                    onChange={e => setStopUnloadingOverrides(prev => ({ ...prev, [id]: e.target.value }))}
                                    onClick={e => e.stopPropagation()}
                                    style={{ width: 52, padding: '1px 4px', fontSize: 11, border: '1px solid #bfdbfe', borderRadius: 4, outline: 'none', background: '#fff', color: '#1e293b', fontWeight: 400 }}
                                  />
                                </span>
                            }
                            <button onClick={() => toggleWaypoint(id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, padding: '0 0 0 2px', lineHeight: 1 }}>✕</button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ── City chips ── */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                {(showAllStopPois ? cities : munshiToCities).map(city => (
                  <button key={city}
                    onClick={() => { setStopCity(city === stopCity ? '' : city); setStopPoiSearch(''); }}
                    style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                      fontWeight: stopCity === city ? 700 : 400,
                      border: stopCity === city ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                      background: stopCity === city ? '#f5f3ff' : '#f8fafc',
                      color: stopCity === city ? '#6d28d9' : '#374151' }}>
                    {city}
                  </button>
                ))}
                {!showAllStopPois && munshiToCities.length < cities.length && (
                  <button onClick={() => { setShowAllStopPois(true); setStopCity(''); }}
                    style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer', border: '1px dashed #94a3b8', background: '#f8fafc', color: '#475569' }}>All cities ▸</button>
                )}
                {showAllStopPois && (
                  <button onClick={() => { setShowAllStopPois(false); setStopCity(''); }}
                    style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer', border: '1px dashed #94a3b8', background: '#f8fafc', color: '#7c3aed' }}>← Less</button>
                )}
              </div>

              {/* ── Search box ── */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <input value={stopPoiSearch}
                  onChange={e => { setStopPoiSearch(e.target.value); if (e.target.value) setStopCity(''); }}
                  placeholder={stopCity ? `Search in ${stopCity}…` : 'Search stop name…'}
                  style={{ flex: 1, padding: '5px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12 }} />
                {(stopPoiSearch || stopCity) && (
                  <button onClick={() => { setStopPoiSearch(''); setStopCity(''); }}
                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 11, cursor: 'pointer', color: '#64748b' }}>✕</button>
                )}
              </div>

              {/* ── POI list (visible when city selected or searching) ── */}
              {(stopCity || stopPoiSearch) && (
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff' }}>
                  {getPOIsForCity(stopCity, stopPoiSearch)
                    .filter(p => p.id !== fromPOI.id && (!toPOI || p.id !== toPOI.id))
                    .map(p => {
                      const added = waypoints.includes(p.id);
                      return (
                        <div key={p.id}
                          onClick={() => { toggleWaypoint(p.id); }}
                          style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 12,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            borderBottom: '1px solid #f1f5f9',
                            background: added ? '#eff6ff' : '#fff' }}
                          onMouseEnter={e => { if (!added) e.currentTarget.style.background = '#f5f3ff'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = added ? '#eff6ff' : '#fff'; }}>
                          <span style={{ fontWeight: added ? 700 : 500, color: added ? '#1d4ed8' : '#1e293b' }}>
                            {added ? '✓ ' : '+ '}{p.poi_name}
                          </span>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>{!stopCity && p.city}</span>
                        </div>
                      );
                    })}
                  {getPOIsForCity(stopCity, stopPoiSearch).filter(p => p.id !== fromPOI.id && (!toPOI || p.id !== toPOI.id)).length === 0 && (
                    <div style={{ padding: '8px 10px', color: '#94a3b8', fontSize: 12 }}>No POIs found</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* KM display */}
          {fromPOI && (
            <div style={card}>
              <p style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>Road Distance{isPartialRoute ? ' (Estimated — TO not set)' : ''}</span>
                {!isPartialRoute && kmFetching && <span style={{ fontWeight: 400, color: '#0066cc' }}>⏳ Calculating via OSRM...</span>}
                {!isPartialRoute && kmLearned && !kmManual && (
                  <span style={{ fontWeight: 600, color: '#7c3aed', background: '#f3e8ff', borderRadius: 10, padding: '1px 9px', fontSize: 11 }}>
                    📚 Learned · {kmLearned.dispatches} trip{kmLearned.dispatches !== 1 ? 's' : ''}
                  </span>
                )}
                {!isPartialRoute && !kmFetching && !kmLearned && routeKm && !kmError && !kmManual && <span style={{ fontWeight: 400, color: '#16a34a' }}>✅ Auto-filled</span>}
                {kmManual && <span style={{ fontWeight: 400, color: '#7c3aed' }}>{isPartialRoute ? '⏳ Half-route estimate' : '✏️ Manual entry'}</span>}
                {!isPartialRoute && kmLearned && !kmManual && (
                  <button
                    onClick={() => { setKmLearned(null); setRouteKm(''); fetchRoadKm(fromPOI, toPOI, waypoints, useHighway); }}
                    style={{ padding: '2px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: 'pointer', border: '1px solid #0066cc', background: '#fff', color: '#0066cc' }}
                  >
                    🔄 Re-check via OSRM
                  </button>
                )}
                {!isPartialRoute && (
                  <button
                    onClick={() => {
                      if (kmManual) {
                        setKmManual(false);
                        setKmLearned(null);
                        setRouteKm('');
                        fetchRoadKm(fromPOI, toPOI, waypoints, useHighway);
                      } else {
                        setKmManual(true);
                      }
                    }}
                    style={{
                      marginLeft: kmLearned ? 0 : 'auto', padding: '3px 12px', fontSize: 12, fontWeight: 600, borderRadius: 5, cursor: 'pointer', border: 'none',
                      background: kmManual ? '#7c3aed' : '#e2e8f0',
                      color: kmManual ? '#fff' : '#475569',
                    }}
                  >
                    {kmManual ? '🔄 Use Auto' : '✏️ Enter Manually'}
                  </button>
                )}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <input
                  type="number" min="0" step="0.1"
                  value={routeKm}
                  onChange={e => setRouteKm(e.target.value)}
                  onFocus={() => setKmManual(true)}
                  placeholder={kmFetching ? 'Calculating...' : 'Enter KM'}
                  style={{ ...inputStyle, width: 160, background: kmManual ? '#faf5ff' : kmFetching ? '#f0f8ff' : '#fff', border: kmManual ? '1px solid #7c3aed' : '1px solid #ccc' }}
                />
                <span style={{ fontSize: 13, color: '#475569' }}>km (road)</span>
                {routeGeometry.length > 0 && (
                  <button
                    onClick={() => { setRouteGeometry([]); setHighwayGeometry([]); setLocalGeometry([]); setShowMap(true); fetchRoadKm(fromPOI, toPOI, waypoints, useHighway, false); }}
                    style={{ padding: '7px 16px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    🗺 View on Map
                  </button>
                )}
              </div>
              {kmError && !kmManual && <small style={{ color: '#cc0000', fontSize: 11 }}>⚠ {kmError}</small>}
              {kmSanityWarn && !kmManual && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: '#fef9c3', border: '1px solid #fcd34d', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
                  {kmSanityWarn}
                  <button
                    onClick={() => { setKmManual(true); setKmSanityWarn(''); }}
                    style={{ marginLeft: 10, padding: '2px 10px', fontSize: 11, background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                  >✏️ Enter correct KM</button>
                </div>
              )}
              {altIdentical && !kmManual && routeKm && (
                <div style={{ marginTop: 8, padding: '7px 12px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>⚡ OSRM found only one path for this POI pair with {vehicleCat.replace('category_', '').replace(/_/g, '/')} vehicle — using as one-way route ({routeKm} km)</span>
                </div>
              )}

              {/* Route type selector — Highway / Local / Expressway (bypass Delhi) */}
              {/* Show for all vehicles — small/medium also need expressway option on long routes (>40km forced highway) */}
              {(isBigVehicle || parseFloat(km) > 40) && (
                <div style={{ marginTop: 14, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Route Type</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { m: 'highway',    icon: '🛣️',  label: 'Highway',    optKm: highwayKm,    color: '#92400e', bg: '#fffbeb', border: '#f59e0b' },
                      { m: 'local',      icon: '🏙️',  label: 'Local',      optKm: localKm,      color: '#1d4ed8', bg: '#eff6ff', border: '#2563eb' },
                      { m: 'expressway', icon: '🚀',  label: 'Expressway', optKm: expresswayKm, color: '#5b21b6', bg: '#f5f3ff', border: '#7c3aed' },
                    ].map(({ m, icon, label, optKm, color, bg, border }) => {
                      // Expressway enabled whenever highway KM is available — user can choose
                      // expressway toll tier (₹7/km) even when the highway route already uses EPE+KMP
                      const exprOk = m !== 'expressway' || !!expresswayKm;
                      return (
                      <button key={m}
                        disabled={!exprOk}
                        title={!exprOk && m === 'expressway' ? 'Not available — expressway (EPE+KMP Delhi bypass) not detected for this route' : ''}
                        onClick={() => {
                          if (!exprOk) return;
                          highwayManualRef.current = true;
                          setRouteMode(m);
                          const newKm = m === 'expressway' ? expresswayKm : (m === 'highway' ? highwayKm : localKm);
                          const newGeom = m === 'expressway' ? expresswayGeometry : (m === 'highway' ? highwayGeometry : localGeometry);
                          if (newKm) setRouteKm(newKm);
                          if (newGeom.length) setRouteGeometry(newGeom);
                          if (m !== 'highway') setHighwayName('');
                          if (m === 'expressway') setHighwayName(
                            // WPE (KMP) for FROM west of Delhi (e.g. Bahadurgarh ~76.9°E)
                            fromPOI?.longitude < 77.0
                              ? 'Western Peripheral Expressway (KMP)'
                              : 'Eastern Peripheral Expressway + KMP'
                          );
                        }}
                        style={{ flex: 1, padding: '7px 8px', borderRadius: 7,
                          cursor: exprOk ? 'pointer' : 'not-allowed',
                          fontWeight: routeMode === m ? 700 : 400, fontSize: 12,
                          border: `2px solid ${routeMode === m ? border : '#e2e8f0'}`,
                          background: routeMode === m ? bg : !exprOk ? '#f8fafc' : '#fff',
                          color: routeMode === m ? color : !exprOk ? '#cbd5e1' : '#64748b',
                          opacity: !exprOk ? 0.55 : 1,
                        }}
                      >
                        {icon} {label}{optKm ? ` · ${optKm}km` : (!exprOk && m === 'expressway' ? ' · N/A' : '')}
                        {routeMode === m && <span style={{ marginLeft: 5, background: border, color: '#fff', borderRadius: 8, padding: '1px 6px', fontSize: 10 }}>✓</span>}
                      </button>
                      );
                    })}
                  </div>
                  {(routeMode === 'highway' || routeMode === 'expressway') && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 12, color: '#92400e', fontWeight: 600, minWidth: 90 }}>via:</label>
                      <input
                        type="text"
                        list="highway-options"
                        value={highwayName}
                        onChange={e => setHighwayName(e.target.value)}
                        placeholder="e.g. KMP / NH-48 / Palwal Peripheral..."
                        style={{ flex: 1, padding: '5px 10px', border: '1px solid #fbbf24', borderRadius: 5, fontSize: 12 }}
                      />
                      <datalist id="highway-options">
                        <option value="KMP Expressway (Kundli-Manesar-Palwal)" />
                        <option value="Eastern Peripheral Expressway (NH-334B)" />
                        <option value="Eastern Peripheral Expressway + KMP" />
                        <option value="Palwal Peripheral Expressway" />
                        <option value="NH-48 (Delhi-Gurugram-Jaipur)" />
                        <option value="NH-44 (Delhi-Panipat)" />
                        <option value="NH-58 (Delhi-Meerut)" />
                        <option value="Western Peripheral Expressway" />
                        <option value="Yamuna Expressway" />
                        <option value="Delhi-Meerut Expressway" />
                        <option value="Agra-Lucknow Expressway" />
                      </datalist>
                    </div>
                  )}
                  {km > 25 && routeMode === 'local' && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>⚠ {km} km — highway recommended for long routes</div>
                  )}
                </div>
              )}

              {/* ── Toll Charges ── */}
              <div style={{ marginTop: 14, padding: '12px 14px', background: toll > 0 ? '#f0fdf4' : '#f8fafc', border: `2px solid ${toll > 0 ? '#16a34a' : '#e2e8f0'}`, borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>🛣️</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: toll > 0 ? '#15803d' : '#475569' }}>Toll Charges</span>
                  {toll > 0 && <span style={{ fontSize: 11, background: '#16a34a', color: '#fff', borderRadius: 10, padding: '2px 9px', fontWeight: 600 }}>₹{toll.toLocaleString('en-IN')}{tollMode ? (tollMode === 'card' ? ' 💳 card' : ' 💵 cash') : ''}</span>}
                  {tollAutoSource === 'learned' && <span style={{ fontSize: 10, color: '#0369a1', background: '#e0f2fe', borderRadius: 8, padding: '1px 7px', fontWeight: 600 }}>📚 From memory</span>}
                  {tollAutoSource === 'calc' && <span style={{ fontSize: 10, color: '#7c3aed', background: '#f3e8ff', borderRadius: 8, padding: '1px 7px', fontWeight: 600 }}>🧮 {routeMode === 'expressway' ? (vehicleCat === 'category_1_32ft_34ft' ? '₹7' : vehicleCat === 'category_2_22ft_24ft' ? '₹4' : '₹3') : (vehicleCat === 'category_1_32ft_34ft' ? '₹5.5' : vehicleCat === 'category_2_22ft_24ft' ? '₹4' : '₹3')}/km · auto</span>}
                </div>
                {/* Amount input — always visible */}
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: 13, color: '#475569', fontWeight: 600, minWidth: 100 }}>Amount (₹):</label>
                  <input
                    type="number" min="0" step="10"
                    value={tollCharges}
                    onChange={e => { setTollCharges(e.target.value); setTollAutoSource(''); setTollManuallyEdited(true); }}
                    placeholder="0 — enter if applicable"
                    style={{ width: 160, padding: '6px 10px', border: `1px solid ${toll > 0 ? '#86efac' : '#cbd5e1'}`, borderRadius: 5, fontSize: 13 }}
                  />
                  {tollCharges && (
                    <button onClick={() => { setTollCharges(''); setTollMode(''); setTollAutoSource(''); setTollManuallyEdited(false); }}
                      style={{ padding: '5px 10px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>✕</button>
                  )}
                </div>
                {/* Cash / Card toggle — optional, show only when amount entered */}
                {toll > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    {[{ key: 'cash', icon: '💵', label: 'Cash' }, { key: 'card', icon: '💳', label: 'Card' }].map(({ key, icon, label }) => (
                      <button key={key} onClick={() => setTollMode(tollMode === key ? '' : key)}
                        style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: tollMode === key ? 700 : 400,
                          border: `1.5px solid ${tollMode === key ? (key === 'card' ? '#7c3aed' : '#0066cc') : '#e2e8f0'}`,
                          background: tollMode === key ? (key === 'card' ? '#f5f3ff' : '#eff6ff') : '#fff',
                          color: tollMode === key ? (key === 'card' ? '#5b21b6' : '#1d4ed8') : '#64748b' }}
                      >{icon} {label}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          STEP 2 — EXPENSE SUMMARY
      ════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div>
          <div style={card}>
            <p style={{ ...sectionTitle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Route Summary</span>
              {routeGeometry.length > 0 && !isPartialRoute && (
                <button
                  onClick={() => { setRouteGeometry([]); setHighwayGeometry([]); setLocalGeometry([]); setShowMap(true); fetchRoadKm(fromPOI, toPOI, waypoints, useHighway, false); }}
                  style={{ padding: '4px 12px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  🗺 View on Map
                </button>
              )}
            </p>
            {isPartialRoute && (
              <div style={{ marginBottom: 8, padding: '6px 10px', background: '#fef3c7', borderRadius: 6, fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                ⚠ Half-Route — RETURN POI not set. Expenses based on estimated KM.
              </div>
            )}
            <div style={{ fontSize: 13, lineHeight: 2 }}>
              <span style={{ color: '#475569' }}>Route: </span>
              <strong>{fromPOI.poi_name}</strong>
              {waypoints.length > 0 && (
                <> → <span style={{ color: '#0066cc' }}>{waypoints.length} stops</span></>
              )}
              <> → <strong>{toPOI ? toPOI.poi_name : '⏳ Assign later (Half-Route)'}</strong></>
              <br />
              <span style={{ color: '#475569' }}>Road Distance: </span><strong>{km} km</strong>
              {isHighwayRoute && (
                <span style={{ marginLeft: 10, background: routeMode === 'expressway' ? '#7c3aed' : '#f59e0b', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                  {routeMode === 'expressway' ? '🚀 VIA EXPRESSWAY' : '🛣️ VIA HIGHWAY'}
                </span>
              )}
              <br />
              <span style={{ color: '#475569' }}>Vehicle: </span><strong>{selectedVehicle.vehicle_no}</strong>
              <span style={{ color: '#475569', marginLeft: 12 }}>Driver: </span><strong>{selectedVehicle.driver_name || '—'}</strong>
              <br />
              <span style={{ color: '#475569' }}>Munshi: </span><strong>{selectedMunshi?.name || '—'}</strong>
              <span style={{ color: '#475569', marginLeft: 12 }}>Vehicle Size: </span><strong>{SIZE_LABELS[vehicleCat] || vehicleCat}</strong>
            </div>
          </div>

          <div style={card}>
            <p style={sectionTitle}>Expense Breakdown</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 0', color: '#475569' }}>Fuel consumption</td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>
                    {km} km ÷{' '}
                    {kmpl > 0 ? `${kmpl} kmpl` : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <input
                          type="number" min="0" step="0.5" placeholder="kmpl?"
                          value={vehicleQuickEdit.kmpl ?? ''}
                          onChange={e => setVehicleQuickEdit(p => ({ ...p, kmpl: e.target.value }))}
                          style={{ width: 60, padding: '2px 5px', fontSize: 12, border: '1px solid #f59e0b', borderRadius: 4, textAlign: 'right' }}
                        />
                        <span style={{ fontSize: 11, color: '#b45309' }}>kmpl ⚠</span>
                      </span>
                    )}{' '}
                    = <strong>{kmpl > 0 ? `${fuelLitres} L` : '—'}</strong>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 0', color: '#475569' }}>Fuel cost</td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>
                    {effectiveFuelType && (
                      <span style={{ fontSize: 10, background: '#f1f5f9', padding: '1px 6px', borderRadius: 8, marginRight: 6, fontWeight: 600 }}>
                        {(effectiveFuelType||'').toUpperCase() === 'DIESEL' ? '🟤' : (effectiveFuelType||'').toUpperCase() === 'PETROL' ? '🟡' : (effectiveFuelType||'').toUpperCase() === 'CNG' ? '🟢' : '⚡'} {effectiveFuelType}
                        {fuelRateSource === 'master' && <span style={{ color: '#64748b', fontWeight: 400, marginLeft: 4 }}>(master rate)</span>}
                      </span>
                    )}
                    {fuelLitres} L × ₹{fuelRate > 0 ? fuelRate : (
                      <input
                        type="number" min="0" step="0.5" placeholder="₹/L?"
                        value={vehicleQuickEdit.fuel_cost_per_liter ?? ''}
                        onChange={e => setVehicleQuickEdit(p => ({ ...p, fuel_cost_per_liter: e.target.value }))}
                        style={{ width: 65, padding: '2px 5px', fontSize: 12, border: '1px solid #ef4444', borderRadius: 4, textAlign: 'right', display: 'inline-block' }}
                      />
                    )}/L = <strong>₹{fuelRate > 0 && kmpl > 0 ? fuelCost : '—'}</strong>
                    {fuelRate === 0 && (
                      <span style={{ display: 'block', fontSize: 10, color: '#b91c1c', marginTop: 2 }}>⚠ Enter rate above · <button onClick={saveVehicleQuickEdit} disabled={vehicleQuickSaving || !vehicleQuickEdit.fuel_cost_per_liter} style={{ fontSize: 10, padding: '1px 6px', border: '1px solid #b91c1c', borderRadius: 4, background: '#fff', color: '#b91c1c', cursor: 'pointer' }}>{vehicleQuickSaving ? '⏳' : '💾 Save'}</button></span>
                    )}
                  </td>
                </tr>
                {waypoints.map(id => {
                  const p = pois.find(x => x.id === id);
                  const noUnload = p?.type === 'primary' || p?.type === 'secondary';
                  const configured = !noUnload && unloadingRates[id] ? parseFloat(unloadingRates[id][vehicleCat]) || 0 : 0;
                  const override = !noUnload ? stopUnloadingOverrides[id] : undefined;
                  const charge = noUnload ? 0 : (override !== undefined ? (parseFloat(override) || 0) : configured);
                  const isOverridden = !noUnload && override !== undefined && parseFloat(override) !== configured;
                  return p ? (
                    <tr key={id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: '#475569' }}>
                        Unloading — {p.poi_name.split(',')[0]}
                        {noUnload && <span style={{ marginLeft: 6, fontSize: 10, color: '#94a3b8' }}>(own facility)</span>}
                        {tripType === 'C' && !noUnload && <span style={{ marginLeft: 6, fontSize: 10, color: '#0066cc', fontWeight: 600 }}>F-leg only</span>}
                        {isOverridden && <span style={{ marginLeft: 6, fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>✏️ manual</span>}
                      </td>
                      <td style={{ padding: '10px 0', textAlign: 'right' }}>
                        <strong style={{ color: charge > 0 ? '#166534' : '#94a3b8' }}>
                          {noUnload ? '₹0' : charge > 0 ? `₹${charge.toLocaleString('en-IN')}` : '—'}
                        </strong>
                      </td>
                    </tr>
                  ) : null;
                })}
                {toPOI && (() => {
                  if (isOwnFacility(toPOI) || emptyReturn) return null;
                  const configured = unloadingRates[toPOI.id] ? parseFloat(unloadingRates[toPOI.id][vehicleCat]) || 0 : 0;
                  const override = stopUnloadingOverrides[toPOI.id];
                  const charge = override !== undefined ? (parseFloat(override) || 0) : configured;
                  const isOverridden = override !== undefined && parseFloat(override) !== configured;
                  return charge > 0 ? (
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 0', color: '#475569' }}>
                        Unloading — {toPOI.poi_name.split(',')[0]} (destination)
                        {tripType === 'C' && <span style={{ marginLeft: 6, fontSize: 10, color: '#0066cc', fontWeight: 600 }}>F-leg only</span>}
                        {isOverridden && <span style={{ marginLeft: 6, fontSize: 10, color: '#7c3aed', fontWeight: 600 }}>✏️ manual</span>}
                      </td>
                      <td style={{ padding: '10px 0', textAlign: 'right' }}>
                        <strong style={{ color: '#166534' }}>₹{charge.toLocaleString('en-IN')}</strong>
                      </td>
                    </tr>
                  ) : null;
                })()}
              {toll > 0 && (
                <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f0fdf4' }}>
                  <td style={{ padding: '10px 0', color: '#15803d' }}>
                    {tollMode === 'card' ? '💳' : '💵'} Toll {tollMode === 'card' ? '(Through Card)' : tollMode === 'cash' ? '(Cash)' : 'Charges'}{isHighwayRoute && highwayName ? ` — ${highwayName}` : ''}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>
                    <strong style={{ color: '#15803d' }}>₹{toll.toLocaleString('en-IN')}</strong>
                  </td>
                </tr>
              )}
                {tripType === 'C' && (
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#eff6ff' }}>
                    <td style={{ padding: '8px 0', color: '#1e40af', fontSize: 11 }}>
                      ↩ Return leg (fuel only — unloading charged once in F leg)
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: '#1e40af', fontSize: 11, fontWeight: 700 }}>
                      +₹{(parseFloat(fuelCost) + toll).toLocaleString('en-IN')}
                    </td>
                  </tr>
                )}
                <tr style={{ background: '#f0f9ff', fontWeight: 700 }}>
                  <td style={{ padding: '12px 0', color: '#0066cc', borderTop: '2px solid #0066cc' }}>
                    TOTAL ESTIMATED EXPENSE{tripType === 'C' ? ' (F + R)' : ''}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'right', color: '#0066cc', fontSize: 16, borderTop: '2px solid #0066cc' }}>
                    ₹{parseFloat(totalExpenseC).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr style={{ background: '#fefce8' }}>
                  <td style={{ padding: '10px 0', color: '#92400e', fontWeight: 600 }}>
                    💵 Advance to Driver
                    <span style={{ fontSize: 10, fontWeight: 400, color: '#a16207', marginLeft: 6 }}>(given at dispatch)</span>
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>
                    <input
                      type="number" min="0" step="100"
                      placeholder="₹0"
                      value={driverAdvance}
                      onChange={e => setDriverAdvance(e.target.value)}
                      style={{ width: 110, padding: '4px 8px', fontSize: 13, border: '2px solid #f59e0b', borderRadius: 6, textAlign: 'right', fontWeight: 700 }}
                    />
                  </td>
                </tr>
                <tr style={{ background: '#fefce8' }}>
                  <td style={{ padding: '10px 0', color: '#92400e', fontWeight: 600 }}>
                    💵 Advance to Munshi
                    <span style={{ fontSize: 10, fontWeight: 400, color: '#a16207', marginLeft: 6 }}>(given at dispatch)</span>
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right' }}>
                    <input
                      type="number" min="0" step="100"
                      placeholder="₹0"
                      value={munshiAdvance}
                      onChange={e => setMunshiAdvance(e.target.value)}
                      style={{ width: 110, padding: '4px 8px', fontSize: 13, border: '2px solid #f59e0b', borderRadius: 6, textAlign: 'right', fontWeight: 700 }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            {isHighwayRoute && toll === 0 && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fffbeb', borderRadius: 6, fontSize: 12, color: '#92400e', border: '1px solid #fcd34d' }}>
                🛣️ <strong>Highway route</strong> — consider adding toll card charges in the Route step.
              </div>
            )}
            {(!selectedVehicle.kmpl || fuelRate === 0) && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef9c3', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
                ⚠ Vehicle is missing {!selectedVehicle.kmpl ? 'kmpl' : ''}{!selectedVehicle.kmpl && fuelRate === 0 ? ' and ' : ''}{fuelRate === 0 ? 'fuel rate' : ''} — fuel cost not calculated.
                {fuelRate === 0 && selectedVehicle.fuel_type && ` Set a master rate for ${selectedVehicle.fuel_type} in Fuel Rates, or`} Go to Vehicle Management → Edit to fill these.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          STEP 3 — CONFIRM
      ════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div>
          <div style={{ ...card, border: '2px solid #0066cc' }}>
            <p style={{ ...sectionTitle, fontSize: 16 }}>Confirm Trip Dispatch</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 13, lineHeight: 2 }}>
              <div><span style={{ color: '#475569' }}>Munshi:</span> <strong>{selectedMunshi?.name || '—'}</strong></div>
              <div><span style={{ color: '#475569' }}>Vehicle:</span> <strong>{selectedVehicle.vehicle_no}</strong></div>
              <div><span style={{ color: '#475569' }}>Driver:</span> <strong>{selectedVehicle.driver_name || '—'}</strong></div>
              <div><span style={{ color: '#475569' }}>Vehicle Size:</span> <strong>{SIZE_LABELS[vehicleCat] || '—'}</strong></div>
              <div><span style={{ color: '#475569' }}>From:</span> <strong>{fromPOI.poi_name}</strong></div>
              <div><span style={{ color: '#475569' }}>To:</span> <strong>{toPOI ? toPOI.poi_name : <span style={{ color: '#f59e0b' }}>⏳ Half-Route — assign later</span>}</strong></div>
              {waypoints.length > 0 && (
                <div style={{ gridColumn: '1/-1' }}>
                  <span style={{ color: '#475569' }}>Via:</span> <strong>{waypoints.map(id => pois.find(p => p.id === id)?.poi_name?.split(',')[0]).join(' → ')}</strong>
                </div>
              )}
              <div>
                <span style={{ color: '#475569' }}>Road KM:</span> <strong>{km} km</strong>
                {isHighwayRoute && <span style={{ marginLeft: 8, background: routeMode === 'expressway' ? '#7c3aed' : '#f59e0b', color: '#fff', borderRadius: 10, padding: '1px 9px', fontSize: 11, fontWeight: 700 }}>{routeMode === 'expressway' ? '🚀' : '🛣️'} {highwayName || (routeMode === 'expressway' ? 'Expressway' : 'Highway')}</span>}
              </div>
              {(toll > 0 || tollMode) && (
                <div><span style={{ color: '#475569' }}>Toll Charges:</span>{' '}
                  {toll > 0
                    ? <strong>₹{toll.toLocaleString('en-IN')}</strong>
                    : <span style={{ color: '#94a3b8', fontSize: 12 }}>amount not entered</span>}
                  {tollMode && <span style={{ marginLeft: 8, fontSize: 11, color: tollMode === 'card' ? '#7c3aed' : '#0066cc', fontWeight: 600 }}>{tollMode === 'card' ? '💳 via card' : '💵 cash'}</span>}
                </div>
              )}
              <div><span style={{ color: '#475569' }}>Total Expense:</span>{' '}
                <strong style={{ color: '#0066cc', fontSize: 15 }}>₹{parseFloat(totalExpenseC).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                {tripType === 'C' && (
                  <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
                    (F: ₹{parseFloat(totalExpense).toLocaleString('en-IN')} + R: ₹{(parseFloat(fuelCost) + toll).toLocaleString('en-IN')})
                  </span>
                )}
              </div>
              {(parseFloat(driverAdvance) > 0 || parseFloat(munshiAdvance) > 0) && (
                <>
                  {parseFloat(driverAdvance) > 0 && (
                    <div><span style={{ color: '#475569' }}>Advance → Driver:</span> <strong style={{ color: '#d97706' }}>₹{parseFloat(driverAdvance).toLocaleString('en-IN')}</strong></div>
                  )}
                  {parseFloat(munshiAdvance) > 0 && (
                    <div><span style={{ color: '#475569' }}>Advance → Munshi:</span> <strong style={{ color: '#d97706' }}>₹{parseFloat(munshiAdvance).toLocaleString('en-IN')}</strong></div>
                  )}
                </>
              )}
            </div>
            <div style={{ marginTop: 16, padding: '10px 14px', background: '#f0f9ff', borderRadius: 6, fontSize: 12, color: '#0066cc' }}>
              🆔 Trip ID will be auto-generated on save — format: <strong>ATLOG-R001_20260308143022</strong>
            </div>

            {/* E-Way Bill No for Part B auto-update */}
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>📋 E-Way Bill No (optional):</label>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  placeholder="e.g. 331234567890"
                  value={ewbNo}
                  onChange={e => { setEwbNo(e.target.value); setEwbAutoMatched(false); }}
                  style={{ width: '100%', padding: '7px 10px', paddingRight: ewbAutoMatched ? 120 : 10, fontSize: 13, border: `1px solid ${ewbAutoMatched ? '#22c55e' : '#cbd5e1'}`, borderRadius: 6, boxSizing: 'border-box' }}
                />
                {ewbAutoMatched && (
                  <span title="Auto-matched from synced EWBs" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#dcfce7', borderRadius: 10, padding: '2px 8px', pointerEvents: 'none' }}>
                    ✓ AUTO-MATCHED
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>Part B auto-updates on dispatch</span>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          STEP 4 — SUCCESS
      ════════════════════════════════════════════════════════════ */}
      {step === 4 && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: '#16a34a', fontSize: 22, marginBottom: 8 }}>Trip Dispatched!</h2>
          {savedGroup?.trips ? (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>● Complete Trip — click an ID to view details</div>
              <div style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                {savedGroup.trips.map(t => (
                  <div key={t.id} style={{
                    background: t.type === 'F' ? '#dcfce7' : '#fee2e2',
                    border: `1px solid ${t.type === 'F' ? '#86efac' : '#fca5a5'}`,
                    borderRadius: 8, padding: '10px 18px', minWidth: 170, textAlign: 'left',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: t.type === 'F' ? '#16a34a' : '#dc2626', marginBottom: 4 }}>
                      {t.type === 'F' ? '▶ F – Forward' : '↩ R – Return'}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#1e293b', fontWeight: 700 }}>{t.id}</div>
                    {t.type === 'R' && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>Activates after F completes</div>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 24 }}>
              Trip ID: <strong style={{ fontSize: 16, fontFamily: 'monospace', color: '#0066cc' }}>{savedTrip}</strong>
            </div>
          )}
          {/* Part B status */}
          {ewbNo && (
            <div style={{ marginBottom: 20, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, display: 'inline-block',
              background: partBStatus === 'success' ? '#dcfce7' : partBStatus === 'failed' ? '#fee2e2' : '#f1f5f9',
              color: partBStatus === 'success' ? '#15803d' : partBStatus === 'failed' ? '#dc2626' : '#64748b' }}>
              {partBStatus === 'success' && '✅ E-Way Bill Part B updated'}
              {partBStatus === 'failed' && '❌ Part B update failed — update manually on portal'}
              {partBStatus === 'skipped' && '⏭️ Part B skipped (credentials not configured yet)'}
              {!partBStatus && '⏳ Updating Part B…'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={reset} style={{ padding: '10px 24px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              ➕ New Dispatch
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MAP MODAL
      ════════════════════════════════════════════════════════════ */}
      {showMap && fromPOI && toPOI && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
          {/* Header bar — fixed 56px at top */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, minHeight: 56, background: '#1e293b', color: '#fff', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 1, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>🗺 Route Map</span>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>
              {fromPOI.poi_name.split(',')[0]} → {toPOI.poi_name.split(',')[0]}
              {waypoints.length > 0 && ` (${waypoints.length} stop${waypoints.length > 1 ? 's' : ''})`}
            </span>
            {routeKm && (
              <span style={{ background: routeMode === 'expressway' ? '#7c3aed' : routeMode === 'highway' ? '#f59e0b' : '#2563eb', borderRadius: 16, padding: '3px 14px', fontSize: 13, fontWeight: 700, marginLeft: 8 }}>
                📏 {routeKm} km {routeMode === 'expressway' ? '(expressway)' : routeMode === 'highway' ? '(highway)' : '(local)'}
              </span>
            )}
            {/* ── Route-switch buttons right inside the map header ── */}
            <div style={{ display: 'flex', gap: 5, marginLeft: 8 }}>
              {[
                { m: 'highway',    icon: '🛣️', label: 'Highway',    km: highwayKm,    geom: highwayGeometry,    color: '#f59e0b' },
                { m: 'local',      icon: '🏩️', label: 'Local',      km: localKm,      geom: localGeometry,      color: '#2563eb' },
                ...(expresswayKm && Math.abs(parseFloat(expresswayKm) - parseFloat(highwayKm)) > 0.9
                  ? [{ m: 'expressway', icon: '🚀', label: 'Expr', km: expresswayKm, geom: expresswayGeometry, color: '#7c3aed' }]
                  : []),
              ].map(({ m, icon, label, km: optKm, geom, color }) => (
                <button key={m}
                  onClick={() => {
                    setRouteMode(m);
                    if (optKm) setRouteKm(optKm);
                    if (geom.length) setRouteGeometry(geom);
                    highwayManualRef.current = true;
                    if (m === 'expressway') setHighwayName(
                      fromPOI?.longitude < 77.0
                        ? 'Western Peripheral Expressway (KMP)'
                        : 'Eastern Peripheral Expressway + KMP'
                    );
                    else if (m !== 'highway') setHighwayName('');
                  }}
                  style={{ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: routeMode === m ? 800 : 500, cursor: 'pointer',
                    background: routeMode === m ? color : 'rgba(255,255,255,0.15)',
                    color: routeMode === m ? '#fff' : '#cbd5e1',
                    border: `1.5px solid ${routeMode === m ? color : 'transparent'}` }}
                >{icon} {label}{optKm ? ` ${optKm}km` : ''}</button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Route legend */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, marginRight: 8 }}>
                {[
                  { m: 'highway',    icon: '🛣️', label: 'Highway',    km: highwayKm,    color: '#f59e0b' },
                  { m: 'local',      icon: '🏙️', label: 'Local',      km: localKm,      color: '#2563eb' },
                  ...(expresswayKm && Math.abs(parseFloat(expresswayKm)-parseFloat(highwayKm))>0.9
                    ? [{ m: 'expressway', icon: '🚀', label: 'Expressway', km: expresswayKm, color: '#7c3aed' }]
                    : []),
                ].map(({ m, icon, label, km: optKm, color }) => (
                  <span key={m} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ display: 'inline-block', width: 22, height: routeMode===m ? 5 : 3, background: color, borderRadius: 2, opacity: routeMode===m ? 1 : 0.45 }} />
                    <span style={{ color: routeMode===m ? color : '#94a3b8', fontWeight: routeMode===m ? 700 : 400 }}>
                      {icon} {label}{optKm ? ` ${optKm}km` : ''}
                    </span>
                  </span>
                ))}
              </div>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>🟢 From &nbsp; 🔴 To &nbsp; 🟡 Stop</span>
              <button
                onClick={() => setShowMap(false)}
                style={{ background: '#475569', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 14px', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}
              >✕ Close</button>
            </div>
          </div>
          {/* Map — fills everything below the header */}
          <div style={{ position: 'absolute', top: 70, left: 0, right: 0, bottom: 0 }}>
            <MapContainer
              center={[fromPOI.latitude, fromPOI.longitude]}
              zoom={7}
              minZoom={5}
              maxBounds={[[6.0, 68.0], [37.5, 98.0]]}
              maxBoundsViscosity={0.8}
              style={{ height: '100%', width: '100%' }}
            >
              <InvalidateSize />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {/* Non-active routes — thin faded dashed lines */}
              {(() => {
                const allLines = [
                  { key: 'hw',   geom: highwayGeometry,    label: '🛣️ Highway',    color: '#f59e0b' },
                  { key: 'loc',  geom: localGeometry,      label: '🏙️ Local',      color: '#2563eb' },
                  { key: 'expr', geom: expresswayGeometry, label: '🚀 Expressway', color: '#7c3aed' },
                ];
                const modeKeyMap = { highway: 'hw', local: 'loc', expressway: 'expr' };
                return allLines
                  .filter(l => l.key !== modeKeyMap[routeMode] && l.geom.length > 1)
                  .map(l => {
                    const midIdx = Math.floor(l.geom.length / 2);
                    return (
                      <React.Fragment key={l.key}>
                        <Polyline positions={l.geom} color={l.color} weight={5} opacity={0.65} dashArray="10 6" />
                        {l.geom[midIdx] && (
                          <Marker position={l.geom[midIdx]} icon={L.divIcon({
                            html: `<div style="background:${l.color};color:#fff;padding:3px 8px;border-radius:10px;font-size:11px;font-weight:700;white-space:nowrap;opacity:0.9;box-shadow:0 1px 4px rgba(0,0,0,0.25)">${l.label}</div>`,
                            className: '', iconAnchor: [50, 10],
                          })} />
                        )}
                      </React.Fragment>
                    );
                  });
              })()}
              {/* Active route — bold solid line with label */}
              {routeGeometry.length > 1 && (() => {
                const modeColors = { highway: '#f59e0b', local: '#2563eb', expressway: '#7c3aed' };
                const modeLabels = { highway: '🛣️ Highway', local: '🏙️ Local', expressway: '🚀 Expressway' };
                const activeColor = modeColors[routeMode] || '#f59e0b';
                const activeLabel = modeLabels[routeMode] || '🛣️ Highway';
                const midIdx = Math.floor(routeGeometry.length / 2);
                return (
                  <>
                    <Polyline positions={routeGeometry} color={activeColor} weight={7} opacity={0.95} />
                    {routeGeometry[midIdx] && (
                      <Marker position={routeGeometry[midIdx]} icon={L.divIcon({
                        html: `<div style="background:${activeColor};color:#fff;padding:4px 10px;border-radius:10px;font-size:12px;font-weight:800;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${activeLabel} — ${routeKm} km</div>`,
                        className: '', iconAnchor: [60, 10],
                      })} />
                    )}
                  </>
                );
              })()}
              {/* Fit to ALL route geometries + markers so expressway loop is visible */}
              <FitBounds positions={[
                [fromPOI.latitude, fromPOI.longitude],
                [toPOI.latitude, toPOI.longitude],
                ...waypoints.map(id => { const p = pois.find(x => x.id === id); return p ? [p.latitude, p.longitude] : null; }).filter(Boolean),
                // Thin the geometry to every 10th point for performance
                ...highwayGeometry.filter((_,i) => i % 10 === 0),
                ...localGeometry.filter((_,i) => i % 10 === 0),
                ...expresswayGeometry.filter((_,i) => i % 10 === 0),
              ].filter(Boolean)} />
              {/* FROM marker */}
              <Marker position={[fromPOI.latitude, fromPOI.longitude]} icon={makeColorIcon('#16a34a', 'A')}>
                <Popup>
                  <strong>FROM:</strong> {fromPOI.poi_name}<br />
                  <span style={{ fontSize: 11, color: '#64748b' }}>{fromPOI.city}</span>
                </Popup>
              </Marker>
              {/* TO marker */}
              <Marker position={[toPOI.latitude, toPOI.longitude]} icon={makeColorIcon('#dc2626', 'B')}>
                <Popup>
                  <strong>TO:</strong> {toPOI.poi_name}<br />
                  <span style={{ fontSize: 11, color: '#64748b' }}>{toPOI.city}</span>
                </Popup>
              </Marker>
              {/* Waypoint markers */}
              {waypoints.map((id, idx) => {
                const p = pois.find(x => x.id === id);
                return p ? (
                  <Marker key={id} position={[p.latitude, p.longitude]} icon={makeColorIcon('#d97706', idx + 1)}>
                    <Popup>
                      <strong>Stop {idx + 1}:</strong> {p.poi_name}<br />
                      <span style={{ fontSize: 11, color: '#64748b' }}>{p.city}</span>
                    </Popup>
                  </Marker>
                ) : null;
              })}
            </MapContainer>
          </div>
        </div>
      )}

      {/* ── Navigation Buttons ── */}
      {step < 4 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            style={{
              padding: '10px 24px', borderRadius: 6, border: '1px solid #ccc', background: '#fff',
              fontSize: 14, cursor: step === 0 ? 'not-allowed' : 'pointer', color: step === 0 ? '#94a3b8' : '#374151',
            }}>
            ← Back
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext[step]?.()}
              style={{
                padding: '10px 28px', borderRadius: 6, border: 'none',
                background: canNext[step]?.() ? '#0066cc' : '#cce0ff',
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: canNext[step]?.() ? 'pointer' : 'not-allowed',
              }}>
              Next →
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
              {saveError && (
                <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 8, padding: '8px 14px', color: '#b91c1c', fontSize: 13, fontWeight: 600, maxWidth: 480, textAlign: 'center' }}>
                  {saveError}
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '10px 28px', borderRadius: 6, border: 'none',
                  background: saving ? '#9ca3af' : '#16a34a',
                  color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
                }}>
                {saving ? '⏳ Saving...' : '🚀 Dispatch Trip'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
