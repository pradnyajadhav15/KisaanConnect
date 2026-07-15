import { apiFetch } from './authApi';

const BASE = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL + '/admin'
  : 'http://localhost:8000/admin';

const call = (endpoint, options) => apiFetch(BASE, endpoint, options);

export const getAdminStats = () => call('/stats');

export const getUsers = (role) => call(role ? ('/users?role=' + role) : '/users');

export const getUserDetail = (userId) => call('/users/' + userId);

export const deleteUser = (userId) => call('/users/' + userId, { method: 'DELETE' });

export const getAllCrops = () => call('/crops');

export const toggleCropAvailability = (cropId) =>
  call('/crops/' + cropId + '/toggle-availability', { method: 'PATCH' });

export const adminDeleteCrop = (cropId) => call('/crops/' + cropId, { method: 'DELETE' });

export const getAllOrders = (status) => call(status ? ('/orders?status=' + status) : '/orders');

export const updateOrderStatus = (orderId, status) =>
  call('/orders/' + orderId + '/status', {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
