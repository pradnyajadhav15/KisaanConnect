const API_ROOT = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const BASE = API_ROOT + '/farmer';

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

const normalizeCrop = (c) => ({
  id: c.id,
  name: c.name,
  quantity: Number(c.quantity || 0),
  unit: c.unit,
  price: Number(c.price_per_unit || 0),
  price_per_unit: Number(c.price_per_unit || 0),
  description: c.description || '',
  location: c.location || '',
  available: !!c.available,
  image: c.image_url || '',
});

export const getMyCrops = async () => {
  const data = await call('/mine');
  return (data || []).map(normalizeCrop);
};

export const addCrop = (cropData) =>
  call('/', { method: 'POST', body: JSON.stringify({
    name: cropData.name,
    quantity: cropData.quantity,
    unit: cropData.unit,
    price_per_unit: cropData.price_per_unit || cropData.price,
    description: cropData.description || null,
    location: cropData.location || null,
    available: cropData.available !== undefined ? cropData.available : true,
    image_url: cropData.image_url || cropData.image || null,
  }) }).then(normalizeCrop);

export const updateCrop = (cropId, cropData) =>
  call('/' + cropId, { method: 'PUT', body: JSON.stringify({
    name: cropData.name,
    quantity: cropData.quantity,
    unit: cropData.unit,
    price_per_unit: cropData.price_per_unit || cropData.price,
    description: cropData.description || null,
    location: cropData.location || null,
    available: cropData.available !== undefined ? cropData.available : true,
    image_url: cropData.image_url || cropData.image || null,
  }) }).then(normalizeCrop);

export const deleteCrop = (cropId) => call('/' + cropId, { method: 'DELETE' });

export const getFarmerStats = () => call('/dashboard/stats');

export const getFarmerOrders = () => call('/orders').then(function(d) { return { orders: (d && d.orders) || [], total: (d && d.total) || 0 }; }).catch(function() { return { orders: [], total: 0 }; });
export const updateOrderStatus = (orderId, status) => call('/orders/' + orderId + '/status', { method: 'PATCH', body: JSON.stringify({ status: status }) });
