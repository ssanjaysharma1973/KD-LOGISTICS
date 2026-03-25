import React from 'react';
import { Route, Settings, Upload, Truck, Clock, Package, MapPin } from 'lucide-react';

export function ExtendedRoutePlanner() {
  return (
    <div className="route-planner p-4">
      {/* Route Details Section */}
      <div className="route-details mb-4">
        <h2 className="text-xl font-bold mb-4">Route Details</h2>
        <div className="space-y-3">
          <div>
            <span>Start Point</span>
            <input 
              type="text" 
              placeholder="Enter start location" 
              className="block w-full mt-1 border rounded p-2"
            />
          </div>
          <div>
            <span>End Point</span>
            <input 
              type="text" 
              placeholder="Enter destination" 
              className="block w-full mt-1 border rounded p-2"
            />
          </div>
          <div>
            <span>Stops</span>
            <input 
              type="text" 
              placeholder="Add stops" 
              className="block w-full mt-1 border rounded p-2"
            />
          </div>
          <button className="bg-blue-500 text-black px-4 py-2 rounded">
            Generate Route
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="stats-section space-y-4">
        <div className="stat-card">
          <Truck className="w-5 h-5" />
          <span>Active Vehicles</span>
          <div>24/30</div>
          <span className="text-green-600">+12%</span>
        </div>

        <div className="stat-card">
          <Route className="w-5 h-5" />
          <span>Routes Today</span>
          <div>187</div>
          <span className="text-green-600">+12%</span>
        </div>

        <div className="stat-card">
          <Clock className="w-5 h-5" />
          <span>Avg. Delivery Time</span>
          <div>47m</div>
          <span className="text-red-600">-12%</span>
        </div>

        <div className="stat-card">
          <Package className="w-5 h-5" />
          <span>Deliveries</span>
          <div>1,234</div>
          <span className="text-green-600">+12%</span>
        </div>
      </div>

      {/* Vehicle Management Section */}
      <div className="vehicle-management mt-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            <span>Vehicle Management</span>
          </div>
          <button className="flex items-center bg-gray-100 px-3 py-1 rounded">
            <Upload className="w-4 h-4 mr-1" />
            Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Vehicle ID</th>
                <th className="text-left p-2">Driver</th>
                <th className="text-left p-2">Route</th>
                <th className="text-left p-2">Progress</th>
              </tr>
            </thead>
            <tbody>
              {/* Add table rows here */}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="recent-activity mt-4">
        <div className="flex items-center">
          <Clock className="w-5 h-5 mr-2" />
          <span>Recent Activity</span>
        </div>
      </div>
    </div>
  );
}

export default ExtendedRoutePlanner;