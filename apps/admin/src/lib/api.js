import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';

const api = axios.create({
  baseURL: API_BASE,
  headers: ADMIN_KEY ? { 'x-admin-key': ADMIN_KEY } : {},
});

export async function getSummary() {
  const { data } = await api.get('/admin/summary');
  return data;
}

export async function getProfiles() {
  const { data } = await api.get('/profiles');
  return data;
}

export async function getMatches() {
  const { data } = await api.get('/matches');
  return data;
}

export async function getUser(id) {
  const { data } = await api.get(`/users/${id}`);
  return data;
}

export async function nudgeUser(userId, message) {
  const { data } = await api.post('/admin/nudge', { userId, message });
  return data;
}

export async function suspendUser(userId, suspend) {
  const { data } = await api.post(`/admin/suspend/${userId}`, { suspend });
  return data;
}

export default api;
