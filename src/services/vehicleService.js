import { VEHICLES_API_URL } from '../utils/constants.js';

export const vehicleService = {
  /**
   * Fetch all vehicles
   * @param {Object} options - Options including tenantId
   * @returns {Promise<Array>} Array of vehicles
   */
  async fetchVehicles(options = {}) {
    const { tenantId } = options;
    const headers = tenantId ? { 'X-Tenant-ID': tenantId } : {};

    try {
      const response = await fetch(VEHICLES_API_URL, { headers });
      const data = await response.json();
      return data.vehicles || data || [];
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      return [];
    }
  },

  /**
   * Add a new vehicle
   */
  async addVehicle(vehicleData) {
    try {
      const response = await fetch(VEHICLES_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicleData),
      });
      if (!response.ok) throw new Error('Failed to add vehicle');
      return response.json();
    } catch (error) {
      console.error('Error adding vehicle:', error);
      throw error;
    }
  },

  /**
   * Update an existing vehicle
   */
  async updateVehicle(id, vehicleData) {
    try {
      const response = await fetch(`${VEHICLES_API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicleData),
      });
      if (!response.ok) throw new Error('Failed to update vehicle');
      return response.json();
    } catch (error) {
      console.error('Error updating vehicle:', error);
      throw error;
    }
  },

  /**
   * Fetch vehicle track history
   */
  async fetchVehicleTrack(vehicleId, options = {}) {
    const { from, to, tenantId } = options;
    const headers = tenantId ? { 'X-Tenant-ID': tenantId } : {};

    try {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);

      const url = `${VEHICLES_API_URL}/${vehicleId}/track?${params.toString()}`;
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error('Failed to fetch vehicle track');
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching vehicle track:', error);
      return [];
    }
  },
};
