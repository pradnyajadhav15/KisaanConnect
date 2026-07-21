'use client';
import { useState, useEffect, useCallback } from 'react';
import AddCropForm from './AddCropForm';
import ManageListings from './ManageListings';
import PricePrediction from './PricePrediction';
import OrderManagement from './OrderManagement';
import CropHealthAnalysis from './CropHealthAnalysis';
import AIChatbot from './AIChatbot';
import * as farmerApi from '../../../lib/farmerApi';
import './FarmerDashboard.css';

const TABS = [
  { key: 'addCrop', label: 'Add New Crop' },
  { key: 'manageListings', label: 'Manage Listings' },
  { key: 'pricePrediction', label: 'Price Prediction' },
  { key: 'orderManagement', label: 'Order Management' },
  { key: 'cropHealth', label: 'AI Crop Health Analysis' },
  { key: 'aiAssistant', label: 'Ask AI' },
];

export default function FarmerDashboard() {
  const [activeTab, setActiveTab] = useState('addCrop');
  const [crops, setCrops] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState('');

  const notify = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  }, []);

  useEffect(() => {
    farmerApi.getFarmerOrders().then(function(data) { setOrders(data.orders || []); });
  }, []);

  const handleUpdateStatus = useCallback(async (orderId, status) => {
    try {
      await farmerApi.updateOrderStatus(orderId, status);
      setOrders(function(prev) { return prev.map(function(o) { return o.id === orderId ? Object.assign({}, o, { status: status }) : o; }); });
      notify('Order marked ' + status + '.');
    } catch {
      notify('Failed to update order.');
    }
  }, [notify]);

  useEffect(() => {
    const fetchCrops = async () => {
      setLoading(true);
      try {
        const data = await farmerApi.getMyCrops();
        setCrops(data || []);
      } catch {
        notify('Failed to load crops.');
      } finally {
        setLoading(false);
      }
    };
    fetchCrops();
  }, [notify]);

  const handleAddCrop = useCallback(async (newCrop) => {
    try {
      const created = await farmerApi.addCrop(newCrop);
      setCrops((prev) => [created, ...prev]);
      setActiveTab('manageListings');
      notify('Crop added successfully!');
    } catch (err) {
      notify('Failed to add crop.');
      throw err;
    }
  }, [notify]);

  const handleEditCrop = useCallback(async (editedCrop) => {
    try {
      const updated = await farmerApi.updateCrop(editedCrop.id, editedCrop);
      setCrops((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      notify('Crop updated successfully!');
    } catch {
      notify('Failed to update crop.');
    }
  }, [notify]);

  const handleDeleteCrop = useCallback(async (cropId) => {
    try {
      await farmerApi.deleteCrop(cropId);
      setCrops((prev) => prev.filter((c) => c.id !== cropId));
      notify('Crop deleted.');
    } catch {
      notify('Failed to delete crop.');
    }
  }, [notify]);

  return (
    <div className="farmer-dashboard">
      <h1 className="dashboard-title">Farmer Dashboard</h1>

      {notification && (
        <div className="dashboard-notification" role="status">{notification}</div>
      )}

      <div className="dashboard-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={'tab-button' + (activeTab === tab.key ? ' active' : '')}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="dashboard-content">
        {loading && <p className="loading-message">Loading...</p>}

        {activeTab === 'addCrop' && <AddCropForm onAddCrop={handleAddCrop} />}

        {activeTab === 'manageListings' && (
          <ManageListings crops={crops} onEditCrop={handleEditCrop} onDeleteCrop={handleDeleteCrop} />
        )}

        {activeTab === 'pricePrediction' && <PricePrediction />}
        {activeTab === 'orderManagement' && (
          <OrderManagement orders={orders} onUpdateStatus={handleUpdateStatus} />
        )}
        {activeTab === 'cropHealth' && <CropHealthAnalysis />}
        {activeTab === 'aiAssistant' && <AIChatbot />}
      </div>
    </div>
  );
}




