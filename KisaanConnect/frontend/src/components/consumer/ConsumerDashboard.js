import React, { useState, useEffect, useCallback } from 'react';
import '../../styles/consumer/ConsumerDashboard.css';
import BrowseProducts  from './BrowseProducts';
import ProductDetails  from './ProductDetails';
import ShoppingCart    from './ShoppingCart';
import Checkout        from './Checkout';
import MyOrders        from './MyOrders';
import * as consumerApi from '../../services/api/consumerApi';

const CART_ID_KEY = 'kisaan_cart_id';

const getOrCreateCartId = () => {
  let id = localStorage.getItem(CART_ID_KEY);
  if (!id) {
    id = 'cart-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(CART_ID_KEY, id);
  }
  return id;
};

const normalizeProduct = (p) => ({
  id:       p.id,
  name:     p.name,
  price:    Number(p.price_per_unit ?? p.price ?? 0),
  unit:     p.unit,
  quantity: Number(p.quantity ?? 0),
  image:    p.image_url ?? p.image ?? '',
  location: p.location ?? '',
});

const normalizeCartItem = (row) => ({
  id:        row.id,
  productId: row.crop_id,
  name:      row.crop_name,
  price:     Number(row.unit_price ?? 0),
  quantity:  Number(row.quantity ?? 0),
  total:     Number(row.unit_price ?? 0) * Number(row.quantity ?? 0),
});

const ConsumerDashboard = () => {
  const [activeTab,       setActiveTab]       = useState('browse');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart,            setCart]            = useState([]);
  const [products,        setProducts]        = useState([]);
  const [orders,          setOrders]          = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [notification,    setNotification]    = useState('');
  const [cartId]                              = useState(getOrCreateCartId);

  const notify = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const data = await consumerApi.getMarketplace();
        setProducts((data || []).map(normalizeProduct));
      } catch {
        notify('Failed to load products. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [notify]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await consumerApi.getMyOrders();
        setOrders(data?.orders || []);
      } catch {
        notify('Failed to load orders.');
      }
    };
    fetchOrders();
  }, [notify]);

  const refreshCart = useCallback(async () => {
    try {
      const data = await consumerApi.getCart(cartId);
      const items = Array.isArray(data && data.items) ? data.items : [];
      setCart(items.map(normalizeCartItem));
    } catch {
      setCart([]);
    }
  }, [cartId]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const handleAddToCart = useCallback(async (product, quantity = 1) => {
    if (product.quantity <= 0) return notify('This product is out of stock.');

    try {
      await consumerApi.addToCart({
        crop_id:  product.id,
        quantity: quantity,
        cart_id:  cartId,
      });
      await refreshCart();
      notify(product.name + ' added to cart!');
    } catch (err) {
      notify((err && err.message) || 'Could not add item to cart.');
    }
  }, [cartId, refreshCart, notify]);

  const handleUpdateCartItem = useCallback(async (productId, newQty) => {
    const existing = cart.find(i => i.productId === productId);
    if (!existing) return;

    try {
      if (newQty <= 0) {
        await consumerApi.removeCartItem(cartId, existing.id);
      } else {
        await consumerApi.removeCartItem(cartId, existing.id);
        await consumerApi.addToCart({
          crop_id:  productId,
          quantity: newQty,
          cart_id:  cartId,
        });
      }
      await refreshCart();
    } catch (err) {
      notify((err && err.message) || 'Could not update cart.');
    }
  }, [cart, cartId, refreshCart, notify]);

  const handleRemoveFromCart = useCallback(async (productId) => {
    const existing = cart.find(i => i.productId === productId);
    if (!existing) return;
    try {
      await consumerApi.removeCartItem(cartId, existing.id);
      await refreshCart();
    } catch (err) {
      notify((err && err.message) || 'Could not remove item.');
    }
  }, [cart, cartId, refreshCart, notify]);

  const handleCheckout = useCallback(() => {
    if (cart.length === 0) return notify('Your cart is empty!');
    setActiveTab('checkout');
  }, [cart, notify]);

  const handlePlaceOrder = useCallback(async (orderDetails) => {
    const phone = orderDetails.phone || orderDetails.phoneNumber || '';
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return notify('Please enter a valid phone number (at least 10 digits).');
    }

    try {
      const response = await consumerApi.placeOrder({
        shipping_address: orderDetails.shipping_address || orderDetails.address,
        phone: phone,
        cart_id: cartId,
        items: cart.map(i => ({
          crop_id:  i.productId,
          quantity: i.quantity,
        })),
      });

      const totalAmount = response.total_amount
        ?? cart.reduce((sum, item) => sum + item.total, 0);

      setOrders(prev => [...prev, {
        id:              response.order_id,
        date:            new Date().toISOString().split('T')[0],
        items:           [...cart],
        totalAmount,
        status:          'Pending',
        deliveryAddress: orderDetails.shipping_address || orderDetails.address,
        paymentMethod:   orderDetails.paymentMethod,
      }]);

      await refreshCart();

      if (orderDetails.paymentMethod !== 'online') {
        setActiveTab('myOrders');
        notify('Order placed successfully!');
      }

      return { order_id: response.order_id, total_amount: totalAmount };
    } catch (err) {
      notify((err && err.message) || 'Failed to place order. Please try again.');
      throw err;
    }
  }, [cart, cartId, refreshCart, notify]);

  const handleViewProduct = useCallback((product) => {
    setSelectedProduct(product);
    setActiveTab('productDetails');
  }, []);

  const handleBackToBrowse = useCallback(() => {
    setSelectedProduct(null);
    setActiveTab('browse');
  }, []);

  const cartItemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="consumer-dashboard">
      <h1 className="dashboard-title">Consumer Dashboard</h1>

      {notification && (
        <div className="dashboard-notification" role="status">{notification}</div>
      )}

      <div className="dashboard-tabs">
        {[
          { key: 'browse',   label: 'Browse Products' },
          { key: 'cart',     label: 'Shopping Cart',  badge: cartItemCount },
          { key: 'myOrders', label: 'My Orders' },
        ].map(tab => (
          <button
            key={tab.key}
            className={'tab-button ' + (activeTab === tab.key ? 'active' : '')}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span className="cart-badge">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      <div className="dashboard-content">
        {loading && <p className="loading-message">Loading products...</p>}

        {!loading && activeTab === 'browse' && (
          <BrowseProducts
            products={products}
            onViewProduct={handleViewProduct}
            onAddToCart={handleAddToCart}
          />
        )}

        {activeTab === 'productDetails' && selectedProduct && (
          <ProductDetails
            product={selectedProduct}
            onAddToCart={handleAddToCart}
            onBack={handleBackToBrowse}
          />
        )}

        {activeTab === 'cart' && (
          <ShoppingCart
            cartItems={cart}
            onUpdateQuantity={handleUpdateCartItem}
            onRemoveItem={handleRemoveFromCart}
            onCheckout={handleCheckout}
          />
        )}

        {activeTab === 'checkout' && (
          <Checkout
            cartItems={cart}
            onPlaceOrder={handlePlaceOrder}
            onBack={() => setActiveTab('cart')}
          />
        )}

        {activeTab === 'myOrders' && (
          <MyOrders orders={orders} />
        )}
      </div>
    </div>
  );
};

export default ConsumerDashboard;

