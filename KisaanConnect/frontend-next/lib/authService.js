const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_info';
export const AUTH_EVENT = 'auth-state-changed';

const dispatchAuthEvent = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
};

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
  if (!payload || !payload.exp) return true;
  return Date.now() >= (payload.exp * 1000) - 10000;
};

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

export const getToken = () => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isTokenExpired(token)) {
    logoutUser();
    return null;
  }
  return token;
};

export const getCurrentUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const getUserRole = () => {
  const u = getCurrentUser();
  return u ? u.role : null;
};

export const isAuthenticated = () => getToken() !== null;

export const hasRole = (role) => {
  const u = getCurrentUser();
  return u ? u.role === role : false;
};
