import { apiFetch } from './authApi';

const BASE = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/consumer`
  : 'http://localhost:8000/consumer';

const call = (endpoint, options) => apiFetch(BASE, endpoint, options);

// --------------------------------------------------
// NORMALIZERS — map backend field names to the shape components expect.
// This is the ONE place field mapping should happen. Components downstream
// then never need price_per_unit / image_url / crop_name fallbacks.
// --------------------------------------------------
const normalizeProduct = (p) => ({
  id:          p.id,
  name:        p.name,
  price:       Number(p.price_per_unit ?? 0),
  unit:        p.unit,
  quantity:    Number(p.quantity ?? 0),
  description: p.description ?? '',
  location:    p.location ?? '',
  image:       p.image_url ?? '',
  farmerName:  p.farmer_name ?? null,   // backend doesn't send this yet (see note)
});

const normalizeOrderItem = (it) => ({
  productId: it.crop_id,
  name:      it.crop_name,
  price:     Number(it.unit_price ?? 0),
  quantity:  Number(it.quantity ?? 0),
  total:     Number(it.unit_price ?? 0) * Number(it.quantity ?? 0),
});

const normalizeOrder = (o) => ({
  id:              o.id,
  date:            o.created_at ? String(o.created_at).split('T')[0].split(' ')[0] : '',
  totalAmount:     Number(o.total_amount ?? 0),
  status:          o.status ?? 'pending',
  deliveryAddress: o.shipping_address ?? '',
  items:           Array.isArray(o.items) ? o.items.map(normalizeOrderItem) : [],
});

// --------------------------------------------------
// MARKETPLACE
// --------------------------------------------------
export const getMarketplace = async () => {
  const data = await call('/marketplace');
  return (data || []).map(normalizeProduct);
};

// --------------------------------------------------
// ORDERS  (token-derived — no consumer_id in the URL)
// --------------------------------------------------
export const getMyOrders = async () => {
  const data = await call('/orders/mine');
  return { orders: (data?.orders || []).map(normalizeOrder), total: data?.total ?? 0 };
};

// Fetch a single order WITH its items (backend /orders/{id} returns {order, items})
export const getOrder = async (orderId) => {
  const data = await call(`/orders/${orderId}`);
  return normalizeOrder({ ...data.order, items: data.items });
};

export const placeOrder = (orderData) =>
  // Backend expects only shipping_address + items[{crop_id, quantity}].
  call('/orders', { method: 'POST', body: JSON.stringify(orderData) });

// --------------------------------------------------
// CART
// --------------------------------------------------
export const getCart = (cartId) => call(`/cart/${cartId}`);

export const addToCart = (item) =>
  call('/cart', { method: 'POST', body: JSON.stringify(item) });

export const removeCartItem = (cartId, itemId) =>
  call(`/cart/${cartId}/item/${itemId}`, { method: 'DELETE' });

export const clearCart = (cartId) =>
  call(`/cart/${cartId}`, { method: 'DELETE' });

// --------------------------------------------------
// DASHBOARD STATS  (token-derived — no id)
// --------------------------------------------------
export const getDashboardStats = () => call('/dashboard/stats');