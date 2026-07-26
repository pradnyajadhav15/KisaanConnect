const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL + '/newsletter'
  : 'http://localhost:8000/newsletter';

export const subscribe = async ({ email, whatsapp_number }) => {
  const response = await fetch(API_BASE_URL + '/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, whatsapp_number }),
  });

  if (!response.ok) {
    let message = 'Could not subscribe. Please try again.';
    try {
      const err = await response.json();
      message = err.detail || message;
    } catch {}
    throw new Error(message);
  }

  return response.json();
};