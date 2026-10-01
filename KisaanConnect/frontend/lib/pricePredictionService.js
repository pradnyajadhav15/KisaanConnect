const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL + '/price-prediction'
  : 'http://localhost:8000/price-prediction';

const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
};

export const predictCropPrice = async (cropData) => {
  const token = getToken();
  const response = await fetch(API_BASE_URL + '/predict', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(cropData),
  });
  if (!response.ok) {
    let message = 'Failed to predict price';
    try {
      const err = await response.json();
      // FastAPI sends a string for our own errors and a list for validation errors.
      const detail = err.detail;
      message = Array.isArray(detail) ? detail.map((d) => d.msg).join('; ') : detail || message;
    } catch {}
    throw new Error(message);
  }
  return response.json();
};

export const checkPricePredictionApiHealth = async () => {
  try {
    const response = await fetch(API_BASE_URL + '/health');
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'healthy' && data.model_loaded === true;
  } catch {
    return false;
  }
};

// Pass a state to get only the crops that state has price data for.
export const getPriceOptions = async (state) => {
  const query = state ? '?state=' + encodeURIComponent(state) : '';
  const res = await fetch(API_BASE_URL + '/options' + query);
  if (!res.ok) throw new Error('Failed to fetch options');
  return res.json();
};

// Varieties come back most-reported first, so [0] is a sensible default.
export const getVarieties = async (commodity, state) => {
  let query = '?commodity=' + encodeURIComponent(commodity);
  if (state) query += '&state=' + encodeURIComponent(state);
  const res = await fetch(API_BASE_URL + '/varieties' + query);
  if (!res.ok) throw new Error('Failed to fetch varieties');
  return res.json();
};

// Ticker rates for one state's most traded crops (Maharashtra when available).
export const getMarketRatesSnapshot = async (preferredState = 'Maharashtra') => {
  const { states } = await getPriceOptions();
  const state = states.includes(preferredState) ? preferredState : states[0];
  if (!state) return [];
  const { commodities } = await getPriceOptions(state);
  const crops = commodities.slice(0, 8);

  const results = await Promise.allSettled(
    crops.map((commodity) => predictCropPrice({ state, commodity, quantity: 100 }))
  );

  return crops
    .map((commodity, i) => {
      const r = results[i];
      if (r.status !== 'fulfilled') return null;
      return { crop: commodity, price: Math.round(r.value.price_per_kg), unit: 'kg', state };
    })
    .filter(Boolean);
};