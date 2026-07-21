'use client';
import { useState, useEffect, useCallback } from 'react';
import { predictCropPrice, checkPricePredictionApiHealth } from '../../../lib/pricePredictionService';
import './PricePrediction.css';

const CATEGORIES = ['Vegetables', 'Fruits'];

const CROP_OPTIONS = {
  Vegetables: ['BITTER GOURD','BRINJAL','CABBAGE','CAULIFLOWER','GARLIC',
               'GINGER','GREEN CHILLY','OKRA','ONION','PEAS','POTATO','TOMATO'],
  Fruits: ['ACID LIME','AONLA','APPLE','APPLE (ANTI BIRD/ANTI HAIL NET)',
           'Apple Ber','BANANA','BER','CIRTUS','GRAPES','GUAVA','LITCHI',
           'MANGO','Mulberry','PAPAYA','Phalsa','PINEAPPLE','POMEGRANATE','SAPOTA'],
};

const LOCATIONS = [
  'AHMEDABAD','AMRITSAR','BANGALURU','BARAUT','BHOPAL','BHUBANESHWAR',
  'CHANDIGARH','CHENNAI','DEHRADUN','DELHI','GANGTOK','GUWAHATI','HYDERABAD',
  'JAIPUR','JAMMU','KOLKATA','LASALGAON','LUCKNOW','MUMBAI','NAGPUR','NASHIK',
  'PATNA','PIMPALGAON','PUNE','RAIPUR','RANCHI','SHIMLA','SRINAGAR',
  'TRIVANDRUM','VARANASI','VIJAYAWADA',
];

const FALLBACK_PRICES = {
  'BITTER GOURD': { min: 1500, max: 5000, median: 3000 },
  'BRINJAL': { min: 1200, max: 3500, median: 2200 },
  'CABBAGE': { min: 800, max: 2500, median: 1600 },
  'CAULIFLOWER': { min: 1500, max: 4000, median: 2600 },
  'GARLIC': { min: 2000, max: 8000, median: 4800 },
  'GINGER': { min: 3000, max: 10000, median: 6200 },
  'GREEN CHILLY': { min: 2000, max: 7000, median: 4200 },
  'OKRA': { min: 1500, max: 4500, median: 2900 },
  'ONION': { min: 1000, max: 4000, median: 2300 },
  'PEAS': { min: 2000, max: 5000, median: 3200 },
  'POTATO': { min: 800, max: 2500, median: 1600 },
  'TOMATO': { min: 1000, max: 4000, median: 2300 },
  'ACID LIME': { min: 1800, max: 5500, median: 3300 },
  'AONLA': { min: 2000, max: 6000, median: 3900 },
  'APPLE': { min: 3000, max: 9000, median: 5600 },
  'APPLE (ANTI BIRD/ANTI HAIL NET)': { min: 3500, max: 10000, median: 6200 },
  'Apple Ber': { min: 2500, max: 7000, median: 4100 },
  'BANANA': { min: 1000, max: 3000, median: 1800 },
  'BER': { min: 1200, max: 3500, median: 2300 },
  'CIRTUS': { min: 2000, max: 6000, median: 3600 },
  'GRAPES': { min: 2500, max: 8000, median: 4600 },
  'GUAVA': { min: 1800, max: 5000, median: 3300 },
  'LITCHI': { min: 3000, max: 8000, median: 5100 },
  'MANGO': { min: 2000, max: 10000, median: 5100 },
  'Mulberry': { min: 1500, max: 4000, median: 2600 },
  'PAPAYA': { min: 1000, max: 3000, median: 1800 },
  'Phalsa': { min: 2000, max: 5000, median: 3100 },
  'PINEAPPLE': { min: 1500, max: 5000, median: 2900 },
  'POMEGRANATE': { min: 3000, max: 9000, median: 5600 },
  'SAPOTA': { min: 1800, max: 5000, median: 3300 },
};

const INITIAL_FORM = { crop_name: '', category: 'Vegetables', center_state: '', quantity: '' };

export default function PricePrediction() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiAvailable, setApiAvailable] = useState(true);

  useEffect(() => {
    checkPricePredictionApiHealth()
      .then((ok) => setApiAvailable(ok))
      .catch(() => setApiAvailable(false));
  }, []);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, crop_name: '' }));
  }, [formData.category]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  }, [error]);

  const fallbackPrediction = useCallback((data) => {
    const range = FALLBACK_PRICES[data.crop_name] || { min: 1000, max: 5000, median: 2600 };
    const multiplier = parseFloat(data.quantity) > 100 ? 0.9 : 1.0;
    setPrediction({
      min: Math.round(range.min * multiplier),
      max: Math.round(range.max * multiplier),
      median: Math.round(range.median * multiplier),
      suggestedPrice: Math.round(range.median * multiplier),
      isFallback: true,
      factors: { ...data },
    });
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.crop_name) return setError('Please select a crop');
    if (!formData.center_state) return setError('Please select a market location');
    if (!formData.quantity || Number(formData.quantity) <= 0) return setError('Please enter a valid quantity');

    const payload = {
      crop_name: formData.crop_name,
      category: formData.category,
      center_state: formData.center_state,
      quantity: parseFloat(formData.quantity),
    };

    setLoading(true);
    try {
      if (apiAvailable) {
        const result = await predictCropPrice(payload);
        setPrediction({
          min: result.min_price,
          max: result.max_price,
          median: result.median_price || Math.round((result.min_price + result.max_price) / 2),
          factors: result.factors,
          isFallback: false,
        });
      } else {
        fallbackPrediction(payload);
      }
    } catch {
      fallbackPrediction(payload);
    } finally {
      setLoading(false);
    }
  }, [formData, apiAvailable, fallbackPrediction]);

  const cropList = CROP_OPTIONS[formData.category] || [];

  return (
    <div className="price-prediction">
      <h2>Crop Price Prediction Tool</h2>

      <div className="prediction-container">
        <div className="prediction-form-container">
          <form onSubmit={handleSubmit} className="prediction-form" noValidate>
            {error && <p className="form-error" role="alert">{error}</p>}

            <div className="form-group">
              <label htmlFor="category">Crop Category *</label>
              <select id="category" name="category" value={formData.category} onChange={handleChange}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="crop_name">Crop Name *</label>
              <select id="crop_name" name="crop_name" value={formData.crop_name} onChange={handleChange}>
                <option value="">Select a crop</option>
                {cropList.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="center_state">Destination Market Location *</label>
              <select id="center_state" name="center_state" value={formData.center_state} onChange={handleChange}>
                <option value="">Select a location</option>
                {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="quantity">Quantity (kg) *</label>
              <input type="number" id="quantity" name="quantity"
                value={formData.quantity} onChange={handleChange}
                placeholder="Enter quantity" min="1" disabled={loading} />
            </div>

            <button type="submit" className="predict-button" disabled={loading}>
              {loading ? 'Predicting...' : 'Predict Price'}
            </button>
          </form>
        </div>

        <div className="prediction-result-container">
          {prediction ? (
            <div className="prediction-result">
              <h3>Predicted Price Range (per kg)</h3>

              {prediction.isFallback && (
                <p className="fallback-notice">Using estimated prices (API unavailable)</p>
              )}

              <div className="price-range">
                <span className="min-price">{'Rs. ' + prediction.min}</span>
                <span className="median-price">{'Rs. ' + prediction.median}</span>
                <span className="max-price">{'Rs. ' + prediction.max}</span>
              </div>
              <div className="price-range-labels">
                <span>Min</span><span>Median</span><span>Max</span>
              </div>

              {prediction.suggestedPrice && (
                <div className="total-value">
                  <h4>Suggested Price</h4>
                  <p className="total-amount">{'Rs. ' + prediction.suggestedPrice}</p>
                </div>
              )}

              {prediction.factors && (
                <div className="prediction-factors">
                  <p>Crop: <strong>{prediction.factors.crop_name}</strong></p>
                  <p>Location: <strong>{prediction.factors.center_state}</strong></p>
                  <p>Quantity: <strong>{prediction.factors.quantity + ' kg'}</strong></p>
                </div>
              )}
            </div>
          ) : (
            <div className="no-prediction">
              <p>Fill in the form and click Predict Price to get a price prediction.</p>
              <div className="prediction-tips">
                <h4>Tips for better predictions:</h4>
                <ul>
                  <li>Select the exact crop category and name</li>
                  <li>Choose the destination market location where you plan to sell</li>
                  <li>Enter the precise quantity you plan to sell</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
