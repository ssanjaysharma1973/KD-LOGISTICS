/**
 * Frontend JWT Token Management
 * Helpers for storing, retrieving, and validating JWT tokens
 */

export function getToken() {
  return localStorage.getItem('token');
}

export function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

export function getClientId() {
  return localStorage.getItem('clientId');
}

export function isLoggedIn() {
  return !!getToken() && !!getUser();
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('clientId');
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('expiresIn');
  // Redirect to login
  window.location.href = '/login';
}

export function getAuthHeaders() {
  const token = getToken();
  return token ? {
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': getClientId(),
  } : {};
}

export function withAuth(options = {}) {
  return {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
    ...options,
  };
}
