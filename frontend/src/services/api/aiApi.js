import { apiFetch } from './authApi';

const BASE = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/ai`
  : 'http://localhost:8000/ai';

const call = (endpoint, options) => apiFetch(BASE, endpoint, options);

// Farming Q&A chatbot — POST /ai/ask -> { answer }
export const askAssistant = (question) =>
  call('/ask', { method: 'POST', body: JSON.stringify({ question }) });

// Crop description writer — POST /ai/describe -> { description }
export const describeCrop = (crop_name, details = '') =>
  call('/describe', { method: 'POST', body: JSON.stringify({ crop_name, details }) });