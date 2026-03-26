
// services/api.js
// Use VITE env var, then window.__API_BASE, then fallback to localhost
const getApiBase = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined' && window.__API_BASE) {
    return window.__API_BASE;
  }
  return ''; // use relative URL (same-origin in production, proxied in dev)
};

export const fetchVehicles = async ({ tenantId } = {}) => {
  const apiBase = getApiBase();
  const clientId = tenantId || 'CLIENT_001';
  let url = `${apiBase}/api/vehicles?clientId=${encodeURIComponent(clientId)}`;
  
  // FIXED: Define headers properly
  const headers = { 'X-Tenant-ID': clientId };
  
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Failed to fetch vehicles: ${response.status}`);
    const data = await response.json();
    // Extract vehicles array from response object or return array directly
    return Array.isArray(data) ? data : (data.vehicles || []);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return [];
  }
};

export const addVehicle = async (vehicleData) => {
  const response = await fetch(`${getApiBase()}/vehicles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(vehicleData),
  });
  if (!response.ok) throw new Error('Failed to add vehicle');
  return response.json();
};

export const updateVehicle = async (id, vehicleData) => {
  const response = await fetch(`${getApiBase()}/vehicles/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(vehicleData),
  });
  if (!response.ok) throw new Error('Failed to update vehicle');
  return response.json();
};

export const fetchRoutePoints = async () => {
  const response = await fetch(`${getApiBase()}/points`);
  if (!response.ok) throw new Error('Failed to fetch route points');
  return response.json();
};

export const addRoutePoint = async (pointData) => {
  const response = await fetch(`${getApiBase()}/points`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pointData),
  });
  if (!response.ok) throw new Error('Failed to add route point');
  return response.json();
};

export const fetchVehicleManifest = async (vehicleId, { tenantId } = {}) => {
  const headers = tenantId ? { 'X-Tenant-ID': tenantId } : {};
  try {
    // Backend doesn't have /vehicles/{id}/manifest, fetch from /vehicles list
    const listUrl = `${getApiBase()}/vehicles${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`;
    const listResp = await fetch(listUrl, { headers });
    if (listResp.ok) {
      const list = await listResp.json();
      if (Array.isArray(list)) {
        if (!vehicleId) {
          // Return all vehicles if no ID specified
          return list;
        }
        // Find specific vehicle by ID or number
        const vehicle = list.find(v => 
          String(v.id) === String(vehicleId) || 
          String(v.number) === String(vehicleId) ||
          String(v.vehicleNumber) === String(vehicleId)
        );
        return vehicle || null;
      }
    }
    return null;
  } catch (err) {
    console.error('fetchVehicleManifest error:', err);
    // On any error, return null so UI can remain functional
    return null;
  }
};

export const fetchVehicleTrack = async (vehicleId, { tenantId } = {}) => {
  if (!vehicleId) throw new Error('vehicleId required');
  const headers = tenantId ? { 'X-Tenant-ID': tenantId } : {};
  const base = getApiBase();

  try {
    const url = `${base}/track/${encodeURIComponent(vehicleId)}?hours=24`;
    const resp = await fetch(url, { headers });
    if (resp.ok) return resp.json();
    throw new Error(`Track request failed: ${resp.status}`);
  } catch (e) {
    console.error('fetchVehicleTrack error:', e);
    return [];
  }
};

// utils/validators.js
export const validateIMEI = (imei) => {
  return /^[0-9]{15}$/.test(imei);
};

export const validateLatLng = (lat, lng) => {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  return (
    !isNaN(latNum) &&
    !isNaN(lngNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    lngNum >= -180 &&
    lngNum <= 180
  );
};

const defaultExport = {
  fetchVehicles,
  addVehicle,
  updateVehicle,
  fetchRoutePoints,
  addRoutePoint,
  fetchVehicleManifest,
  fetchVehicleTrack,
  validateIMEI,
  validateLatLng,
};

export default defaultExport;
