import React, { useState, useEffect, useCallback } from 'react';
import '../../styles/consumer/ConsumerDashboard.css';
import BrowseProducts  from './BrowseProducts';
import ProductDetails  from './ProductDetails';
import ShoppingCart    from './ShoppingCart';
import Checkout        from './Checkout';
import MyOrders        from './MyOrders';
import * as consumerApi from '../../services/api/consumerApi';

// Normalize a raw backend crop into the shape this dashboard uses.
// Backend returns: price_per_unit, image_url, id, name, unit, quantity, location.
const normalizeProduct = (p) => ({
  id:       p.id,
  name:     p.name,
  price:    Number(p.price_per_unit ?? p.price ?? 0),
  unit:     p.unit,
  quantity: Number(p.quantity ?? 0),
  image:    p.image_url ?? p.image ?? '',
  location: p.location ?? '',
});

const ConsumerDashboard = () => {
  const [activeTab,       setActiveTab]       = useState('browse');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart,            setCart]            = useState([]);
  const [products,        setProducts]        = useState([]);
  const [orders,          setOrders]          = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [notification,    setNotification]    = useState('');

  const notify = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  }, []);

  // --------------------------------------------------
  // Fetch products (normalized to internal shape)
  // --------------------------------------------------
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

  // --------------------------------------------------
  // Fetch orders — backend route is now /orders/mine (token-derived, no id)
  // --------------------------------------------------
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

  // --------------------------------------------------
  // CART HANDLERS
  // --------------------------------------------------
  const handleAddToCart = useCallback((product, quantity = 1) => {
    if (product.quantity <= 0) return notify('This product is out of stock.');

    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        const newQty = existing.quantity + quantity;
        if (newQty > product.quantity) {
          notify(`Only ${product.quantity} units available.`);
          return prev;
        }
        return prev.map(i => i.productId === product.id
          ? { ...i, quantity: newQty, total: newQty * i.price }
          : i
        );
      }
      return [...prev, {
        productId: product.id,
        name:      product.name,
        price:     product.price,
        unit:      product.unit,
        quantity,
        total:     product.price * quantity,
        image:     product.image || '',
      }];
    });
    notify(`${product.name} added to cart!`);
  }, [notify]);

  const handleUpdateCartItem = useCallback((productId, newQty) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter(i => i.productId !== productId));
    } else {
      setCart(prev => prev.map(i =>
        i.productId === productId
          ? { ...i, quantity: newQty, total: newQty * i.price }
          : i
      ));
    }
  }, []);

  const handleRemoveFromCart = useCallback((productId) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  }, []);

  // --------------------------------------------------
  // CHECKOUT
  // --------------------------------------------------
  const handleCheckout = useCallback(() => {
    if (cart.length === 0) return notify('Your cart is empty!');
    setActiveTab('checkout');
  }, [cart, notify]);

  const handlePlaceOrder = useCallback(async (orderDetails) => {
    // Backend requires: shipping_address, phone, items[{crop_id, quantity}].
    // consumer_id and total are derived/recomputed server-side.
    const phone = orderDetails.phone || orderDetails.phoneNumber || '';
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return notify('Please enter a valid phone number (at least 10 digits).');
    }

    try {
      const response = await consumerApi.placeOrder({
        shipping_address: orderDetails.shipping_address || orderDetails.address,
        phone: phone,
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

      setCart([]);
      setActiveTab('myOrders');
      notify('Order placed successfully!');
    } catch {
      notify('Failed to place order. Please try again.');
    }
  }, [cart, notify]);

  // --------------------------------------------------
  // NAVIGATION
  // --------------------------------------------------
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
            className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
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