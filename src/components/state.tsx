import React from 'react';
import { Truck, Route, Clock, Package } from 'lucide-react';

interface StatsType {
  activeVehicles?: number;
  totalVehicles?: number;
  routesToday?: number;
  avgDeliveryTime?: string;
  totalDeliveries?: number;
}

export const StatsOverview = ({ stats = {} }: { stats?: StatsType }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
    <StatsCard 
      icon={Truck} 
      title="Active Vehicles" 
      value={`${stats.activeVehicles ?? 0}/${stats.totalVehicles ?? 0}`} 
      trend="up" 
    />
    <StatsCard 
      icon={Route} 
      title="Routes Today" 
      value={stats.routesToday?.toString() ?? '0'} 
      trend="up" 
    />
    <StatsCard 
      icon={Clock} 
      title="Avg. Delivery Time" 
      value={stats.avgDeliveryTime ?? '-'} 
      trend="down" 
    />
    <StatsCard 
      icon={Package} 
      title="Deliveries" 
      value={stats.totalDeliveries?.toLocaleString?.() ?? '0'} 
      trend="up" 
    />
  </div>
);

interface StatsCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  trend: 'up' | 'down';
}

const StatsCard = ({ icon: Icon, title, value, trend }: StatsCardProps) => (
  <div className="bg-white rounded-lg shadow p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        {Icon && <Icon className="w-5 h-5 mr-2 text-blue-500" />}
        <span className="text-sm text-gray-500">{title}</span>
      </div>
      <span className={`text-xs px-2 py-1 rounded-full ${
        trend === 'up' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {trend === 'up' ? '+' : '-'}12%
      </span>
    </div>
    <div className="mt-2">
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  </div>
);

export default StatsOverview;