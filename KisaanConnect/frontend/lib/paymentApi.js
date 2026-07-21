const API_ROOT = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const BASE = API_ROOT + '/payment';

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

export const createPaymentOrder = (orderId) =>
  call('/create-order', { method: 'POST', body: JSON.stringify({ order_id: orderId }) });

export const verifyPayment = (payload) =>
  call('/verify', { method: 'POST', body: JSON.stringify(payload) });
