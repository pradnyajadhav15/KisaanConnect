const API_ROOT = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const API_BASE_URL = `${API_ROOT}/auth`;

// --------------------------------------------------
// HELPERS
// --------------------------------------------------
const parseApiError = async (response) => {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data))  return String(data[0]?.msg || data[0] || 'Request failed');
    if (data?.detail)         return typeof data.detail === 'string'
                                      ? data.detail
                                      : (data.detail[0]?.msg || 'Request failed');
    return JSON.stringify(data);
  } catch {
    return text || `Request failed (${response.status})`;
  }
};

// Central session teardown on auth failure.
const handleAuthFailure = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_info');
  window.dispatchEvent(new Event('auth-state-changed'));
  // Avoid redirect loops if already on the login page.
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign('/login');
  }
};

// Shared fetch. NOTE: ideally lives in one file (e.g. services/api/client.js)
// and is imported by authApi, consumerApi, farmerApi — not copied into each.
export const apiFetch = async (baseUrl, endpoint, options = {}) => {
  const token = localStorage.getItem('auth_token');

  let response;
  try {
    response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (networkErr) {
    // Network down / server unreachable — distinct from an HTTP error.
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  if (response.status === 401) {
    handleAuthFailure();
    throw new Error('Your session has expired. Please log in again.');
  }

  if (!response.ok) {
    const message = await parseApiError(response);
    throw new Error(message);
  }

  // Some endpoints (e.g. logout) may return empty bodies.
  const text = await response.text();
  return text ? JSON.parse(text) : {};
};

// Auth-scoped wrapper so existing calls keep working.
const authFetch = (endpoint, options) => apiFetch(API_BASE_URL, endpoint, options);


// --------------------------------------------------
// AUTH API
// --------------------------------------------------
export const registerUser = (userData) =>
  authFetch('/register', { method: 'POST', body: JSON.stringify(userData) });

export const loginUser = (credentials) =>
  authFetch('/login/user', { method: 'POST', body: JSON.stringify(credentials) });

export const verifyToken = () => authFetch('/me');