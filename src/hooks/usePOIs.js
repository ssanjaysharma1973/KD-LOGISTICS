import { useState, useEffect } from 'react';
import { poiService } from '../services/poiService.js';

/**
 * Hook for managing POI data
 */
export function usePOIs() {
  const [pois, setPOIs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadPOIs = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await poiService.fetchPOIs();
        setPOIs(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
        setPOIs([]);
      } finally {
        setLoading(false);
      }
    };

    loadPOIs();
  }, []);

  return { pois, loading, error };
}
