/**
 * Shared Vehicle Data Context
 * Single source of truth for vehicles, statuses, and POIs across all pages.
 * Auto-refreshes every 30 seconds.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useTenant } from '../TenantContext.js';

const VehicleDataContext = createContext(null);

const REFRESH_INTERVAL = 30000; // 30 seconds
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function VehicleDataProvider({ children }) {
  const { tenantKey } = useTenant();
  const clientId = tenantKey || 'CLIENT_001';

  const [vehicles, setVehicles] = useState([]);
  const [pois, setPois] = useState([]);
  const [munshis, setMunshis] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch vehicles with GPS data + computed status from backend
  const fetchVehicles = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/vehicles?clientId=${encodeURIComponent(clientId)}`,
        { headers: { 'X-Tenant-ID': clientId } }
      );
      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.vehicles || []);
        setVehicles(list);
      }
    } catch (error) {
      console.error('[VehicleDataContext] Error fetching vehicles:', error);
    }
  }, [clientId]);

  // Fetch POIs
  const fetchPois = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/pois?clientId=${encodeURIComponent(clientId)}`
      );
      if (response.ok) {
        const data = await response.json();
        setPois(Array.isArray(data) ? data.map(p => ({ ...p, name: p.poi_name || p.name })) : []);
      }
    } catch (error) {
      console.error('[VehicleDataContext] Error fetching POIs:', error);
    }
  }, [clientId]);

  // Fetch Munshis (drivers)
  const fetchMunshis = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/munshis?clientId=${encodeURIComponent(clientId)}`,
        { headers: { 'X-Tenant-ID': clientId } }
      );
      if (response.ok) {
        const data = await response.json();
        setMunshis(Array.isArray(data) ? data : (data.munshis || []));
      }
    } catch (error) {
      console.error('[VehicleDataContext] Error fetching munshis:', error);
    }
  }, [clientId]);

  const intervalRef = useRef(null);

  // refresh() = Promise.all of all three fetches
  const refresh = useCallback(async () => {
    await Promise.all([fetchVehicles(), fetchPois(), fetchMunshis()]);
  }, [fetchVehicles, fetchPois, fetchMunshis]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));

    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [refresh]);

  // Computed stats derived from the shared vehicles list
  const stats = React.useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter(v => v.status === 'ACTIVE').length;
    const stopped = vehicles.filter(v => v.status === 'STOPPED').length;
    const alertMunshi = vehicles.filter(v => v.status === 'ALERT_MUNSHI').length;
    const alertAdmin = vehicles.filter(v => v.status === 'ALERT_ADMIN').length;
    const offline = vehicles.filter(v => v.status === 'OFFLINE').length;
    const atPOI = vehicles.filter(v => v.stop_poi).length;

    // Build a status map keyed by vehicle_number for easy lookup
    // Also key by vehicle_no (alias used by vehicles-master endpoint)
    const statusMap = {};
    vehicles.forEach(v => {
      const entry = {
        status: v.status || 'OFFLINE',
        minutes_since_update: v.minutes_since_update,
        stop_poi: v.stop_poi,
      };
      if (v.vehicle_number) statusMap[v.vehicle_number] = entry;
      if (v.vehicle_no)     statusMap[v.vehicle_no]     = entry;
    });

    return { total, active, stopped, alertMunshi, alertAdmin, offline, atPOI, statusMap };
  }, [vehicles]);

  return (
    <VehicleDataContext.Provider value={{ vehicles, pois, munshis, stats, loading, refresh }}>
      {children}
    </VehicleDataContext.Provider>
  );
}

// Hook to consume the context — exported from this file
// eslint-disable-next-line react-refresh/only-export-components
export function useVehicleData() {
  const ctx = useContext(VehicleDataContext);
  if (!ctx) throw new Error('useVehicleData must be used within a VehicleDataProvider');
  return ctx;
}
