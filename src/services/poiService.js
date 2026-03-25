import { POI_API_URL } from '../utils/constants.js';

export const poiService = {
  /**
   * Fetch all POIs
   */
  async fetchPOIs() {
    try {
      const response = await fetch(POI_API_URL);
      const data = await response.json();
      return data.map(poi => ({ 
        ...poi, 
        name: poi.poi_name || poi.name 
      })) || [];
    } catch (error) {
      console.error('Error fetching POIs:', error);
      return [];
    }
  },

  /**
   * Add a new POI
   */
  async addPOI(poiData) {
    try {
      const response = await fetch(POI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(poiData),
      });
      if (!response.ok) throw new Error('Failed to add POI');
      return response.json();
    } catch (error) {
      console.error('Error adding POI:', error);
      throw error;
    }
  },

  /**
   * Update an existing POI
   */
  async updatePOI(id, poiData) {
    try {
      const response = await fetch(`${POI_API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(poiData),
      });
      if (!response.ok) throw new Error('Failed to update POI');
      return response.json();
    } catch (error) {
      console.error('Error updating POI:', error);
      throw error;
    }
  },

  /**
   * Delete a POI
   */
  async deletePOI(id) {
    try {
      const response = await fetch(`${POI_API_URL}/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete POI');
      return response.json();
    } catch (error) {
      console.error('Error deleting POI:', error);
      throw error;
    }
  },
};
