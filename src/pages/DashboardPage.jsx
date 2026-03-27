/**
 * Dashboard page component
 */
import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Bell } from 'lucide-react';
import { formatDurationSince } from '../utils/date.js';
import { useVehicleData } from '../context/VehicleDataContext.jsx';
import {
  getVehicleStatusStyles,
  filterVehiclesBy,
  getVehicleStats,
  sortVehiclesByTime,
  isVehicleAtPOI,
} from '../utils/vehicle.js';

export default function DashboardPage({
  vehicles,
  pois,
  onTrackVehicle,
}) {
  // Stats come from shared context (already refreshes every 30s globally)
  const { stats: ctxStats } = useVehicleData();
  const stats = {
    total:     ctxStats.total,
    active:    ctxStats.active,
    atPOI:     ctxStats.atPOI,
    offline:   ctxStats.offline,
    available: ctxStats.total - ctxStats.active - ctxStats.offline,
  };

  const [filterStatus, setFilterStatus] = useState('all');
  const [filteredVehicles, setFilteredVehicles] = useState(vehicles);

  useEffect(() => {
    if (filterStatus === 'all') {
      setFilteredVehicles(sortVehiclesByTime(vehicles));
    } else {
      const filtered = filterVehiclesBy(vehicles, filterStatus, pois);
      setFilteredVehicles(sortVehiclesByTime(filtered));
    }
  }, [filterStatus, vehicles, pois]);

  const poiCounts = {};
  vehicles.forEach((v) => {
    const poiCheck = isVehicleAtPOI(v, pois);
    if (poiCheck.atPOI) {
      poiCounts[poiCheck.poi] = (poiCounts[poiCheck.poi] || 0) + 1;
    }
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Vehicles */}
        <div className="bg-blue-100 text-blue-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Truck className="w-12 h-12 opacity-70" />
            <div>
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-sm font-semibold uppercase">Total Vehicles</p>
            </div>
          </div>
        </div>

        {/* Active */}
        <div className="bg-green-100 text-green-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <MapPin className="w-12 h-12 opacity-70" />
            <div>
              <p className="text-3xl font-bold">{stats.active}</p>
              <p className="text-sm font-semibold uppercase">Active</p>
            </div>
          </div>
        </div>

        {/* At POI */}
        <div className="bg-indigo-100 text-indigo-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <MapPin className="w-12 h-12 opacity-70" />
            <div>
              <p className="text-3xl font-bold">{stats.atPOI}</p>
              <p className="text-sm font-semibold uppercase">At POI</p>
            </div>
          </div>
        </div>

        {/* Offline */}
        <div className="bg-slate-200 text-slate-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <Bell className="w-12 h-12 opacity-70" />
            <div>
              <p className="text-3xl font-bold">{stats.offline}</p>
              <p className="text-sm font-semibold uppercase">Offline</p>
            </div>
          </div>
        </div>
      </div>

      {/* POI Summary */}
      {Object.keys(poiCounts).length > 0 && (
        <div className="flex flex-wrap gap-4">
          {Object.entries(poiCounts).map(([poi, count]) => (
            <div
              key={poi}
              className="rounded-xl bg-indigo-50 text-indigo-800 shadow-sm p-6 flex items-center gap-4 min-w-[160px]"
            >
              <MapPin className="w-6 h-6" />
              <div>
                <div className="text-xl font-bold">{count}</div>
                <div className="text-sm uppercase font-semibold">At {poi}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'All Vehicles' },
          { id: 'active', label: 'Active' },
          { id: 'at-poi', label: 'At POI' },
          { id: 'offline', label: 'Offline' },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setFilterStatus(filter.id)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filterStatus === filter.id
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Vehicle Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-slate-500 text-lg">No vehicles found</p>
          </div>
        ) : (
          filteredVehicles.map((vehicle) => {
            const styles = getVehicleStatusStyles(vehicle);
            const poiCheck = isVehicleAtPOI(vehicle, pois);

            return (
              <div
                key={vehicle.vehicle_number || vehicle.id}
                className={`rounded-lg border-2 border-indigo-300 p-6 shadow-md ${styles.bg}`}
                style={{ color: styles.text }}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                  <Truck className="w-6 h-6 text-indigo-600" />
                  <h3 className="font-bold text-lg">{vehicle.vehicle_number}</h3>
                </div>

                {/* Status Badge */}
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-slate-300 text-slate-700">
                    {styles.tooltip}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm mb-4">
                  <div>
                    <p className="font-semibold">Status:</p>
                    <p>{vehicle.status || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Driver:</p>
                    <p>{vehicle.driver || 'Not assigned'}</p>
                  </div>
                  {poiCheck.atPOI && (
                    <div>
                      <p className="font-semibold">At POI:</p>
                      <p>{poiCheck.poi}</p>
                    </div>
                  )}
                  <div>
                    <p className="font-semibold">Last Update:</p>
                    <p>{formatDurationSince(vehicle.gps_time)}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Location:</p>
                    <p className="text-xs">
                      {vehicle.latitude}, {vehicle.longitude}
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={() => onTrackVehicle(vehicle)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded transition"
                >
                  View History
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
