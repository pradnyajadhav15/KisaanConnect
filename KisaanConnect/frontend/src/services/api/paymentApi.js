import { apiFetch } from './authApi';

const BASE = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL + '/payment'
  : 'http://localhost:8000/payment';

const call = (endpoint, options) => apiFetch(BASE, endpoint, options);

export const createPaymentOrder = (orderId) =>
  call('/create-order', { method: 'POST', body: JSON.stringify({ order_id: orderId }) });

export const verifyPayment = (payload) =>
  call('/verify', { method: 'POST', body: JSON.stringify(payload) });
