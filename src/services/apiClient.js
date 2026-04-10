/**
 * Unified API Client with automatic JWT + Tenant Headers
 * Wraps all fetch() calls to inject:
 * - Authorization: Bearer {jwt_token}
 * - X-Tenant-ID: {clientId}
 * 
 * Usage:
 *   import apiClient from './services/apiClient';
 *   const data = await apiClient.get('/api/vehicles');
 *   const result = await apiClient.post('/api/pois', { name: 'New POI' });
 */

import { getToken, getUser, getClientId } from './tokenManager';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://kd-logistics-production.up.railway.app';

/**
 * Build authorization headers from stored JWT + Tenant Context
 */
function getAuthHeaders(isFormData = false) {
  const token = getToken();
  const clientId = getClientId();
  
  const headers = {};

  // Don't set Content-Type for FormData — browser sets it automatically with boundary
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (clientId) {
    headers['X-Tenant-ID'] = clientId;
  }

  return headers;
}

/**
 * Handle JSON response with error checking
 */
async function handleResponse(response, url) {
  const contentType = response.headers.get('content-type');
  
  if (!response.ok) {
    let errorData;
    try {
      errorData = contentType?.includes('application/json') ? await response.json() : { message: response.statusText };
    } catch {
      errorData = { message: response.statusText };
    }

    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401) {
      console.warn('[API] 401 Unauthorized - redirecting to login');
      // Clear stored session
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('clientId');
      // Redirect to login page
      window.location.href = '/login';
      throw new Error('Unauthorized - Please login again');
    }

    // Handle 403 Forbidden - cross-tenant access attempt
    if (response.status === 403) {
      console.error('[API] 403 Forbidden - Cross-tenant access denied:', errorData);
      throw new Error(errorData.error || 'Access Forbidden');
    }

    console.error(`[API] ${response.status} Error at ${url}:`, errorData);
    throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
  }

  // Return JSON response
  if (contentType?.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

/**
 * GET request
 */
async function get(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = getAuthHeaders();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      ...options,
    });

    return handleResponse(response, url);
  } catch (error) {
    console.error(`[API GET] ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * POST request
 */
async function post(endpoint, data, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const isFormData = data instanceof FormData;
  const headers = getAuthHeaders(isFormData);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: isFormData ? data : JSON.stringify(data),
      ...options,
    });

    return handleResponse(response, url);
  } catch (error) {
    console.error(`[API POST] ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * PUT request
 */
async function put(endpoint, data, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = getAuthHeaders();

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
      ...options,
    });

    return handleResponse(response, url);
  } catch (error) {
    console.error(`[API PUT] ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * DELETE request
 */
async function del(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = getAuthHeaders();

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
      ...options,
    });

    return handleResponse(response, url);
  } catch (error) {
    console.error(`[API DELETE] ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * PATCH request
 */
async function patch(endpoint, data, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = getAuthHeaders();

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
      ...options,
    });

    return handleResponse(response, url);
  } catch (error) {
    console.error(`[API PATCH] ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * Server-Sent Events subscription with auth headers
 */
function subscribe(endpoint, onData, onError) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();
  const clientId = getClientId();

  const eventSource = new EventSource(url, {
    // Note: EventSource doesn't natively support custom headers in browser
    // fallback: append token to URL if needed
    ...(token && { headers: { 'Authorization': `Bearer ${token}` } }),
  });

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onData(data);
    } catch (error) {
      console.error('[API SSE] Parse error:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('[API SSE] Error:', error);
    eventSource.close();
    if (onError) onError(error);
  };

  return eventSource;
}

// Export API client
const apiClient = {
  get,
  post,
  put,
  delete: del,
  patch,
  subscribe,
  getAuthHeaders, // Useful for custom fetch calls
};

export default apiClient;
