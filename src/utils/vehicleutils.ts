// utils/vehicleUtils.ts
import type { Vehicle } from '../types';

export const getVehicleStatusColor = (status: Vehicle['status']) => {
  const colors = {
    Empty: { bg: 'bg-green-100', text: 'text-green-800' },
    'In Transit': { bg: 'bg-blue-100', text: 'text-blue-800' },
    Loading: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    Completed: { bg: 'bg-gray-100', text: 'text-gray-800' },
  };

  return colors[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };
};

export const calculateProgress = (
  completedStops: number,
  totalStops: number
): number => {
  return Math.round((completedStops / totalStops) * 100);
};