// types.ts
export interface Vehicle {
  id: string;
  status: 'Empty' | 'In Transit' | 'Loading' | 'Completed';
  vehicleNo: string;
  size: 'Small' | 'Medium' | 'Large';
  driverName: string;
  routeDetails?: string;
  location?: {
    lat: number;
    lng: number;
  };
  progress?: number;
  estimatedTime?: string;
}

export interface RoutePoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
  status: 'Pending' | 'Completed' | 'In Progress';
  estimatedArrival: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  license: string;
  status: 'Available' | 'On Route' | 'Off Duty';
  rating: number;
}

export interface Stats {
  activeVehicles: number;
  totalVehicles: number;
  routesToday: number;
  avgDeliveryTime: string;
  totalDeliveries: number;
}