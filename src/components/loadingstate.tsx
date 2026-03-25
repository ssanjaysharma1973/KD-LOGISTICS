import React from 'react';
import { MapPin, Truck, Route, Settings, Calendar, Clock, FileClock, Package, User, Upload } from 'lucide-react';


export const LoadingState = () => {
  return (
    <div>Loading...</div>
  );
}

// FIX: Return only <tr> elements (not wrapped in <div>) for use inside <tbody>
export const LoadingTable = () => (
  <>
    {[...Array(30)].map((_, i) => (
      <tr key={i} className="border-b">
        {[...Array(8)].map((_, j) => (
          <td key={j} className="px-4 py-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </td>
        ))}
      </tr>
    ))}
  </>
);

type LoadingCardProps = {
  icon: React.ElementType;
  title: string;
};

export const LoadingCard = ({ icon: Icon, title }: LoadingCardProps) => (
  <div className="bg-white rounded-lg shadow p-4">
    <div className="flex items-center mb-4">
      <Icon className="w-5 h-5 mr-2 text-blue-500" />
      <span className="font-medium">{title}</span>
    </div>
    <div className="animate-pulse space-y-4">
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
    </div>
  </div>
);

export const LoadingMap = () => (
  <div className="bg-white rounded-lg shadow p-4">
    <div className="flex items-center mb-4">
      <MapPin className="w-5 h-5 mr-2 text-blue-500" />
      <span className="font-medium">Route Map</span>
    </div>
    <div className="h-96 w-full bg-gray-100 rounded-lg relative">
      <div className="absolute inset-0 animate-pulse bg-gray-200">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="flex flex-col items-center space-y-4">
            <MapPin className="w-8 h-8 text-gray-400" />
            <span className="text-gray-500">Loading Map...</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

type StatsCardProps = {
  icon: React.ElementType;
  title: string;
  value: string | number;
  trend: 'up' | 'down';
};

export const StatsCard = ({ icon: Icon, title, value, trend }: StatsCardProps) => (
  <div className="bg-white rounded-lg shadow p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <Icon className="w-5 h-5 mr-2 text-blue-500" />
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

export function ExtendedRoutePlanner() {
  return (
    <div className="p-4 max-w-full bg-gray-50">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatsCard icon={Truck} title="Active Vehicles" value="24/30" trend="up" />
        <StatsCard icon={Route} title="Routes Today" value="187" trend="up" />
        <StatsCard icon={Clock} title="Avg. Delivery Time" value="47m" trend="down" />
        <StatsCard icon={Package} title="Deliveries" value="1,234" trend="up" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Panel - Vehicle Details */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <LoadingCard icon={Truck} title="Vehicle Details" />
          <LoadingCard icon={User} title="Driver Details" />
        </div>
        
        {/* Center Panel - Map */}
        <div className="col-span-12 lg:col-span-6">
          <LoadingMap />
        </div>
        
        {/* Right Panel - Route Details */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <LoadingCard icon={Route} title="Route Details" />
          <LoadingCard icon={Calendar} title="Schedule" />
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="mt-4 bg-white rounded-lg shadow p-4">
        <div className="flex items-center mb-4">
          <FileClock className="w-5 h-5 mr-2 text-blue-500" />
          <span className="font-medium">Recent Activity</span>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start space-x-4 animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0"></div>
              <div className="flex-grow">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
              <div className="w-24">
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table Section */}
      <div className="mt-4 bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center">
            <Settings className="w-5 h-5 mr-2 text-blue-500" />
            <span className="font-medium">Vehicle Management</span>
          </div>
          <div className="flex space-x-2">
            <button className="bg-blue-100 text-blue-600 px-3 py-1 rounded-md text-sm flex items-center">
              <Upload className="w-4 h-4 mr-1" />
              Export
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <LoadingTable />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default LoadingTable;