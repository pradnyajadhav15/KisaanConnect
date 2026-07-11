const TOKEN_KEY = 'auth_token';
const USER_KEY  = 'user_info';
export const AUTH_EVENT = 'auth-state-changed';

const dispatchAuthEvent = () => {
  window.dispatchEvent(new Event(AUTH_EVENT));
};


// --------------------------------------------------
// TOKEN HELPERS
// --------------------------------------------------

// Decode a JWT payload WITHOUT verifying it. We only read 'exp' to decide
// whether to bother making a request — real verification happens server-side.
const decodeToken = (token) => {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const isTokenExpired = (token) => {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return true;       // no exp → treat as invalid
  // exp is in SECONDS; Date.now() is ms. Add 10s skew so we don't cut it too fine.
  return Date.now() >= (payload.exp * 1000) - 10000;
};


// --------------------------------------------------
// AUTH ACTIONS
// --------------------------------------------------

export const loginUser = (userData, token) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(userData));
  dispatchAuthEvent();
  return true;
};

export const logoutUser = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  dispatchAuthEvent();
  return true;
};


// --------------------------------------------------
// AUTH STATE
// --------------------------------------------------

export const getToken = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isTokenExpired(token)) {        // expired → clear it so the app treats user as logged out
    logoutUser();
    return null;
  }
  return token;
};

export const getCurrentUser = () => {
  try {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const getUser = getCurrentUser;

export const getUserRole = () => getCurrentUser()?.role || null;

// Now reflects expiry, not just presence.
export const isAuthenticated = () => getToken() !== null;

export const hasRole = (role) => getCurrentUser()?.role === role;


// --------------------------------------------------
// DEFAULT EXPORT
// --------------------------------------------------
export default {
  loginUser,
  logoutUser,
  getCurrentUser,
  getUser,
  getUserRole,
  isAuthenticated,
  hasRole,
  getToken,
};