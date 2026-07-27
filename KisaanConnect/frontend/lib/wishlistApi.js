const API_ROOT = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const BASE = API_ROOT + '/wishlist';

const call = async (endpoint, options) => {
  const opts = options || {};
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const response = await fetch(BASE + endpoint, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...opts.headers,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Request failed (' + response.status + ')');
  }
  const text = await response.text();
  return text ? JSON.parse(text) : {};
};

export const getWishlistIds = async () => call('/mine/ids');
export const getWishlist = async () => call('/mine');
export const addToWishlist = async (cropId) => call('/' + cropId, { method: 'POST' });
export const removeFromWishlist = async (cropId) => call('/' + cropId, { method: 'DELETE' });