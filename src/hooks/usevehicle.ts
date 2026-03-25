// hooks/useVehicles.ts
import { useState, useEffect } from 'react';
import type { Vehicle } from '../types';

export const useVehicles = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchVehicles = async () => {
    try {
      // Fetch live vehicle data from backend API
      const resp = await fetch('/api/vehicles');
      if (!resp.ok) throw new Error('Failed to fetch vehicles');
      const data = await resp.json();
      setVehicles(Array.isArray(data.vehicles) ? data.vehicles : data);
      setLoading(false);
    } catch (err) {
      setError(err as Error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  return { vehicles, loading, error, refetch: fetchVehicles };
};
