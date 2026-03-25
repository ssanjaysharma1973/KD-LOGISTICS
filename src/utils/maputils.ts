// utils/mapUtils.ts
export const calculateCenter = (points: Array<{ lat: number; lng: number }>) => {
  if (points.length === 0) return { lat: 28.6139, lng: 77.2090 }; // Default to Delhi

  const sum = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: sum.lat / points.length,
    lng: sum.lng / points.length,
  };
};

export const calculateBounds = (points: Array<{ lat: number; lng: number }>) => {
  if (points.length === 0) return null;

  const bounds = points.reduce(
    (acc, point) => ({
      north: Math.max(acc.north, point.lat),
      south: Math.min(acc.south, point.lat),
      east: Math.max(acc.east, point.lng),
      west: Math.min(acc.west, point.lng),
    }),
    {
      north: -90,
      south: 90,
      east: -180,
      west: 180,
    }
  );

  return bounds;
};