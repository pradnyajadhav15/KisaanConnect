const API_ROOT = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const BASE = API_ROOT + '/admin';

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

export const getAdminStats = () => call('/stats');
export const getUsers = (role) => call(role ? ('/users?role=' + role) : '/users');
export const getUserDetail = (userId) => call('/users/' + userId);
export const deleteUser = (userId) => call('/users/' + userId, { method: 'DELETE' });
export const getAllCrops = () => call('/crops');
export const toggleCropAvailability = (cropId) => call('/crops/' + cropId + '/toggle-availability', { method: 'PATCH' });
export const adminDeleteCrop = (cropId) => call('/crops/' + cropId, { method: 'DELETE' });
export const getAllOrders = (status) => call(status ? ('/orders?status=' + status) : '/orders');
export const updateOrderStatus = (orderId, status) =>
  call('/orders/' + orderId + '/status', { method: 'PATCH', body: JSON.stringify({ status }) });
