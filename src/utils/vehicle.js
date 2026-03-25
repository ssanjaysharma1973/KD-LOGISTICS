/**
 * Vehicle filtering and status utilities
 */
import { getDaysSince } from './date.js';

/**
 * Get vehicle status color styling
 */
export function getVehicleStatusStyles(vehicle) {
  if (!vehicle.gps_time) {
    return { bg: 'bg-slate-200', text: '#64748b', tooltip: 'No GPS data' };
  }

  const daysSince = getDaysSince(vehicle.gps_time);

  if (daysSince > 2) {
    return { bg: 'bg-red-200', text: '#b91c1c', tooltip: 'Stale (>2 days)' };
  }
  if (daysSince > 1) {
    return { bg: 'bg-yellow-200', text: '#92400e', tooltip: 'Warning (>1 day)' };
  }

  return { bg: 'bg-white', text: '#000', tooltip: 'Updated' };
}

/**
 * Check if vehicle is active (recent GPS update)
 */
export function isVehicleActive(vehicle, thresholdHours = 24) {
  if (!vehicle.gps_time) return false;

  const daysSince = getDaysSince(vehicle.gps_time);
  return daysSince * 24 < thresholdHours;
}

/**
 * Check if vehicle is at/near POI
 */
export function isVehicleAtPOI(vehicle, pois, radiusMeters = 1500) {
  if (!vehicle.latitude || !vehicle.longitude) return false;
  if (!Array.isArray(pois)) return false;

  const { haversine } = require('./math.js');

  for (const poi of pois) {
    if (!poi.latitude || !poi.longitude) continue;

    const distance = haversine(
      parseFloat(vehicle.latitude),
      parseFloat(vehicle.longitude),
      parseFloat(poi.latitude),
      parseFloat(poi.longitude)
    );

    if (distance <= radiusMeters) {
      return { atPOI: true, poi: poi.name || poi.poi_name, distance };
    }
  }

  return { atPOI: false };
}

/**
 * Check if vehicle is offline
 */
export function isVehicleOffline(vehicle, thresholdHours = 48) {
  if (!vehicle.gps_time) return true;

  const daysSince = getDaysSince(vehicle.gps_time);
  return daysSince * 24 >= thresholdHours;
}

/**
 * Filter vehicles by status
 */
export function filterVehiclesBy(vehicles, status, pois = []) {
  if (!Array.isArray(vehicles)) return [];

  switch (status) {
    case 'active':
      return vehicles.filter((v) => isVehicleActive(v));

    case 'at-poi':
      return vehicles.filter((v) => {
        const poiCheck = isVehicleAtPOI(v, pois);
        return poiCheck.atPOI;
      });

    case 'offline':
      return vehicles.filter((v) => isVehicleOffline(v));

    case 'available':
      return vehicles.filter((v) => !isVehicleOffline(v) && !isVehicleAtPOI(v, pois).atPOI);

    default:
      return vehicles;
  }
}

/**
 * Get vehicle summary stats
 */
export function getVehicleStats(vehicles, pois = []) {
  const stats = {
    total: vehicles.length,
    active: 0,
    atPOI: 0,
    offline: 0,
    available: 0,
  };

  vehicles.forEach((v) => {
    if (isVehicleOffline(v)) {
      stats.offline++;
    } else if (isVehicleAtPOI(v, pois).atPOI) {
      stats.atPOI++;
    } else if (isVehicleActive(v)) {
      stats.active++;
    } else {
      stats.available++;
    }
  });

  return stats;
}

/**
 * Sort vehicles by stop time (longest stopped first)
 */
export function sortVehiclesByTime(vehicles) {
  return [...vehicles].sort((a, b) => {
    const now = Date.now();
    
    // Get stop duration for each vehicle
    const getStopDuration = (v) => {
      // Use stop_duration_minutes if available
      if (v.stop_duration_minutes !== undefined && v.stop_duration_minutes !== null) {
        return v.stop_duration_minutes * 60 * 1000; // convert to ms
      }
      
      // Fallback to GPS time calculation
      if (!v.gps_time) return -Infinity;
      const t = new Date(v.gps_time).getTime();
      if (isNaN(t)) return -Infinity;
      if (t > now) return Infinity; // future times first
      return now - t; // duration since stop in ms
    };
    
    const durationA = getStopDuration(a);
    const durationB = getStopDuration(b);

    if (durationA === Infinity && durationB === Infinity) return 0;
    if (durationA === Infinity) return -1;
    if (durationB === Infinity) return 1;
    
    // Sort by longest stopped time first (descending)
    return durationB - durationA;
  });
}
