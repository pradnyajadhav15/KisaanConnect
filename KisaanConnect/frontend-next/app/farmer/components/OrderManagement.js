'use client';
import { useState, useMemo, useCallback } from 'react';
import './OrderManagement.css';

const FILTERS = [
  { key: 'all', label: 'All Orders' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'rejected', label: 'Rejected' },
];

const capitalize = (s) => (s || '').charAt(0).toUpperCase() + (s || '').slice(1);

export default function OrderManagement({ orders, onUpdateStatus }) {
  const list = orders || [];
  const [filter, setFilter] = useState('all');

  const filteredOrders = useMemo(
    () => (filter === 'all' ? list : list.filter((o) => o.status === filter)),
    [list, filter]
  );

  const countFor = useCallback(
    (key) => (key === 'all' ? list.length : list.filter((o) => o.status === key).length),
    [list]
  );

  const handleStatusChange = useCallback((orderId, newStatus) => {
    onUpdateStatus(orderId, newStatus);
  }, [onUpdateStatus]);

  return (
    <div className="order-management">
      <h2>Order Management</h2>

      <div className="order-filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={'filter-button' + (filter === f.key ? ' active' : '')}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="filter-count">{' (' + countFor(f.key) + ')'}</span>
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <p className="no-orders-message">
          {'No ' + (filter !== 'all' ? filter + ' ' : '') + 'orders found.'}
        </p>
      ) : (
        <div className="order-table-container">
          <table className="order-table">
            <thead>
              <tr>
                <th>Order ID</th><th>Consumer</th><th>Date</th><th>Crop</th>
                <th>Quantity</th><th>Price</th><th>Total</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className={'order-row ' + order.status}>
                  <td>{'#' + order.id}</td>
                  <td>{order.consumerName || '-'}</td>
                  <td>{order.orderDate || (order.created_at ? order.created_at.split('T')[0] : '-')}</td>
                  <td>{order.cropName || order.crop_name || '-'}</td>
                  <td>{order.quantity + ' ' + order.unit}</td>
                  <td>{'Rs. ' + (order.price != null ? order.price : (order.unit_price != null ? order.unit_price : '-'))}</td>
                  <td>{'Rs. ' + (order.total != null ? order.total : (order.total_amount != null ? order.total_amount : '-'))}</td>
                  <td><span className={'status-badge ' + order.status}>{capitalize(order.status)}</span></td>
                  <td>
                    {order.status === 'pending' ? (
                      <div className="order-actions">
                        <button className="accept-button" onClick={() => handleStatusChange(order.id, 'accepted')}>Accept</button>
                        <button className="reject-button" onClick={() => handleStatusChange(order.id, 'rejected')}>Reject</button>
                      </div>
                    ) : order.status === 'accepted' ? (
                      <div className="order-actions">
                        <button className="deliver-button" onClick={() => handleStatusChange(order.id, 'delivered')}>Mark Delivered</button>
                      </div>
                    ) : (
                      <span className="action-taken">{capitalize(order.status)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
