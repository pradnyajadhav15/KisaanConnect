const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const authHeaders = () => {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: 'Bearer ' + token } : {};
};

const handle = async (res) => {
  if (!res.ok) {
    let message = 'Request failed';
    try {
      const err = await res.json();
      message = err.detail || message;
    } catch {}
    throw new Error(message);
  }
  return res.json();
};

export const listNgos = async () =>
  handle(await fetch(BASE + '/ngo/ngos'));

export const getNgo = async (id) =>
  handle(await fetch(BASE + '/ngo/ngos/' + id));

export const createDonation = async (payload) =>
  handle(await fetch(BASE + '/ngo/donate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  }));

export const verifyDonation = async (payload) =>
  handle(await fetch(BASE + '/ngo/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  }));

export const myDonations = async () =>
  handle(await fetch(BASE + '/ngo/my-donations', { headers: authHeaders() }));

export const listPlots = async () =>
  handle(await fetch(BASE + '/adopt-farm/plots'));

export const getPlot = async (id) =>
  handle(await fetch(BASE + '/adopt-farm/plots/' + id));

export const adoptPlot = async (plot_id) =>
  handle(await fetch(BASE + '/adopt-farm/adopt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ plot_id }),
  }));

export const verifyAdoption = async (payload) =>
  handle(await fetch(BASE + '/adopt-farm/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  }));

export const myAdoptions = async () =>
  handle(await fetch(BASE + '/adopt-farm/my-adoptions', { headers: authHeaders() }));
export const createPlot = async (payload) =>
  handle(await fetch(BASE + '/adopt-farm/plots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  }));

export const myPlots = async () =>
  handle(await fetch(BASE + '/adopt-farm/my-plots', { headers: authHeaders() }));

export const postPlotUpdate = async (plotId, payload) =>
  handle(await fetch(BASE + '/adopt-farm/plots/' + plotId + '/updates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  }));