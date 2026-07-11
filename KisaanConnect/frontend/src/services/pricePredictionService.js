import { getToken } from './authService';

const API_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/price-prediction`
  : 'http://localhost:8000/price-prediction';


export const predictCropPrice = async (cropData) => {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(cropData),
  });

  if (!response.ok) {
    let message = 'Failed to predict price';
    try {
      const err = await response.json();
      message = err.detail || message;
    } catch { /* non-JSON response */ }
    throw new Error(message);
  }

  return response.json();
};


export const checkPricePredictionApiHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'healthy' && data.model_loaded === true;
  } catch {
    return false;
  }
};

export default { predictCropPrice, checkPricePredictionApiHealth };