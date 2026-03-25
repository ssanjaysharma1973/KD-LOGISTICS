import { useState, useEffect, useCallback } from 'react';
import type { RoutePoint } from '../types';

export const useRoutes = (initialRoutes: RoutePoint[] = []) => {
  const [routes, setRoutes] = useState<RoutePoint[]>(initialRoutes);
const [loading, setLoading] = useState<boolean>(true);
const [error, setError] = useState<Error | null>(null);

  const fetchRoutes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Simulate API call - replace with actual API endpoint
      const response = await new Promise<RoutePoint[]>((resolve) => {
        setTimeout(() => {
          resolve([
            {
              id: 'P001',
              name: 'Pickup Point A',
              lat: 28.6139,
              lng: 77.2090,
              order: 1,
              status: 'Completed',
              estimatedArrival: '10:30 AM'
            }
          ]);
        }, 1000);
      });

      setRoutes(response);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch routes'));
    } finally {
      setLoading(false);
    }
  }, []);

  // FIXED: Only add new route object to the array
  const addRoute = useCallback((newRoute: Omit<RoutePoint, 'id' | 'order'>) => {
    setRoutes(prevRoutes => {
      const nextOrder = Math.max(...prevRoutes.map(r => r.order), 0) + 1;
      const newRouteObj: RoutePoint = {
        ...newRoute,
        id: `P${String(prevRoutes.length + 1).padStart(3, '0')}`,
        order: nextOrder
      };
      return [...prevRoutes, newRouteObj];
    });
  }, []);

  const updateRoute = useCallback((id: string, updates: Partial<RoutePoint>) => {
    setRoutes(prevRoutes =>
      prevRoutes.map(route =>
        route.id === id ? { ...route, ...updates } : route
      )
    );
  }, []);

  const deleteRoute = useCallback((id: string) => {
    setRoutes(prevRoutes => {
      const filteredRoutes = prevRoutes.filter(route => route.id !== id);
      return filteredRoutes.map((route, index) => ({
        ...route,
        order: index + 1
      }));
    });
  }, []);

  const reorderRoute = useCallback((fromOrder: number, toOrder: number) => {
    setRoutes(prevRoutes => {
      const routesCopy = [...prevRoutes];
      const [movedRoute] = routesCopy.splice(
        routesCopy.findIndex(r => r.order === fromOrder),
        1
      );
      
      if (movedRoute) {
        routesCopy.splice(toOrder - 1, 0, { ...movedRoute, order: toOrder });
        return routesCopy.map((route, index) => ({
          ...route,
          order: index + 1
        }));
      }
      
      return prevRoutes;
    });
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  return {
    routes,
    loading,
    error,
    addRoute,
    updateRoute,
    deleteRoute,
    reorderRoute,
    refreshRoutes: fetchRoutes
  };
};