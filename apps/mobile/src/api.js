import axios from 'axios';

const API_BASE = 'http://localhost:3001'; // change to your backend URL

const api = axios.create({ baseURL: API_BASE });

export async function signup(email, name) {
  const { data } = await api.post('/auth/signup', { email, name });
  return data;
}

export async function login(email) {
  const { data } = await api.post('/auth/login', { email });
  return data;
}

export async function getProfiles(q) {
  const { data } = await api.get('/profiles', { params: q ? { q } : {} });
  return data;
}

export async function getProfile(id) {
  const { data } = await api.get(`/profiles/${id}`);
  return data;
}

export async function createProfile(userId, skills, about, price) {
  const { data } = await api.post('/profiles', { userId, skills, about, price });
  return data;
}

export async function createMatch(a, b) {
  const { data } = await api.post('/matches', { a, b });
  return data;
}

export async function getMatches() {
  const { data } = await api.get('/matches');
  return data;
}

export default api;
