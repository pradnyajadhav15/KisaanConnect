const API_ROOT = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const BASE = API_ROOT + '/consumer';

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

export const getMarketplace = () => call('/marketplace');
export const getMyOrders = () => call('/orders/mine');
export const getOrder = (orderId) => call('/orders/' + orderId);
export const placeOrder = (orderData) => call('/orders', { method: 'POST', body: JSON.stringify(orderData) });
export const getCart = (cartId) => call('/cart/' + cartId);
export const addToCart = (item) => call('/cart', { method: 'POST', body: JSON.stringify(item) });
export const removeCartItem = (cartId, itemId) => call('/cart/' + cartId + '/item/' + itemId, { method: 'DELETE' });
export const clearCart = (cartId) => call('/cart/' + cartId, { method: 'DELETE' });
export const getDashboardStats = () => call('/dashboard/stats');
