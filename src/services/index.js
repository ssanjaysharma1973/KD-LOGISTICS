// Re-export old API for backward compatibility
export { vehicleService } from './vehicleService.js';
export { poiService } from './poiService.js';

// Keep old fetchVehicles for backward compatibility
export const fetchVehicles = async (options) => {
  const { vehicleService } = await import('./vehicleService.js');
  return vehicleService.fetchVehicles(options);
};

export const fetchVehicleTrack = async (vehicleId, options) => {
  const { vehicleService } = await import('./vehicleService.js');
  return vehicleService.fetchVehicleTrack(vehicleId, options);
};
