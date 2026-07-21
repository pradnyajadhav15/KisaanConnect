const API_ROOT = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_BASE = API_ROOT + '/auth';

const parseApiError = async (response) => {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    if (data && data.detail) {
      return typeof data.detail === 'string' ? data.detail : (data.detail[0] && data.detail[0].msg) || 'Request failed';
    }
    return JSON.stringify(data);
  } catch {
    return text || ('Request failed (' + response.status + ')');
  }
};

const authFetch = async (endpoint, options) => {
  const opts = options || {};
  let response;
  try {
    response = await fetch(API_BASE + endpoint, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...opts.headers,
      },
    });
  } catch (err) {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  if (!response.ok) {
    const message = await parseApiError(response);
    throw new Error(message);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
};

export const registerUser = (userData) =>
  authFetch('/register', { method: 'POST', body: JSON.stringify(userData) });

export const loginUser = (credentials) =>
  authFetch('/login/user', { method: 'POST', body: JSON.stringify(credentials) });
