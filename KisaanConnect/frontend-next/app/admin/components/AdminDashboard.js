'use client';
import { useState, useEffect, useCallback } from 'react';
import * as adminApi from '../../../lib/adminApi';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [crops, setCrops] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState('');

  const notify = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await adminApi.getAdminStats();
      setStats(data);
    } catch (err) {
      notify((err && err.message) || 'Failed to load stats');
    }
  }, [notify]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await adminApi.getUsers();
      setUsers(data || []);
    } catch (err) {
      notify((err && err.message) || 'Failed to load users');
    }
  }, [notify]);

  const loadCrops = useCallback(async () => {
    try {
      const data = await adminApi.getAllCrops();
      setCrops(data || []);
    } catch (err) {
      notify((err && err.message) || 'Failed to load crops');
    }
  }, [notify]);

  const loadOrders = useCallback(async () => {
    try {
      const data = await adminApi.getAllOrders();
      setOrders((data && data.orders) || []);
    } catch (err) {
      notify((err && err.message) || 'Failed to load orders');
    }
  }, [notify]);

  useEffect(() => {
    setLoading(true);
    loadStats().finally(() => setLoading(false));
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'crops') loadCrops();
    if (activeTab === 'orders') loadOrders();
  }, [activeTab, loadUsers, loadCrops, loadOrders]);

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm('Delete user "' + username + '"? This cannot be undone.')) return;
    try {
      await adminApi.deleteUser(userId);
      notify('User deleted');
      loadUsers();
    } catch (err) {
      notify((err && err.message) || 'Failed to delete user');
    }
  };

  const handleToggleCrop = async (cropId) => {
    try {
      await adminApi.toggleCropAvailability(cropId);
      notify('Crop availability updated');
      loadCrops();
    } catch (err) {
      notify((err && err.message) || 'Failed to update crop');
    }
  };

  const handleDeleteCrop = async (cropId, name) => {
    if (!window.confirm('Remove listing "' + name + '"?')) return;
    try {
      await adminApi.adminDeleteCrop(cropId);
      notify('Crop removed');
      loadCrops();
    } catch (err) {
      notify((err && err.message) || 'Failed to remove crop');
    }
  };

  const handleOrderStatusChange = async (orderId, newStatus) => {
    try {
      await adminApi.updateOrderStatus(orderId, newStatus);
      notify('Order status updated');
      loadOrders();
    } catch (err) {
      notify((err && err.message) || 'Failed to update order');
    }
  };

  return (
    <div className="admin-dashboard">
      <h1 className="dashboard-title">Admin Dashboard</h1>

      {notification && (
        <div className="dashboard-notification" role="status">{notification}</div>
      )}

      <div className="dashboard-tabs">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'users', label: 'Users' },
          { key: 'crops', label: 'Listings' },
          { key: 'orders', label: 'Orders' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={'tab-button ' + (activeTab === tab.key ? 'active' : '')}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="dashboard-content">
        {loading && <p className="loading-message">Loading...</p>}

        {activeTab === 'overview' && stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Total Farmers</span>
              <span className="stat-value">{stats.total_farmers}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Total Consumers</span>
              <span className="stat-value">{stats.total_consumers}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Total Listings</span>
              <span className="stat-value">{stats.total_crops}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Total Orders</span>
              <span className="stat-value">{stats.total_orders}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Total GMV</span>
              <span className="stat-value">{'Rs. ' + stats.total_gmv}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Orders (Last 7 Days)</span>
              <span className="stat-value">{stats.orders_last_7_days}</span>
            </div>
            <div className="stat-card wide">
              <span className="stat-label">Orders by Status</span>
              <div className="status-breakdown">
                {stats.orders_by_status.map((s) => (
                  <span key={s.status} className="status-chip">
                    {s.status + ': ' + s.c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th><th>Username</th><th>Role</th><th>Name</th><th>Email</th><th>Joined</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td><span className={'role-badge role-' + u.role}>{u.role}</span></td>
                  <td>{u.name || '-'}</td>
                  <td>{u.email || '-'}</td>
                  <td>{u.created_at ? String(u.created_at).split('T')[0] : '-'}</td>
                  <td>
                    {u.role !== 'admin' && (
                      <button className="danger-button" onClick={() => handleDeleteUser(u.id, u.username)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'crops' && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Farmer</th><th>Qty</th><th>Price</th><th>Available</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {crops.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.name}</td>
                  <td>{c.farmer_username}</td>
                  <td>{c.quantity + ' ' + c.unit}</td>
                  <td>{'Rs. ' + c.price_per_unit}</td>
                  <td>{c.available ? 'Yes' : 'No'}</td>
                  <td>
                    <button className="secondary-button" onClick={() => handleToggleCrop(c.id)}>
                      {c.available ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="danger-button" onClick={() => handleDeleteCrop(c.id, c.name)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'orders' && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th><th>Consumer</th><th>Total</th><th>Status</th><th>Date</th><th>Update Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.consumer_name}</td>
                  <td>{'Rs. ' + o.total_amount}</td>
                  <td><span className={'status-badge status-' + o.status}>{o.status}</span></td>
                  <td>{o.created_at ? String(o.created_at).split('T')[0] : '-'}</td>
                  <td>
                    <select
                      value={o.status}
                      onChange={(e) => handleOrderStatusChange(o.id, e.target.value)}
                    >
                      <option value="pending">pending</option>
                      <option value="confirmed">confirmed</option>
                      <option value="dispatched">dispatched</option>
                      <option value="delivered">delivered</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
