import { API_BASE } from '../utils/apiBase.js';
// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_URL || `${API_BASE}/api`;
export const POI_API_URL = `${API_BASE_URL}/pois`;
export const VEHICLES_API_URL = `${API_BASE_URL}/vehicles`;

// POI Configuration
export const POI_RADIUS_METERS = 1500;
export const POI_DELAY_MINUTES = 0;

// Vehicle Status Colors
export const VEHICLE_STATUS_COLORS = {
  active: { bg: 'bg-green-100', text: 'text-green-800' },
  available: { bg: 'bg-blue-100', text: 'text-blue-800' },
  maintenance: { bg: 'bg-rose-100', text: 'text-rose-800' },
  offline: { bg: 'bg-slate-200', text: 'text-slate-800' },
};

// GPS Age Thresholds (days)
export const GPS_AGE_THRESHOLDS = {
  critical: 2, // > 2 days = red
  warning: 1,  // > 1 day = yellow
};

// Map Configuration
export const MAP_CONFIG = {
  height: '700px',
  width: '100%',
  defaultZoom: 12,
};

// Tab Names
export const TABS = {
  DASHBOARD: 'dashboard',
  VEHICLES: 'vehicles',
  MAP: 'map',
  POI: 'poi',
  SETTINGS: 'settings',
};
