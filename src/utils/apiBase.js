// Shared API base URL.
// Reads VITE_API_BASE_URL at Vite build time.
// Falls back to '' (empty string) so that all /api/... requests go to the
// same origin — which is correct both on Railway (node server.js serves
// both the static build and the API) and in local dev (Vite proxies /api
// to http://localhost:3000 via vite.config.js proxy settings).
export const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
