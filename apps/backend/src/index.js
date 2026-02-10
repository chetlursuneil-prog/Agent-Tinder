const express = require('express');
const cors = require('cors');
const db = require('./db');
const stripeLib = require('stripe');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

function nowIso() { return new Date().toISOString(); }
function genId(prefix = 'id') { return `${prefix}_${Date.now()}_${Math.floor(Math.random()*1000)}`; }

let stripe = null;
if (process.env.STRIPE_SECRET) {
	stripe = stripeLib(process.env.STRIPE_SECRET);
}

app.get('/', (req, res) => res.send('AgentTinder backend running.'));
app.get('/health', (req, res) => res.json({ status: 'ok', time: nowIso() }));

// Auth
app.post('/auth/signup', async (req, res) => {
	try {
		const { email, name } = req.body || {};
		if (!email) return res.status(400).json({ error: 'email required' });
		const id = genId('user');
		const user = await db.addUser(id, email, name || null);
		res.json(user);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.post('/auth/login', async (req, res) => {
	try {
		const { email } = req.body || {};
		const user = await db.getUserByEmail(email);
		if (!user) return res.status(404).json({ error: 'user not found' });
		res.json({ token: 'stub-token', user });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Profiles
app.post('/profiles', async (req, res) => {
	try {
		const { userId, skills, about, price } = req.body || {};
		if (!userId) return res.status(400).json({ error: 'userId required' });
		const id = genId('profile');
		const p = await db.createProfile(id, userId, skills || [], about || '', price || null);
		res.json(p);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.get('/profiles', async (req, res) => {
	try {
		const q = req.query.q;
		const excludeForProfileId = req.query.excludeForProfileId;
		const list = await db.getProfiles(q, excludeForProfileId);
		res.json(list);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Specific profile routes MUST come before parameterized /profiles/:id
app.get('/profiles/search/advanced', async (req, res) => {
	try {
		const { q, excludeForProfileId, limit, offset, skills, minPrice, maxPrice, minRating, availability, sort } = req.query;
		const result = await db.getProfilesPaginated({
			q, excludeForProfileId,
			limit: limit ? parseInt(limit) : undefined,
			offset: offset ? parseInt(offset) : undefined,
			skills, minPrice: minPrice ? parseFloat(minPrice) : undefined,
			maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
			minRating: minRating ? parseFloat(minRating) : undefined,
			availability, sort
		});
		res.json(result);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.get('/profiles/user/:userId', async (req, res) => {
	try {
		const p = await db.getProfileByUserId(req.params.userId);
		if (!p) return res.status(404).json({ error: 'not found' });
		res.json(p);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.get('/profiles/:id', async (req, res) => {
	try {
		const p = await db.getProfileById(req.params.id);
		if (!p) return res.status(404).json({ error: 'not found' });
		res.json(p);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Matches
app.post('/matches', async (req, res) => {
	try {
		const { a, b } = req.body || {};
		if (!a || !b) return res.status(400).json({ error: 'a and b required' });
		if (a === b) return res.status(400).json({ error: 'cannot match self' });

		// API-level duplicate check (canonical order done in db)
		const existing = await db.findMatchByProfiles(a, b);
		if (existing && existing.id) {
			const m = await db.getMatchById(existing.id);
			return res.status(200).json(m);
		}

		// If the other profile already liked this profile, create a mutual match
		const reverseLike = await db.findLike(b, a);

		// If this profile already liked the other profile, return the existing like (idempotent)
		const existingLike = await db.findLike(a, b);
		if (existingLike && existingLike.id) {
			return res.status(200).json({ alreadyLiked: true, like: existingLike });
		}
		if (reverseLike && reverseLike.id) {
			const id = genId('match');
			const m = await db.createMatch(id, a, b);
			// clean up any lingering likes for the pair
			await db.deleteLikesBetween(a, b).catch(() => {});
			return res.status(201).json(m);
		}

		// Otherwise record a one-sided like and wait for the other party
		const likeId = genId('like');
		const createdRes = await db.createLike(likeId, a, b);
		const like = createdRes && createdRes.like ? createdRes.like : createdRes;
		if (createdRes && createdRes.created === false) {
			return res.status(200).json({ alreadyLiked: true, like });
		}
		return res.status(202).json({ liked: true, like });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.get('/matches', async (req, res) => {
	try {
		const list = await db.getMatches();
		res.json(list);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Likes: list incoming likes for a profile (so a user can see who liked them)
app.get('/likes/to/:profileId', async (req, res) => {
	try {
		const { profileId } = req.params;
		const likes = await db.getLikesTo(profileId);
		res.json(likes);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Likes: list outgoing likes from a profile (so a user can see who they liked)
app.get('/likes/from/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;
    const likes = await db.getLikesFrom(profileId);
    res.json(likes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Delete a like (decline or retract)
app.delete('/likes', async (req, res) => {
  try {
    const { fromProfile, toProfile } = req.body || {};
    if (!fromProfile || !toProfile) return res.status(400).json({ error: 'fromProfile and toProfile required' });
    await db.deleteLike(fromProfile, toProfile);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/matches/:id', async (req, res) => {
	try {
		const { id } = req.params;
		await db.deleteMatch(id);
		res.json({ ok: true });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Payments (Stripe) - stubs / simple intents
app.post('/payments/create-intent', async (req, res) => {
	try {
		const { amount, currency = 'usd' } = req.body || {};
		if (!amount) return res.status(400).json({ error: 'amount required' });
		if (!stripe) {
			return res.json({ client_secret: 'stub_client_secret', amount });
		}
		const pi = await stripe.paymentIntents.create({ amount: Math.round(amount * 100), currency });
		res.json({ client_secret: pi.client_secret });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'stripe error' });
	}
});

// Stripe webhook placeholder
app.post('/payments/webhook', express.raw({ type: 'application/json' }), (req, res) => {
	// In production verify webhook signature. Here we just log.
	console.log('stripe webhook received');
	res.sendStatus(200);
});

// Admin summary endpoint for dashboard / telegram
app.get('/admin/summary', async (req, res) => {
	try {
		const summary = await db.getSummary();
		summary.time = nowIso();
		res.json(summary);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Simple admin auth middleware (uses ADMIN_API_KEY if set)
function requireAdmin(req, res, next) {
	const key = process.env.ADMIN_API_KEY;
	if (!key) return next(); // allow in dev if not set
	const v = req.headers['x-admin-key'];
	if (!v || v !== key) return res.status(403).json({ error: 'admin key required' });
	return next();
}

// Admin: get user by id
app.get('/users/:id', requireAdmin, async (req, res) => {
	try {
		const u = await db.getUserById(req.params.id);
		if (!u) return res.status(404).json({ error: 'user not found' });
		res.json(u);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Admin: nudge (send a reminder/message) - placeholder that logs an audit entry
app.post('/admin/nudge', requireAdmin, async (req, res) => {
	try {
		const { userId, message } = req.body || {};
		if (!userId) return res.status(400).json({ error: 'userId required' });
		await db.addAuditLog('nudge', req.headers['x-admin-id'] || 'admin', userId, { message });
		// In production, enqueue a notification to the user (email/push/telegram)
		res.json({ ok: true, userId, message });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Admin: suspend / unsuspend user
app.post('/admin/suspend/:userId', requireAdmin, async (req, res) => {
	try {
		const userId = req.params.userId;
		const { suspend } = req.body || {};
		if (typeof suspend !== 'boolean') return res.status(400).json({ error: 'suspend (boolean) required' });
		const u = await db.setUserSuspended(userId, suspend);
		res.json({ ok: true, user: u });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Messages
app.get('/messages/:matchId', async (req, res) => {
	try {
		const { matchId } = req.params;
		const messages = await db.getMessages(matchId);
		res.json(messages);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.post('/messages', async (req, res) => {
	try {
		const { matchId, fromUserId, text } = req.body || {};
		if (!matchId || !fromUserId || !text) return res.status(400).json({ error: 'matchId, fromUserId, text required' });
		const id = genId('message');
		const message = await db.addMessage(id, matchId, fromUserId, text);
		res.json(message);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Mark messages as read in a conversation
app.post('/messages/:matchId/read', async (req, res) => {
	try {
		const { matchId } = req.params;
		const { userId } = req.body || {};
		if (!userId) return res.status(400).json({ error: 'userId required' });
		await db.markMessagesRead(matchId, userId);
		res.json({ ok: true });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Conversations list (matches ordered by recent chat activity)
app.get('/conversations/:userId', async (req, res) => {
	try {
		const { userId } = req.params;
		// include cached avg_rating/review_count for both profiles
		const conversations = await db.getConversations_with_ratings(userId);
		res.json(conversations);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Unread message count for a user
app.get('/unread/:userId', async (req, res) => {
	try {
		const { userId } = req.params;
		const count = await db.getUnreadCount(userId);
		res.json({ count });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// ─── Reviews ────────────────────────────────────────────────
app.post('/reviews', async (req, res) => {
	try {
		const { fromUserId, toProfileId, matchId, rating, text } = req.body || {};
		if (!fromUserId || !toProfileId || !matchId || !rating) {
			return res.status(400).json({ error: 'fromUserId, toProfileId, matchId, rating required' });
		}
		// check if already reviewed
		const existing = await db.getReviewForMatch(fromUserId, matchId);
		if (existing) return res.status(409).json({ error: 'already reviewed', review: existing });

		const id = genId('review');
		const review = await db.createReview(id, fromUserId, toProfileId, matchId, rating, text || '');

		// notify the reviewed user
		const profile = await db.getProfileById(toProfileId);
		if (profile) {
			await db.createNotification(
				genId('notif'), profile.user_id, 'review',
				'New Review', `You received a ${rating}-star review!`,
				`/agents/${toProfileId}`
			);
		}

		res.status(201).json(review);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.get('/reviews/check/:matchId', async (req, res) => {
	try {
		const { userId } = req.query;
		if (!userId) return res.status(400).json({ error: 'userId query param required' });
		const review = await db.getReviewForMatch(userId, req.params.matchId);
		res.json({ reviewed: !!review, review: review || null });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.get('/reviews/:profileId', async (req, res) => {
	try {
		const reviews = await db.getReviewsForProfile(req.params.profileId);
		res.json(reviews);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// ─── Reports ────────────────────────────────────────────────
app.post('/reports', async (req, res) => {
	try {
		const { reporterUserId, reportedUserId, reason, details } = req.body || {};
		if (!reporterUserId || !reportedUserId || !reason) {
			return res.status(400).json({ error: 'reporterUserId, reportedUserId, reason required' });
		}
		const id = genId('report');
		const report = await db.createReport(id, reporterUserId, reportedUserId, reason, details || '');
		await db.addAuditLog('report_created', reporterUserId, reportedUserId, { reason, reportId: id });
		res.status(201).json(report);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.get('/reports', requireAdmin, async (req, res) => {
	try {
		const { status } = req.query;
		const reports = await db.getReports(status || null);
		res.json(reports);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.patch('/reports/:id', requireAdmin, async (req, res) => {
	try {
		const { adminNotes, status } = req.body || {};
		const report = await db.resolveReport(req.params.id, adminNotes, status);
		await db.addAuditLog('report_resolved', req.headers['x-admin-id'] || 'admin', req.params.id, { status, adminNotes });
		res.json(report);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// ─── Referrals ──────────────────────────────────────────────
app.post('/referrals', async (req, res) => {
	try {
		const { referrerUserId, referredEmail } = req.body || {};
		if (!referrerUserId || !referredEmail) {
			return res.status(400).json({ error: 'referrerUserId, referredEmail required' });
		}
		const code = 'REF-' + Math.random().toString(36).substr(2, 8).toUpperCase();
		const id = genId('ref');
		const referral = await db.createReferral(id, referrerUserId, referredEmail, code);
		res.status(201).json(referral);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.post('/referrals/redeem', async (req, res) => {
	try {
		const { code, userId } = req.body || {};
		if (!code || !userId) return res.status(400).json({ error: 'code, userId required' });
		const result = await db.redeemReferral(code, userId);
		if (!result) return res.status(404).json({ error: 'invalid or already redeemed code' });
		// notify referrer
		await db.createNotification(
			genId('notif'), result.referrer_user_id, 'referral',
			'Referral Redeemed', `Your referral code ${code} was used!`,
			'/referrals'
		);
		res.json(result);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.get('/referrals/:userId', async (req, res) => {
	try {
		const referrals = await db.getReferralsByUser(req.params.userId);
		res.json(referrals);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// ─── Notifications ──────────────────────────────────────────
app.get('/notifications/unread-count/:userId', async (req, res) => {
	try {
		const count = await db.getUnreadNotificationCount(req.params.userId);
		res.json({ count });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.get('/notifications/:userId', async (req, res) => {
	try {
		const unreadOnly = req.query.unread === 'true';
		const notifs = await db.getNotifications(req.params.userId, unreadOnly);
		res.json(notifs);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.patch('/notifications/:id/read', async (req, res) => {
	try {
		await db.markNotificationRead(req.params.id);
		res.json({ ok: true });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.post('/notifications/:userId/read-all', async (req, res) => {
	try {
		await db.markAllNotificationsRead(req.params.userId);
		res.json({ ok: true });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// ─── Boosts ─────────────────────────────────────────────────
app.post('/boosts', async (req, res) => {
	try {
		const { profileId, durationHours } = req.body || {};
		if (!profileId) return res.status(400).json({ error: 'profileId required' });
		// check if already boosted
		const active = await db.getActiveBoost(profileId);
		if (active) return res.status(409).json({ error: 'already boosted', boost: active });
		const id = genId('boost');
		const boost = await db.createBoost(id, profileId, durationHours || 24);
		await db.addAuditLog('boost_created', profileId, profileId, { durationHours });
		res.status(201).json(boost);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.get('/boosts/:profileId', async (req, res) => {
	try {
		const boost = await db.getActiveBoost(req.params.profileId);
		res.json({ active: !!boost, boost });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// ─── Saved Searches ─────────────────────────────────────────
app.post('/saved-searches', async (req, res) => {
	try {
		const { userId, query, filters } = req.body || {};
		if (!userId) return res.status(400).json({ error: 'userId required' });
		const id = genId('ss');
		const ss = await db.createSavedSearch(id, userId, query || '', filters || {});
		res.status(201).json(ss);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.get('/saved-searches/:userId', async (req, res) => {
	try {
		const searches = await db.getSavedSearches(req.params.userId);
		res.json(searches);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.delete('/saved-searches/:id', async (req, res) => {
	try {
		await db.deleteSavedSearch(req.params.id);
		res.json({ ok: true });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// ─── Admin Dashboard ────────────────────────────────────────
app.get('/admin/dashboard', requireAdmin, async (req, res) => {
	try {
		const dashboard = await db.getAdminDashboard();
		dashboard.time = nowIso();
		res.json(dashboard);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.get('/admin/users', requireAdmin, async (req, res) => {
	try {
		const { limit, offset } = req.query;
		const result = await db.getAllUsers(
			limit ? parseInt(limit) : undefined,
			offset ? parseInt(offset) : undefined
		);
		res.json(result);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.get('/admin/reports', requireAdmin, async (req, res) => {
	try {
		const reports = await db.getReports(req.query.status || null);
		res.json(reports);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

app.get('/admin/audit-logs', requireAdmin, async (req, res) => {
	try {
		const { limit, offset } = req.query;
		const logs = await db.getAuditLogs(
			limit ? parseInt(limit) : undefined,
			offset ? parseInt(offset) : undefined
		);
		res.json(logs);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Admin: create user
app.post('/admin/users', requireAdmin, async (req, res) => {
	try {
		const { email, name } = req.body || {};
		if (!email) return res.status(400).json({ error: 'email required' });
		const id = genId('user');
		const user = await db.addUser(id, email, name || null);
		await db.addAuditLog('admin_create_user', req.headers['x-admin-id'] || 'admin', id, { email, name });
		res.status(201).json(user);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Admin: update user
app.put('/admin/users/:id', requireAdmin, async (req, res) => {
	try {
		const { name, email, suspended } = req.body || {};
		const user = await db.updateUser(req.params.id, { name, email, suspended });
		if (!user) return res.status(404).json({ error: 'user not found' });
		await db.addAuditLog('admin_update_user', req.headers['x-admin-id'] || 'admin', req.params.id, { name, email, suspended });
		res.json(user);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Admin: delete user
app.delete('/admin/users/:id', requireAdmin, async (req, res) => {
	try {
		await db.deleteUser(req.params.id);
		await db.addAuditLog('admin_delete_user', req.headers['x-admin-id'] || 'admin', req.params.id, {});
		res.json({ ok: true });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Admin: get all profiles
app.get('/admin/profiles', requireAdmin, async (req, res) => {
	try {
		const { limit, offset } = req.query;
		const result = await db.getAllProfiles(
			limit ? parseInt(limit) : undefined,
			offset ? parseInt(offset) : undefined
		);
		res.json(result);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Admin: create profile for user
app.post('/admin/profiles', requireAdmin, async (req, res) => {
	try {
		const { userId, skills, about, price } = req.body || {};
		if (!userId) return res.status(400).json({ error: 'userId required' });
		const id = genId('profile');
		const p = await db.createProfile(id, userId, skills || [], about || '', price || null);
		await db.addAuditLog('admin_create_profile', req.headers['x-admin-id'] || 'admin', id, { userId });
		res.status(201).json(p);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Admin: update profile
app.put('/admin/profiles/:id', requireAdmin, async (req, res) => {
	try {
		const { skills, about, price } = req.body || {};
		const p = await db.updateProfile(req.params.id, { skills, about, price });
		if (!p) return res.status(404).json({ error: 'profile not found' });
		await db.addAuditLog('admin_update_profile', req.headers['x-admin-id'] || 'admin', req.params.id, { skills, about, price });
		res.json(p);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

// Admin: delete profile
app.delete('/admin/profiles/:id', requireAdmin, async (req, res) => {
	try {
		await db.deleteProfile(req.params.id);
		await db.addAuditLog('admin_delete_profile', req.headers['x-admin-id'] || 'admin', req.params.id, {});
		res.json({ ok: true });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'server error' });
	}
});

async function main() {
	await db.init();
	const port = process.env.PORT || 3001;
	app.listen(port, () => console.log(`Backend listening on ${port}`));
}

main().catch(err => {
	console.error('Failed to start server', err);
	process.exit(1);
});
