import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Hero.css';
import heroImage from '../assets/images/hero.jpg';

const Hero = () => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const navigate = useNavigate();

  return (
    <div
      className={`hero-container ${imgLoaded ? 'loaded' : ''}`}
      style={{ backgroundImage: `url(${heroImage})` }}
      role="banner"
      aria-label="KisaanConnect — Farm fresh produce delivered to your home"
    >
      {/* Preload image to trigger onLoad */}
      <img
        src={heroImage}
        alt=""
        aria-hidden="true"
        style={{ display: 'none' }}
        onLoad={() => setImgLoaded(true)}
      />

      <div className="hero-overlay" />

      <div className="hero-content">
        <h1 className="hero-title">
          Bharat Ke Kheton Se,<br />
          Seedha Aapke Ghar Tak!
        </h1>
        <p className="hero-subtitle">
          Fresh produce directly from farmers — no middlemen, fair prices.
        </p>
        <div className="hero-actions">
          <button
            className="hero-btn primary"
            onClick={() => navigate('/consumer')}
          >
            Shop Now
          </button>
          <button
            className="hero-btn secondary"
            onClick={() => navigate('/register')}
          >
            Join as Farmer
          </button>
        </div>
      </div>
    </div>
  );
};

export default Hero;