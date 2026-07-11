import { apiFetch } from './authApi';

const BASE = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/farmer`
  : 'http://localhost:8000/farmer';

const call = (endpoint, options) => apiFetch(BASE, endpoint, options);

// Backend crop fields already match the frontend (name, unit, quantity,
// price_per_unit, location). Normalize price_per_unit -> price for consistency
// with the consumer side so components share one shape.
const normalizeCrop = (c) => ({
  id:             c.id,
  name:           c.name,
  quantity:       Number(c.quantity ?? 0),
  unit:           c.unit,
  price:          Number(c.price_per_unit ?? 0),
  price_per_unit: Number(c.price_per_unit ?? 0), // kept: backend write field
  description:    c.description ?? '',
  location:       c.location ?? '',
  available:      !!c.available,
  image:          c.image_url ?? '',
});

// --------------------------------------------------
// CROPS  (all token-derived — no farmer_id anywhere)
// --------------------------------------------------
export const getMyCrops = async () => {
  const data = await call('/mine');
  return (data || []).map(normalizeCrop);
};

export const addCrop = (cropData) =>
  call('/', { method: 'POST', body: JSON.stringify({
    name:           cropData.name,
    quantity:       cropData.quantity,
    unit:           cropData.unit,
    price_per_unit: cropData.price_per_unit ?? cropData.price,
    description:    cropData.description ?? null,
    location:       cropData.location ?? null,
    available:      cropData.available ?? true,
    image_url:      cropData.image_url ?? cropData.image ?? null,
  }) });

export const updateCrop = (cropId, cropData) =>
  call(`/${cropId}`, { method: 'PUT', body: JSON.stringify({
    name:           cropData.name,
    quantity:       cropData.quantity,
    unit:           cropData.unit,
    price_per_unit: cropData.price_per_unit ?? cropData.price,
    description:    cropData.description ?? null,
    location:       cropData.location ?? null,
    available:      cropData.available ?? true,
    image_url:      cropData.image_url ?? cropData.image ?? null,
  }) });

export const deleteCrop = (cropId) =>
  call(`/${cropId}`, { method: 'DELETE' });

// --------------------------------------------------
// DASHBOARD STATS  (token-derived — no id)
// --------------------------------------------------
export const getFarmerStats = () => call('/dashboard/stats');

// --------------------------------------------------
// ORDER MANAGEMENT  (backend endpoints exist: /farmer/orders, etc.)
// --------------------------------------------------
const normalizeOrder = (o) => ({
  id:               o.id,
  consumerName:     o.consumer_name ?? '',
  consumerId:       o.consumer_id,
  phone:            o.phone ?? '',
  total:            Number(o.total_amount ?? 0),
  status:           o.status ?? 'pending',
  shippingAddress:  o.shipping_address ?? '',
  date:             o.created_at ?? '',
  items:            (o.items || []).map(it => ({
    cropId:    it.crop_id,
    name:      it.crop_name ?? '',
    quantity:  Number(it.quantity ?? 0),
    unitPrice: Number(it.unit_price ?? 0),
  })),
});

export const getFarmerOrders = async () => {
  const data = await call('/orders');                 // GET /farmer/orders
  return { orders: (data?.orders || []).map(normalizeOrder), total: data?.total ?? 0 };
};

export const updateOrderStatus = (orderId, status) =>
  call(`/orders/${orderId}/status`, {                 // PATCH /farmer/orders/{id}/status
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const getFarmerOrderStats = () => call('/orders/stats');  // GET /farmer/orders/stats