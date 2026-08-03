import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/AdoptFarm.css';

const FALLBACK_IMAGE = '/images/placeholder-farmer.png';

// Mock data as fallback if API unavailable
const MOCK_FARMERS = [
  { id: 1, name: 'Rajesh Kumar',   location: 'Punjab, India',      rating: 4.8,
    products: ['Rice','Wheat','Corn'],           deliveryTime: '2-3 days', subscriptionFee: 300,
    image: 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=500&q=60',
    bio: 'Third-generation farmer with over 25 years of experience in sustainable farming.' },
  { id: 2, name: 'Anita Desai',    location: 'Maharashtra, India', rating: 4.7,
    products: ['Tomatoes','Onions','Potatoes'],  deliveryTime: '1-2 days', subscriptionFee: 250,
    image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=500&q=80',
    bio: 'Organic farmer specializing in pesticide-free vegetables.' },
  { id: 3, name: 'Sanjay Patel',   location: 'Gujarat, India',     rating: 4.9,
    products: ['Cotton','Peanuts','Spices'],     deliveryTime: '3-4 days', subscriptionFee: 350,
    image: 'https://images.unsplash.com/photo-1565372195458-9de0b320ef04?w=500&q=60',
    bio: 'Award-winning farmer focused on innovative techniques.' },
  { id: 4, name: 'Lakshmi Rajan',  location: 'Tamil Nadu, India',  rating: 4.6,
    products: ['Rice','Sugarcane','Coconuts'],   deliveryTime: '2-3 days', subscriptionFee: 275,
    image: 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=500&q=80',
    bio: 'Specializes in heritage rice varieties.' },
  { id: 5, name: 'Harjinder Singh', location: 'Haryana, India',    rating: 4.5,
    products: ['Wheat','Mustard','Barley'],      deliveryTime: '2-3 days', subscriptionFee: 325,
    image: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=500&q=80',
    bio: 'Modern farming technology with sustainable methods.' },
];

const StarRating = ({ rating }) => {
  const full  = Math.floor(rating);
  const empty = 5 - full;
  return (
    <span
      className="star-rating"
      aria-label={`Rating: ${rating.toFixed(1)} out of 5`}
    >
      {'★'.repeat(full)}{'☆'.repeat(empty)}
      <span className="rating-value"> {rating.toFixed(1)}</span>
    </span>
  );
};

const AdoptFarm = () => {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        // Replace with real API when available
        // const data = await farmerApi.getAdoptableFarmers();
        // setFarmers(data);
        setFarmers(MOCK_FARMERS); // temporary
      } catch {
        setError('Failed to load farmers. Please try again later.');
        setFarmers(MOCK_FARMERS);
      } finally {
        setLoading(false);
      }
    };
    fetchFarmers();
  }, []);

  if (loading) return <p className="loading-message">Loading farmers...</p>;

  return (
    <div className="adopt-farm-container">
      <h1 className="adopt-farm-title">Adopt a Farm</h1>
      <p className="adopt-farm-description">
        Support local farmers by adopting their farms. Your monthly subscription helps them maintain
        sustainable farming practices and ensures a steady income regardless of market fluctuations.
      </p>

      {error && <p className="error-message" role="alert">{error}</p>}

      <div className="farmers-list">
        {farmers.map(farmer => (
          <Link to={`/adopt-farm/${farmer.id}`} key={farmer.id} className="farmer-card">
            <div className="farmer-image">
              <img
                src={farmer.image || FALLBACK_IMAGE}
                alt={farmer.name}
                onError={e => { e.target.src = FALLBACK_IMAGE; }}
              />
            </div>
            <div className="farmer-info">
              <h3>{farmer.name}</h3>
              <p className="location">📍 {farmer.location}</p>
              <StarRating rating={farmer.rating} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdoptFarm;