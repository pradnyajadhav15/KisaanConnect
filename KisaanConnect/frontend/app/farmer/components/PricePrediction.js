'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  predictCropPrice,
  checkPricePredictionApiHealth,
  getPriceOptions,
  getVarieties,
} from '../../../lib/pricePredictionService';
import './PricePrediction.css';

const DEFAULT_STATE = 'Maharashtra';
const INITIAL_FORM = { state: '', commodity: '', variety: '', quantity: '' };

const formatRs = (value) =>
  'Rs. ' + Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function PricePrediction() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [states, setStates] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiAvailable, setApiAvailable] = useState(true);

  // 1. Is the price service up? Then load the states it has data for.
  useEffect(() => {
    checkPricePredictionApiHealth()
      .then((ok) => {
        setApiAvailable(ok);
        if (!ok) return;
        return getPriceOptions().then(({ states: list }) => {
          setStates(list);
          const preferred = list.includes(DEFAULT_STATE) ? DEFAULT_STATE : list[0] || '';
          setFormData((prev) => ({ ...prev, state: preferred }));
        });
      })
      .catch(() => setApiAvailable(false));
  }, []);

  // 2. Crops this state has price data for, most traded first.
  useEffect(() => {
    if (!formData.state) return;
    let cancelled = false;
    getPriceOptions(formData.state)
      .then(({ commodities: list }) => {
        if (cancelled) return;
        setCommodities(list);
        setFormData((prev) => ({ ...prev, commodity: list[0] || '', variety: '' }));
      })
      .catch(() => !cancelled && setError('Could not load crops for this state. Please try again.'));
    return () => { cancelled = true; };
  }, [formData.state]);

  // 3. Varieties of that crop in that state, most reported first.
  useEffect(() => {
    if (!formData.state || !formData.commodity) return;
    let cancelled = false;
    getVarieties(formData.commodity, formData.state)
      .then(({ varieties: list }) => {
        if (cancelled) return;
        setVarieties(list || []);
        setFormData((prev) => ({ ...prev, variety: (list && list[0]) || '' }));
      })
      .catch(() => !cancelled && setVarieties([]));
    return () => { cancelled = true; };
  }, [formData.state, formData.commodity]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    // Clear the dependent dropdowns; the effects above refill them.
    if (name === 'state') {
      setCommodities([]);
      setVarieties([]);
    }
    if (name === 'commodity') setVarieties([]);
    setFormData((prev) => ({ ...prev, [name]: value }));
    setPrediction(null);
    setError('');
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.state) return setError('Please select a state');
    if (!formData.commodity) return setError('Please select a crop');
    if (!formData.quantity || Number(formData.quantity) <= 0) return setError('Please enter a valid quantity');

    setLoading(true);
    try {
      const result = await predictCropPrice({
        state: formData.state,
        commodity: formData.commodity,
        variety: formData.variety || null,
        quantity: parseFloat(formData.quantity),
      });
      setPrediction(result);
    } catch (err) {
      setPrediction(null);
      setError(err.message || 'Could not get a price prediction right now.');
    } finally {
      setLoading(false);
    }
  }, [formData]);

  if (!apiAvailable) {
    return (
      <div className="price-prediction">
        <h2>Crop Price Prediction Tool</h2>
        <p className="fallback-notice">
          The price prediction service is offline right now. Please try again in a few minutes,
          or check today&apos;s rate at your local mandi.
        </p>
      </div>
    );
  }

  return (
    <div className="price-prediction">
      <h2>Crop Price Prediction Tool</h2>

      <div className="prediction-container">
        <div className="prediction-form-container">
          <form onSubmit={handleSubmit} className="prediction-form" noValidate>
            {error && <p className="form-error" role="alert">{error}</p>}

            <div className="form-group">
              <label htmlFor="state">State *</label>
              <select id="state" name="state" value={formData.state} onChange={handleChange}>
                {states.length === 0 && <option value="">Loading states...</option>}
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="commodity">Crop *</label>
              <select id="commodity" name="commodity" value={formData.commodity} onChange={handleChange}>
                {commodities.length === 0 && <option value="">Loading crops...</option>}
                {commodities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="variety">Variety</label>
              <select id="variety" name="variety" value={formData.variety} onChange={handleChange}>
                {varieties.length === 0 && <option value="">Most common</option>}
                {varieties.map((v) => <option key={v} value={v}>{v}</option>)}
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
              <h3>Predicted Price (per kg)</h3>

              <div className="price-range">
                <span className="min-price">{formatRs(prediction.min_price_per_kg)}</span>
                <span className="median-price">{formatRs(prediction.price_per_kg)}</span>
                <span className="max-price">{formatRs(prediction.max_price_per_kg)}</span>
              </div>
              <div className="price-range-labels">
                <span>Low</span><span>Estimate</span><span>High</span>
              </div>

              <div className="total-value">
                <h4>Estimated value for {prediction.factors.quantity_kg} kg</h4>
                <p className="total-amount">{formatRs(prediction.factors.estimated_total_value)}</p>
              </div>

              <div className="prediction-factors">
                <p>Crop: <strong>{prediction.factors.commodity} ({prediction.factors.variety})</strong></p>
                <p>State: <strong>{prediction.factors.state}</strong></p>
                <p>Confidence: <strong>{prediction.confidence}</strong> ({prediction.factors.mandi_reports} mandi reports)</p>
              </div>

              <p className="fallback-notice">{prediction.disclaimer}</p>
            </div>
          ) : (
            <div className="no-prediction">
              <p>Fill in the form and click Predict Price to get a price prediction.</p>
              <div className="prediction-tips">
                <h4>Tips for better predictions:</h4>
                <ul>
                  <li>Pick the state where you plan to sell</li>
                  <li>Choose the variety you grow; it can change the price a lot</li>
                  <li>Low/High is the range mandis reported for this crop recently</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
