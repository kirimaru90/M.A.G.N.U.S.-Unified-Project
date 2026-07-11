// Same-origin: the edge proxy serves the app and proxies /api/* to the API on this host,
// so requests stay on the page's origin (no CORS). Override only for a cross-origin
// deployment (e.g. 'https://api.example.com').
export const API_BASE_URL = '/api';
