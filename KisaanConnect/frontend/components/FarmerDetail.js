import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/FarmerDetail.css';

const FALLBACK_IMAGE = '/images/placeholder-farmer.png';

const MOCK_FARMERS = [
  { id: 1, name: 'Rajesh Kumar',    location: 'Punjab, India',      rating: 4.8,
    products: ['Rice','Wheat','Corn'],            deliveryTime: '2-3 days', subscriptionFee: 300,
    image: 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=500&q=60',
    bio: 'Third-generation farmer with over 25 years of experience in sustainable farming.' },
  { id: 2, name: 'Anita Desai',     location: 'Maharashtra, India', rating: 4.7,
    products: ['Tomatoes','Onions','Potatoes'],   deliveryTime: '1-2 days', subscriptionFee: 250,
    image: 'https://images.unsplash.com/photo-1594761051169-d300c0c2fb61?w=500&q=60',
    bio: 'Organic farmer specializing in pesticide-free vegetables.' },
  { id: 3, name: 'Sanjay Patel',    location: 'Gujarat, India',     rating: 4.9,
    products: ['Cotton','Peanuts','Spices'],      deliveryTime: '3-4 days', subscriptionFee: 350,
    image: 'https://images.unsplash.com/photo-1565372195458-9de0b320ef04?w=500&q=60',
    bio: 'Award-winning farmer focused on innovative agricultural techniques.' },
  { id: 4, name: 'Lakshmi Rajan',   location: 'Tamil Nadu, India',  rating: 4.6,
    products: ['Rice','Sugarcane','Coconuts'],    deliveryTime: '2-3 days', subscriptionFee: 275,
    image: 'https://images.unsplash.com/photo-1562011841-e1c4b757a247?w=500&q=60',
    bio: 'Specializes in heritage rice varieties and traditional farming methods.' },
  { id: 5, name: 'Harjinder Singh', location: 'Haryana, India',     rating: 4.5,
    products: ['Wheat','Mustard','Barley'],       deliveryTime: '2-3 days', subscriptionFee: 325,
    image: 'https://images.unsplash.com/photo-1535090042247-30387a6a6424?w=500&q=60',
    bio: 'Modern farming technology combined with sustainable methods.' },
];

const PAYMENT_METHODS = [
  { value: 'card',       label: 'Credit/Debit Card' },
  { value: 'upi',        label: 'UPI'               },
  { value: 'netbanking', label: 'Net Banking'        },
];

const StarRating = ({ rating }) => (
  <span className="star-rating" aria-label={`Rating: ${rating.toFixed(1)} out of 5`}>
    {'★'.repeat(Math.floor(rating))}{'☆'.repeat(5 - Math.floor(rating))}
    <span className="rating-value"> {rating.toFixed(1)}</span>
  </span>
);


const FarmerDetail = () => {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [farmer,        setFarmer]        = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [subscribed,    setSubscribed]    = useState(false);
  const [showModal,     setShowModal]     = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [subLoading,    setSubLoading]    = useState(false);

  // Fetch farmer
  useEffect(() => {
    const fetchFarmer = async () => {
      setLoading(true);
      try {
        // Replace with real API: const data = await farmerApi.getFarmerById(id);
        const found = MOCK_FARMERS.find(f => f.id === parseInt(id));
        if (!found) throw new Error('Not found');
        setFarmer(found);
      } catch {
        setError('Farmer not found.');
      } finally {
        setLoading(false);
      }
    };
    fetchFarmer();
  }, [id]);

  // Escape closes modal
  useEffect(() => {
    if (!showModal) return;
    const handler = (e) => { if (e.key === 'Escape') setShowModal(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showModal]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = showModal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showModal]);

  const handleCompleteSubscription = useCallback(async () => {
    setSubLoading(true);
    try {
      // Replace with real API: await farmerApi.subscribeToFarm(farmer.id, paymentMethod);
      await new Promise(r => setTimeout(r, 800)); // simulate
      setSubscribed(true);
      setShowModal(false);
    } catch {
      setError('Subscription failed. Please try again.');
    } finally {
      setSubLoading(false);
    }
  }, [farmer, paymentMethod]);

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner" />
      <p>Loading farmer details...</p>
    </div>
  );

  if (error || !farmer) return (
    <div className="error-container">
      <h2>{error || 'Farmer not found'}</h2>
      <button className="back-button" onClick={() => navigate(-1)}>Go Back</button>
    </div>
  );

  return (
    <div className="farmer-detail-container">
      <button className="back-button" onClick={() => navigate(-1)}>
        &larr; Back to Farmer List
      </button>

      <div className="farmer-detail-card">

        {/* Header */}
        <div className="farmer-header">
          <div className="farmer-image-large">
            <img
              src={farmer.image || FALLBACK_IMAGE}
              alt={farmer.name}
              onError={e => { e.target.src = FALLBACK_IMAGE; }}
            />
          </div>
          <div className="farmer-header-info">
            <h1>{farmer.name}</h1>
            <p className="location">📍 {farmer.location}</p>
            <StarRating rating={farmer.rating} />
          </div>
        </div>

        <div className="farmer-bio">
          <h3>About the Farmer</h3>
          <p>{farmer.bio}</p>
        </div>

        <div className="farmer-products">
          <h3>Products Offered</h3>
          <ul className="products-list">
            {farmer.products.map(p => <li key={p} className="product-item">{p}</li>)}
          </ul>
        </div>

        <div className="delivery-info">
          <h3>Estimated Delivery Time</h3>
          <p>{farmer.deliveryTime}</p>
        </div>

        {/* Subscription */}
        <div className="subscription-section">
          <h3>Support this Farmer</h3>
          <div className="subscription-info">
            <p>Monthly subscription fee: <strong>₹{farmer.subscriptionFee}</strong></p>
            <p>Your subscription provides direct financial support, helping this farmer maintain sustainable practices.</p>

            {subscribed ? (
              <div className="subscribed-badge">
                <span className="check-icon">✓</span>
                <span>You've adopted this farm!</span>
              </div>
            ) : (
              <button className="subscribe-button" onClick={() => setShowModal(true)}>
                Adopt this Farm
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="subscription-modal" onClick={e => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setShowModal(false)}
              aria-label="Close modal">&times;</button>

            <h2 id="modal-title">Adopt {farmer.name}'s Farm</h2>

            <div className="subscription-details">
              <p>You are about to subscribe to:</p>
              <h3>{farmer.name}</h3>
              <p className="subscription-price">₹{farmer.subscriptionFee} / month</p>

              <div className="payment-methods">
                <h4>Select Payment Method</h4>
                <div className="payment-options">
                  {PAYMENT_METHODS.map(({ value, label }) => (
                    <label key={value} className="payment-option">
                      <input type="radio" name="paymentMethod" value={value}
                        checked={paymentMethod === value}
                        onChange={e => setPaymentMethod(e.target.value)} />
                      <span className="payment-label">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="subscription-benefits">
                <h4>Benefits:</h4>
                <ul>
                  <li>Direct financial support to the farmer</li>
                  <li>Priority access to products</li>
                  <li>Regular updates from the farm</li>
                  <li>Invitation to farm visits (where applicable)</li>
                </ul>
              </div>

              <div className="subscription-actions">
                <button className="cancel-button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button className="confirm-button"
                  onClick={handleCompleteSubscription} disabled={subLoading}>
                  {subLoading ? 'Processing...' : 'Confirm Subscription'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmerDetail;