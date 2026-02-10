import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({ baseURL: API_BASE });

export async function signup(email, name) {
  const { data } = await api.post('/auth/signup', { email, name });
  return data;
}

export async function login(email) {
  const { data } = await api.post('/auth/login', { email });
  return data;
}

export async function getProfiles(params) {
  if (typeof params === 'string') {
    params = { q: params };
  }
  const { data } = await api.get('/profiles', { params: params || {} });
  return data;
}

export async function getProfile(id) {
  const { data } = await api.get(`/profiles/${id}`);
  return data;
}

export async function getProfileByUserId(userId) {
  const { data } = await api.get(`/profiles/user/${userId}`);
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

export async function unmatch(matchId) {
  const { data } = await api.delete(`/matches/${matchId}`);
  return data;
}

export async function getMessages(matchId) {
  const { data } = await api.get(`/messages/${matchId}`);
  return data;
}

export async function sendMessage(matchId, fromUserId, text) {
  const { data } = await api.post('/messages', { matchId, fromUserId, text });
  return data;
}

export async function markRead(matchId, userId) {
  const { data } = await api.post(`/messages/${matchId}/read`, { userId });
  return data;
}

export async function getConversations(userId) {
  const { data } = await api.get(`/conversations/${userId}`);
  return data;
}

export async function getUnreadCount(userId) {
  const { data } = await api.get(`/unread/${userId}`);
  return data;
}

export async function createPaymentIntent(amount) {
  const { data } = await api.post('/payments/create-intent', { amount });
  return data;
}

export async function getLikesTo(profileId) {
  const { data } = await api.get(`/likes/to/${profileId}`);
  return data;
}

export async function getLikesFrom(profileId) {
  const { data } = await api.get(`/likes/from/${profileId}`);
  return data;
}

export async function deleteLike(fromProfile, toProfile) {
  const { data } = await api.delete('/likes', { data: { fromProfile, toProfile } });
  return data;
}

// ─── Advanced search / pagination ───────────────────────────
export async function searchProfilesAdvanced(params) {
  const { data } = await api.get('/profiles/search/advanced', { params });
  return data;
}

// ─── Reviews ────────────────────────────────────────────────
export async function createReview({ fromUserId, toProfileId, matchId, rating, text }) {
  const { data } = await api.post('/reviews', { fromUserId, toProfileId, matchId, rating, text });
  return data;
}

export async function getReviews(profileId) {
  const { data } = await api.get(`/reviews/${profileId}`);
  return data;
}

export async function checkReview(matchId, userId) {
  const { data } = await api.get(`/reviews/check/${matchId}`, { params: { userId } });
  return data;
}

// ─── Reports ────────────────────────────────────────────────
export async function createReport({ reporterUserId, reportedUserId, reason, details }) {
  const { data } = await api.post('/reports', { reporterUserId, reportedUserId, reason, details });
  return data;
}

// ─── Referrals ──────────────────────────────────────────────
export async function createReferral(referrerUserId, referredEmail) {
  const { data } = await api.post('/referrals', { referrerUserId, referredEmail });
  return data;
}

export async function redeemReferral(code, userId) {
  const { data } = await api.post('/referrals/redeem', { code, userId });
  return data;
}

export async function getReferrals(userId) {
  const { data } = await api.get(`/referrals/${userId}`);
  return data;
}

// ─── Notifications ──────────────────────────────────────────
export async function getNotifications(userId, unreadOnly = false) {
  const { data } = await api.get(`/notifications/${userId}`, { params: unreadOnly ? { unread: 'true' } : {} });
  return data;
}

export async function getUnreadNotificationCount(userId) {
  const { data } = await api.get(`/notifications/unread-count/${userId}`);
  return data;
}

export async function markNotificationRead(notifId) {
  const { data } = await api.patch(`/notifications/${notifId}/read`);
  return data;
}

export async function markAllNotificationsRead(userId) {
  const { data } = await api.post(`/notifications/${userId}/read-all`);
  return data;
}

// ─── Boosts ─────────────────────────────────────────────────
export async function createBoost(profileId, durationHours) {
  const { data } = await api.post('/boosts', { profileId, durationHours });
  return data;
}

export async function getActiveBoost(profileId) {
  const { data } = await api.get(`/boosts/${profileId}`);
  return data;
}

// ─── Saved Searches ─────────────────────────────────────────
export async function createSavedSearch(userId, query, filters) {
  const { data } = await api.post('/saved-searches', { userId, query, filters });
  return data;
}

export async function getSavedSearches(userId) {
  const { data } = await api.get(`/saved-searches/${userId}`);
  return data;
}

export async function deleteSavedSearch(id) {
  const { data } = await api.delete(`/saved-searches/${id}`);
  return data;
}

// ─── Admin ──────────────────────────────────────────────────
const ADMIN_KEY = '20bee3ae-9c8c-4eb2-9d61-5a8adff57564';
const adminHeaders = { headers: { 'x-admin-key': ADMIN_KEY } };

export async function getAdminDashboard() {
  const { data } = await api.get('/admin/dashboard', adminHeaders);
  return data;
}

export async function getAdminUsers(limit, offset) {
  const { data } = await api.get('/admin/users', { params: { limit, offset }, ...adminHeaders });
  return data;
}

export async function getAdminAuditLogs(limit, offset) {
  const { data } = await api.get('/admin/audit-logs', { params: { limit, offset }, ...adminHeaders });
  return data;
}

export async function suspendUser(userId, suspend) {
  const { data } = await api.post(`/admin/suspend/${userId}`, { suspend }, adminHeaders);
  return data;
}

export async function getReportsAdmin(status) {
  const { data } = await api.get('/reports', { params: status ? { status } : {}, ...adminHeaders });
  return data;
}

export async function resolveReportAdmin(reportId, adminNotes, status) {
  const { data } = await api.patch(`/reports/${reportId}`, { adminNotes, status }, adminHeaders);
  return data;
}

export async function adminCreateUser(email, name) {
  const { data } = await api.post('/admin/users', { email, name }, adminHeaders);
  return data;
}

export async function adminUpdateUser(userId, fields) {
  const { data } = await api.put(`/admin/users/${userId}`, fields, adminHeaders);
  return data;
}

export async function adminDeleteUser(userId) {
  const { data } = await api.delete(`/admin/users/${userId}`, adminHeaders);
  return data;
}

export async function adminGetProfiles(limit, offset) {
  const { data } = await api.get('/admin/profiles', { params: { limit, offset }, ...adminHeaders });
  return data;
}

export async function adminCreateProfile(userId, skills, about, price) {
  const { data } = await api.post('/admin/profiles', { userId, skills, about, price }, adminHeaders);
  return data;
}

export async function adminUpdateProfile(profileId, fields) {
  const { data } = await api.put(`/admin/profiles/${profileId}`, fields, adminHeaders);
  return data;
}

export async function adminDeleteProfile(profileId) {
  const { data } = await api.delete(`/admin/profiles/${profileId}`, adminHeaders);
  return data;
}

export default api;
