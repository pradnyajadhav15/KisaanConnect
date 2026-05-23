import React, { useState, useEffect, useCallback } from 'react';
import '../../styles/farmer/FarmerDashboard.css';
import AddCropForm        from './AddCropForm';
import ManageListings     from './ManageListings';
import PricePrediction    from './PricePrediction';
import OrderManagement    from './OrderManagement';
import CropHealthAnalysis from './CropHealthAnalysis';
import AIChatbot          from './AIChatbot';
import * as farmerApi     from '../../services/api/farmerApi';

const TABS = [
  { key: 'addCrop',         label: 'Add New Crop' },
  { key: 'manageListings',  label: 'Manage Listings' },
  { key: 'pricePrediction', label: 'Price Prediction' },
  { key: 'orderManagement', label: 'Order Management' },
  { key: 'cropHealth',      label: 'AI Crop Health Analysis' },
  { key: 'aiAssistant',     label: '🌾 Ask AI' },
];

const FarmerDashboard = () => {
  const [activeTab,    setActiveTab]    = useState('addCrop');
  const [crops,        setCrops]        = useState([]);
  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [notification, setNotification] = useState('');

  const notify = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  }, []);

  // --------------------------------------------------
  // Fetch crops — token-derived, no farmerId needed
  // --------------------------------------------------
  useEffect(() => {
    const fetchCrops = async () => {
      setLoading(true);
      try {
        const data = await farmerApi.getMyCrops();   // GET /farmer/mine
        setCrops(data || []);
      } catch {
        notify('Failed to load crops.');
      } finally {
        setLoading(false);
      }
    };
    fetchCrops();
  }, [notify]);

  // --------------------------------------------------
  // Fetch incoming orders for this farmer
  // --------------------------------------------------
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await farmerApi.getFarmerOrders();   // GET /farmer/orders
        setOrders(data?.orders || []);
      } catch {
        /* order endpoint optional; ignore if unavailable */
      }
    };
    fetchOrders();
  }, []);

  // --------------------------------------------------
  // CROP HANDLERS — no farmer_id sent; backend uses the token
  // --------------------------------------------------
  const handleAddCrop = useCallback(async (newCrop) => {
    try {
      const created = await farmerApi.addCrop(newCrop);
      setCrops(prev => [created, ...prev]);
      setActiveTab('manageListings');
      notify('Crop added successfully!');
    } catch {
      notify('Failed to add crop.');
      throw new Error('Failed to add crop'); // lets AddCropForm show its own error
    }
  }, [notify]);

  const handleEditCrop = useCallback(async (editedCrop) => {
    try {
      const updated = await farmerApi.updateCrop(editedCrop.id, editedCrop);
      setCrops(prev => prev.map(c => c.id === updated.id ? updated : c));
      notify('Crop updated successfully!');
    } catch {
      notify('Failed to update crop.');
    }
  }, [notify]);

  const handleDeleteCrop = useCallback(async (cropId) => {
    try {
      await farmerApi.deleteCrop(cropId);   // no farmer_id param
      setCrops(prev => prev.filter(c => c.id !== cropId));
      notify('Crop deleted.');
    } catch {
      notify('Failed to delete crop.');
    }
  }, [notify]);

  // --------------------------------------------------
  // ORDER STATUS UPDATE  (PATCH /farmer/orders/{id}/status)
  // --------------------------------------------------
  const handleUpdateStatus = useCallback(async (orderId, status) => {
    try {
      await farmerApi.updateOrderStatus(orderId, status);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      notify(`Order marked ${status}.`);
    } catch {
      notify('Failed to update order.');
    }
  }, [notify]);

  return (
    <div className="farmer-dashboard">
      <h1 className="dashboard-title">Farmer Dashboard</h1>

      {notification && (
        <div className="dashboard-notification" role="status">{notification}</div>
      )}

      <div className="dashboard-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="dashboard-content">
        {loading && <p className="loading-message">Loading...</p>}

        {activeTab === 'addCrop' && (
          <AddCropForm onAddCrop={handleAddCrop} />
        )}

        {activeTab === 'manageListings' && (
          <ManageListings
            crops={crops}
            onEditCrop={handleEditCrop}
            onDeleteCrop={handleDeleteCrop}
          />
        )}

        {activeTab === 'pricePrediction' && <PricePrediction />}

        {activeTab === 'orderManagement' && (
          <OrderManagement
            orders={orders}
            onUpdateStatus={handleUpdateStatus}
          />
        )}

        {activeTab === 'cropHealth' && <CropHealthAnalysis />}

        {activeTab === 'aiAssistant' && <AIChatbot />}
      </div>
    </div>
  );
};

export default FarmerDashboard;