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
      message = err.detail || message;
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

export const getPriceOptions = async () => {
  const res = await fetch(API_BASE_URL + '/options');
  if (!res.ok) throw new Error('Failed to fetch options');
  return res.json();
};

export const getVarieties = async (commodity) => {
  const res = await fetch(API_BASE_URL + '/varieties?commodity=' + encodeURIComponent(commodity));
  if (!res.ok) throw new Error('Failed to fetch varieties');
  return res.json();
};

export const getMarketRatesSnapshot = async () => {
  const { states, commodities } = await getPriceOptions();
  const sampleStates = states.slice(0, 3);

  const requests = commodities.slice(0, 8).map((commodity) =>
    predictCropPrice({
      state: sampleStates[Math.floor(Math.random() * sampleStates.length)],
      commodity,
      quantity: 100,
    })
  );

  const results = await Promise.allSettled(requests);

  return commodities.slice(0, 8)
    .map((commodity, i) => {
      const r = results[i];
      if (r.status !== 'fulfilled') return null;
      return { crop: commodity, price: Math.round(r.value.price_per_kg), unit: 'kg' };
    })
    .filter(Boolean);
};