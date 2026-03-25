import { useState, useEffect } from 'react';
import { vehicleService } from '../services/vehicleService.js';

/**
 * Hook for managing vehicle data
 */
export function useVehicles(tenantId) {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tenantId) {
      setVehicles([]);
      return;
    }

    const loadVehicles = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await vehicleService.fetchVehicles({ tenantId });
        setVehicles(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
        setVehicles([]);
      } finally {
        setLoading(false);
      }
    };

    loadVehicles();
  }, [tenantId]);

  return { vehicles, loading, error };
}

/**
 * Hook for fetching vehicle track history
 */
export function useVehicleTrack(vehicleId, tenantId, options = {}) {
  const [track, setTrack] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTrack = async (from, to) => {
    setLoading(true);
    setError(null);
    try {
      const data = await vehicleService.fetchVehicleTrack(vehicleId, {
        from,
        to,
        tenantId,
        ...options,
      });
      setTrack(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { track, loading, error, fetchTrack };
}
