import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import '../../styles/consumer/MyOrders.css';

// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------
const STATUS_CLASSES = {
  pending:   'status-pending',
  confirmed: 'status-confirmed',
  shipped:   'status-shipped',
  delivered: 'status-delivered',
  cancelled: 'status-cancelled',
};

const TRACKING_STEPS = [
  { label: 'Order Placed', statuses: ['pending','confirmed','shipped','delivered'] },
  { label: 'Confirmed',    statuses: ['confirmed','shipped','delivered'] },
  { label: 'Shipped',      statuses: ['shipped','delivered'] },
  { label: 'Delivered',    statuses: ['delivered'] },
];

const getStatusClass = (status = '') =>
  STATUS_CLASSES[String(status).toLowerCase()] || '';

const safeAmount = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
};

// Tolerate both the locally-built order shape and the raw backend shape.
const getDate = (o) => o.date ?? (o.created_at ? String(o.created_at).split('T')[0].split(' ')[0] : '—');
const getTotal = (o) => o.totalAmount ?? o.total_amount ?? 0;
const getAddress = (o) => o.deliveryAddress ?? o.shipping_address ?? '—';
const getItems = (o) => Array.isArray(o.items) ? o.items : [];   // never undefined
const statusLower = (o) => String(o.status ?? '').toLowerCase();

// item field tolerance (local: name/price/total/productId; backend: crop_name/unit_price/crop_id)
const itemName  = (it) => it.name ?? it.crop_name ?? 'Item';
const itemPrice = (it) => Number(it.price ?? it.unit_price ?? 0);
const itemTotal = (it) => it.total ?? (itemPrice(it) * (it.quantity ?? 0));
const itemKey   = (it, i) => it.productId ?? it.crop_id ?? it.id ?? i;


// --------------------------------------------------
// ORDER DETAIL VIEW
// --------------------------------------------------
const OrderDetail = ({ order, onBack }) => {
  const items = getItems(order);
  const status = statusLower(order);
  return (
    <div className="order-details">
      <button className="back-button" onClick={onBack}>&larr; Back to Orders</button>

      <div className="order-details-header">
        <div className="order-info">
          <h3>Order #{order.id}</h3>
          <p className="order-date">Placed on: {getDate(order)}</p>
          <p className="order-status">
            Status:&nbsp;
            <span className={`status-badge ${getStatusClass(status)}`}>
              {order.status ?? 'pending'}
            </span>
          </p>
        </div>
        <div className="order-total">
          <p>Total: <span className="total-value">₹{safeAmount(getTotal(order))}</span></p>
        </div>
      </div>

      <div className="order-details-content">

        {/* Items table */}
        <div className="order-items-list">
          <h4>Items</h4>
          {items.length === 0 ? (
            <p className="no-items-message">Item details not available for this order.</p>
          ) : (
            <table className="order-items-table">
              <thead>
                <tr>
                  <th>Product</th><th>Price</th><th>Qty</th><th>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={itemKey(item, idx)} className="order-item-row">
                    <td>{itemName(item)}</td>
                    <td>₹{itemPrice(item)}</td>
                    <td>{item.quantity} {item.unit ?? ''}</td>
                    <td>₹{safeAmount(itemTotal(item))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Delivery info */}
        <div className="order-delivery-info">
          <h4>Delivery Information</h4>
          <p><strong>Address:</strong> {getAddress(order)}</p>
          <p><strong>Payment:</strong> {order.paymentMethod || 'Cash on Delivery'}</p>
        </div>

        {/* Tracking */}
        {status !== 'cancelled' && (
          <div className="order-tracking">
            <h4>Order Tracking</h4>
            <div className="tracking-timeline">
              {TRACKING_STEPS.map((step, i) => (
                <React.Fragment key={step.label}>
                  <div className={`tracking-step ${step.statuses.includes(status) ? 'active' : ''}`}>
                    <div className="step-icon">{i + 1}</div>
                    <div className="step-label">{step.label}</div>
                  </div>
                  {i < TRACKING_STEPS.length - 1 && (
                    <div className="tracking-connector" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};


// --------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------
const MyOrders = ({ orders = [] }) => {
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Newest orders first (tolerant of date vs created_at)
  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(getDate(b)) - new Date(getDate(a))),
    [orders]
  );

  if (selectedOrder) {
    return (
      <OrderDetail
        order={selectedOrder}
        onBack={() => setSelectedOrder(null)}
      />
    );
  }

  return (
    <div className="my-orders">
      <h2>My Orders</h2>

      {sortedOrders.length === 0 ? (
        <p className="no-orders-message">You haven't placed any orders yet.</p>
      ) : (
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map(order => (
              <tr key={order.id} className="order-row">
                <td>#{order.id}</td>
                <td>{getDate(order)}</td>
                <td>{getItems(order).length} item(s)</td>
                <td>₹{safeAmount(getTotal(order))}</td>
                <td>
                  <span className={`status-badge ${getStatusClass(statusLower(order))}`}>
                    {order.status ?? 'pending'}
                  </span>
                </td>
                <td>
                  <button
                    className="view-details-button"
                    onClick={() => setSelectedOrder(order)}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

MyOrders.propTypes = {
  orders: PropTypes.array.isRequired,
};

export default MyOrders;