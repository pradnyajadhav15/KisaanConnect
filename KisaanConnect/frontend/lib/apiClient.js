const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function apiFetch(endpoint, options) {
  const opts = options || {};
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const response = await fetch(API_BASE + endpoint, {
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
}

export function getMarketplace() {
  return apiFetch('/consumer/marketplace');
}
