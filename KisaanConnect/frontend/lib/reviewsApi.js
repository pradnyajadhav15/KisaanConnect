const API_ROOT = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const BASE = API_ROOT + '/reviews';

const call = async (endpoint, options) => {
  const opts = options || {};
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const response = await fetch(BASE + endpoint, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...opts.headers,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Request failed (' + response.status + ')');
  }
  const text = await response.text();
  return text ? JSON.parse(text) : {};
};

export const getCropReviews = (cropId) => call('/crop/' + cropId);
export const canReview = (cropId) => call('/crop/' + cropId + '/can-review');
export const submitReview = (cropId, rating, comment) =>
  call('/crop/' + cropId, { method: 'POST', body: JSON.stringify({ rating, comment }) });