import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function POIFormModal({ vehicle, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    poi_name: vehicle.vehicle_number || '',
    latitude: Number(vehicle.latitude) || 0,
    longitude: Number(vehicle.longitude) || 0,
    city: vehicle.city || 'Unknown',
    address: vehicle.address || `Lat: ${vehicle.latitude}, Lng: ${vehicle.longitude}`,
    radius_meters: 1500
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'radius_meters' || name === 'latitude' || name === 'longitude' 
        ? Number(value) 
        : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Create POI</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* POI Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              POI Name *
            </label>
            <input
              type="text"
              name="poi_name"
              value={formData.poi_name}
              onChange={handleChange}
              required
              placeholder="e.g., WAREHOUSE-01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Latitude */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Latitude *
            </label>
            <input
              type="number"
              name="latitude"
              value={formData.latitude}
              onChange={handleChange}
              step="0.0001"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Longitude */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Longitude *
            </label>
            <input
              type="number"
              name="longitude"
              value={formData.longitude}
              onChange={handleChange}
              step="0.0001"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              City
            </label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="e.g., New Delhi"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Address
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="e.g., 123 Main Street"
              rows="2"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Radius */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Radius (meters)
            </label>
            <input
              type="number"
              name="radius_meters"
              value={formData.radius_meters}
              onChange={handleChange}
              min="100"
              step="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition"
            >
              🚩 Create POI
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
