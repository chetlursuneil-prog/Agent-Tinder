const { Pool } = require('pg');
const fs = require('fs');

let pool;

async function init() {
  const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/agenttinder';
  pool = new Pool({ connectionString });
  module.exports.pool = pool;

  // Create tables if they don't exist (simple schema for MVP)
  const stmts = [`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      suspended BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `, `
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      skills TEXT[],
      about TEXT,
      price NUMERIC,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `, `
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      a TEXT,
      b TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `, `
    -- Ensure the unordered pair (a,b) is unique by enforcing a canonical ordering in the app
    -- and creating a unique index on (a,b). The app will insert with a <= b.
    CREATE UNIQUE INDEX IF NOT EXISTS unique_matches_pair ON matches (a, b);
  `, `
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      match_id TEXT REFERENCES matches(id),
      amount NUMERIC,
      status TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `, `
    CREATE TABLE IF NOT EXISTS disputes (
      id TEXT PRIMARY KEY,
      contract_id TEXT REFERENCES contracts(id),
      reason TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `, `
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      match_id TEXT REFERENCES matches(id),
      from_user_id TEXT REFERENCES users(id),
      text TEXT NOT NULL,
      read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `];

  // Likes table: records one-sided likes between profiles. A mutual pair will be upgraded to a match.
  stmts.push(`
    CREATE TABLE IF NOT EXISTS likes (
      id TEXT PRIMARY KEY,
      from_profile TEXT NOT NULL,
      to_profile TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `);

  // Unique constraint so the same from->to like isn't duplicated
  stmts.push(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_likes_pair ON likes (from_profile, to_profile);
  `);

  // Audit log table
  stmts.push(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT,
      actor TEXT,
      target TEXT,
      details JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `);

  // Reviews / Ratings
  stmts.push(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      from_user_id TEXT REFERENCES users(id),
      to_profile_id TEXT REFERENCES profiles(id),
      match_id TEXT REFERENCES matches(id),
      rating INTEGER CHECK (rating >= 1 AND rating <= 5),
      text TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `);
  stmts.push(`CREATE UNIQUE INDEX IF NOT EXISTS unique_review_per_match ON reviews (from_user_id, match_id);`);

  // Reports / Moderation
  stmts.push(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_user_id TEXT REFERENCES users(id),
      reported_user_id TEXT REFERENCES users(id),
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT DEFAULT 'open',
      admin_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      resolved_at TIMESTAMP WITH TIME ZONE
    );
  `);

  // Referrals
  stmts.push(`
    CREATE TABLE IF NOT EXISTS referrals (
      id TEXT PRIMARY KEY,
      referrer_user_id TEXT REFERENCES users(id),
      referred_email TEXT NOT NULL,
      referred_user_id TEXT REFERENCES users(id),
      code TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `);

  // Notifications
  stmts.push(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      link TEXT,
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `);

  // Profile boosts
  stmts.push(`
    CREATE TABLE IF NOT EXISTS boosts (
      id TEXT PRIMARY KEY,
      profile_id TEXT REFERENCES profiles(id),
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `);

  // Saved searches
  stmts.push(`
    CREATE TABLE IF NOT EXISTS saved_searches (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      query TEXT,
      filters JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `);

  for (const s of stmts) {
    await pool.query(s);
  }

  // Migrations: add columns if they don't exist
  await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avg_rating NUMERIC DEFAULT 0`).catch(() => {});
  await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`).catch(() => {});

  return pool;
}

async function addUser(id, email, name) {
  await pool.query('INSERT INTO users (id,email,name) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING', [id, email, name]);
  return getUserByEmail(email);
}

async function getUserByEmail(email) {
  const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  return r.rows[0];
}

async function getUserById(id) {
  const r = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
  return r.rows[0];
}

async function setUserSuspended(id, suspended) {
  await pool.query('UPDATE users SET suspended=$2 WHERE id=$1', [id, suspended]);
  await addAuditLog(`suspend_${suspended ? 'on' : 'off'}`, 'system', id, { suspended });
  return getUserById(id);
}

async function addAuditLog(action, actor, target, details) {
  const id = `alog_${Date.now()}_${Math.floor(Math.random()*1000)}`;
  await pool.query('INSERT INTO audit_logs (id,action,actor,target,details) VALUES ($1,$2,$3,$4,$5)', [id, action, actor, target, details || {}]);
  return { id, action, actor, target, details };
}

async function createProfile(id, userId, skills, about, price) {
  await pool.query('INSERT INTO profiles (id,user_id,skills,about,price) VALUES ($1,$2,$3,$4,$5)', [id, userId, skills, about, price]);
  return getProfileById(id);
}

async function getProfiles(q, excludeForProfileId) {
  let query = 'SELECT p.*, u.name FROM profiles p JOIN users u ON p.user_id = u.id';
  const params = [];
  const conditions = [];

  // Build conditions with positional placeholders depending on params order
  if (q) {
    params.push(`%${q}%`);
    const idx = params.length; // 1-based
    conditions.push(`(array_to_string(p.skills,' ') ILIKE $${idx} OR p.about ILIKE $${idx})`);
  }

  if (excludeForProfileId) {
    params.push(excludeForProfileId);
    const idx = params.length;
    // exclude self
    conditions.push(`p.id != $${idx}`);
    // exclude already matched profiles (return the counterpart id)
    conditions.push(`p.id NOT IN (SELECT CASE WHEN a = $${idx} THEN b ELSE a END FROM matches WHERE a = $${idx} OR b = $${idx})`);
    // exclude profiles that this profile has already liked (one-sided)
    conditions.push(`p.id NOT IN (SELECT to_profile FROM likes WHERE from_profile = $${idx})`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  const r = await pool.query(query, params);
  return r.rows;
}

async function getProfileById(id) {
  const r = await pool.query('SELECT p.*, u.name FROM profiles p JOIN users u ON p.user_id = u.id WHERE p.id=$1', [id]);
  return r.rows[0];
}

async function getProfileByUserId(userId) {
  const r = await pool.query('SELECT p.*, u.name FROM profiles p JOIN users u ON p.user_id = u.id WHERE p.user_id=$1', [userId]);
  return r.rows[0];
}

async function createMatch(id, a, b) {
  // Canonicalize pair so that a <= b (lexicographic) to enforce unordered uniqueness
  let x = a;
  let y = b;
  if (x > y) [x, y] = [y, x];

  // Quick check to avoid attempting an insert if it already exists
  const existing = await pool.query('SELECT id FROM matches WHERE a = $1 AND b = $2 LIMIT 1', [x, y]);
  if (existing.rows.length) {
    return getMatchById(existing.rows[0].id);
  }

  try {
    await pool.query('INSERT INTO matches (id,a,b) VALUES ($1,$2,$3)', [id, x, y]);
    return getMatchById(id);
  } catch (err) {
    // Handle unique constraint race (another request inserted at the same time)
    if (err && err.code === '23505') {
      const r = await pool.query('SELECT id FROM matches WHERE a = $1 AND b = $2 LIMIT 1', [x, y]);
      if (r.rows.length) return getMatchById(r.rows[0].id);
    }
    throw err;
  }
}

async function findMatchByProfiles(a, b) {
  let x = a;
  let y = b;
  if (x > y) [x, y] = [y, x];
  const r = await pool.query('SELECT id FROM matches WHERE a = $1 AND b = $2 LIMIT 1', [x, y]);
  return r.rows[0];
}

// Likes helpers: record a one-sided like (from -> to)
async function createLike(id, fromProfile, toProfile) {
  try {
    await pool.query('INSERT INTO likes (id, from_profile, to_profile) VALUES ($1,$2,$3)', [id, fromProfile, toProfile]);
    const r = await pool.query('SELECT * FROM likes WHERE id = $1', [id]);
    return { like: r.rows[0], created: true };
  } catch (err) {
    // ignore unique violations (already liked)
    if (err && err.code === '23505') {
      const r = await pool.query('SELECT * FROM likes WHERE from_profile = $1 AND to_profile = $2 LIMIT 1', [fromProfile, toProfile]);
      return { like: r.rows[0], created: false };
    }
    throw err;
  }
}

async function findLike(fromProfile, toProfile) {
  const r = await pool.query('SELECT * FROM likes WHERE from_profile = $1 AND to_profile = $2 LIMIT 1', [fromProfile, toProfile]);
  return r.rows[0];
}

async function deleteLike(fromProfile, toProfile) {
  await pool.query('DELETE FROM likes WHERE from_profile = $1 AND to_profile = $2', [fromProfile, toProfile]);
}

async function deleteLikesBetween(a, b) {
  await pool.query('DELETE FROM likes WHERE (from_profile = $1 AND to_profile = $2) OR (from_profile = $2 AND to_profile = $1)', [a, b]);
}

async function getLikesTo(profileId) {
  const r = await pool.query(`
    SELECT l.*, pfrom.user_id as from_user_id, ufrom.name as from_name
    FROM likes l
    JOIN profiles pfrom ON l.from_profile = pfrom.id
    JOIN users ufrom ON pfrom.user_id = ufrom.id
    WHERE l.to_profile = $1
    ORDER BY l.created_at DESC
  `, [profileId]);
  return r.rows;
}

async function getLikesFrom(profileId) {
  const r = await pool.query(`
    SELECT l.*, pto.user_id as to_user_id, uto.name as to_name
    FROM likes l
    JOIN profiles pto ON l.to_profile = pto.id
    JOIN users uto ON pto.user_id = uto.id
    WHERE l.from_profile = $1
    ORDER BY l.created_at DESC
  `, [profileId]);
  return r.rows;
}

async function getMatches() {
  const r = await pool.query(`
    SELECT m.*,
      ua.name as name_a, ua.id as user_id_a,
      ub.name as name_b, ub.id as user_id_b,
      pa.avg_rating as avg_rating_a, pa.review_count as review_count_a,
      pb.avg_rating as avg_rating_b, pb.review_count as review_count_b
    FROM matches m
    JOIN profiles pa ON m.a = pa.id
    JOIN profiles pb ON m.b = pb.id
    JOIN users ua ON pa.user_id = ua.id
    JOIN users ub ON pb.user_id = ub.id
    ORDER BY m.created_at DESC
  `);
  return r.rows;
}

async function getMatchById(id) {
  const r = await pool.query(`
    SELECT m.*,
      ua.name as name_a, ua.id as user_id_a,
      ub.name as name_b, ub.id as user_id_b,
      pa.avg_rating as avg_rating_a, pa.review_count as review_count_a,
      pb.avg_rating as avg_rating_b, pb.review_count as review_count_b
    FROM matches m
    JOIN profiles pa ON m.a = pa.id
    JOIN profiles pb ON m.b = pb.id
    JOIN users ua ON pa.user_id = ua.id
    JOIN users ub ON pb.user_id = ub.id
    WHERE m.id = $1
  `, [id]);
  return r.rows[0];
}

async function deleteMatch(id) {
  await pool.query('DELETE FROM messages WHERE match_id = $1', [id]);
  await pool.query('DELETE FROM contracts WHERE match_id = $1', [id]);
  await pool.query('DELETE FROM matches WHERE id = $1', [id]);
  return { ok: true };
}

async function getSummary() {
  const users = await pool.query('SELECT COUNT(*) FROM users');
  const profiles = await pool.query('SELECT COUNT(*) FROM profiles');
  const matches = await pool.query('SELECT COUNT(*) FROM matches');
  const contracts = await pool.query('SELECT COUNT(*) FROM contracts');
  const disputes = await pool.query('SELECT COUNT(*) FROM disputes');
  return {
    users: parseInt(users.rows[0].count, 10),
    profiles: parseInt(profiles.rows[0].count, 10),
    matches: parseInt(matches.rows[0].count, 10),
    contracts: parseInt(contracts.rows[0].count, 10),
    disputes: parseInt(disputes.rows[0].count, 10)
  };
}

async function getMessages(matchId) {
  const r = await pool.query('SELECT m.*, u.name as from_name FROM messages m JOIN users u ON m.from_user_id = u.id WHERE m.match_id = $1 ORDER BY m.created_at ASC', [matchId]);
  return r.rows;
}

async function addMessage(id, matchId, fromUserId, text) {
  await pool.query('INSERT INTO messages (id, match_id, from_user_id, text) VALUES ($1, $2, $3, $4)', [id, matchId, fromUserId, text]);
  return getMessageById(id);
}

async function getMessageById(id) {
  const r = await pool.query('SELECT m.*, u.name as from_name FROM messages m JOIN users u ON m.from_user_id = u.id WHERE m.id = $1', [id]);
  return r.rows[0];
}

async function markMessagesRead(matchId, userId) {
  await pool.query('UPDATE messages SET read_at = now() WHERE match_id = $1 AND from_user_id != $2 AND read_at IS NULL', [matchId, userId]);
}

async function getConversations(userId) {
  const r = await pool.query(`
    SELECT 
      mat.id as match_id,
      mat.a as profile_a,
      mat.b as profile_b,
      mat.created_at as match_created_at,
      ua.name as name_a,
      ub.name as name_b,
      ua.id as user_id_a,
      ub.id as user_id_b,
      (
        SELECT msg.created_at FROM messages msg 
        WHERE msg.match_id = mat.id 
        ORDER BY msg.created_at DESC LIMIT 1
      ) as last_message_at,
      (
        SELECT msg.text FROM messages msg 
        WHERE msg.match_id = mat.id 
        ORDER BY msg.created_at DESC LIMIT 1
      ) as last_message_text,
      (
        SELECT u2.name FROM messages msg 
        JOIN users u2 ON msg.from_user_id = u2.id
        WHERE msg.match_id = mat.id 
        ORDER BY msg.created_at DESC LIMIT 1
      ) as last_message_from,
      (
        SELECT COUNT(*)::int FROM messages msg 
        WHERE msg.match_id = mat.id 
        AND msg.from_user_id != $1 
        AND msg.read_at IS NULL
      ) as unread_count
    FROM matches mat
    JOIN profiles pa ON mat.a = pa.id
    JOIN profiles pb ON mat.b = pb.id
    JOIN users ua ON pa.user_id = ua.id
    JOIN users ub ON pb.user_id = ub.id
    WHERE pa.user_id = $1 OR pb.user_id = $1
    ORDER BY 
      COALESCE(
        (SELECT msg.created_at FROM messages msg WHERE msg.match_id = mat.id ORDER BY msg.created_at DESC LIMIT 1),
        mat.created_at
      ) DESC
  `, [userId]);
  return r.rows;
}

async function getConversations_with_ratings(userId) {
  const r = await pool.query(`
    SELECT 
      mat.id as match_id,
      mat.a as profile_a,
      mat.b as profile_b,
      mat.created_at as match_created_at,
      ua.name as name_a,
      ub.name as name_b,
      ua.id as user_id_a,
      ub.id as user_id_b,
      pa.avg_rating as avg_rating_a,
      pa.review_count as review_count_a,
      pb.avg_rating as avg_rating_b,
      pb.review_count as review_count_b,
      (
        SELECT msg.created_at FROM messages msg 
        WHERE msg.match_id = mat.id 
        ORDER BY msg.created_at DESC LIMIT 1
      ) as last_message_at,
      (
        SELECT msg.text FROM messages msg 
        WHERE msg.match_id = mat.id 
        ORDER BY msg.created_at DESC LIMIT 1
      ) as last_message_text,
      (
        SELECT u2.name FROM messages msg 
        JOIN users u2 ON msg.from_user_id = u2.id
        WHERE msg.match_id = mat.id 
        ORDER BY msg.created_at DESC LIMIT 1
      ) as last_message_from,
      (
        SELECT COUNT(*)::int FROM messages msg 
        WHERE msg.match_id = mat.id 
        AND msg.from_user_id != $1 
        AND msg.read_at IS NULL
      ) as unread_count
    FROM matches mat
    JOIN profiles pa ON mat.a = pa.id
    JOIN profiles pb ON mat.b = pb.id
    JOIN users ua ON pa.user_id = ua.id
    JOIN users ub ON pb.user_id = ub.id
    WHERE pa.user_id = $1 OR pb.user_id = $1
    ORDER BY 
      COALESCE(
        (SELECT msg.created_at FROM messages msg WHERE msg.match_id = mat.id ORDER BY msg.created_at DESC LIMIT 1),
        mat.created_at
      ) DESC
  `, [userId]);
  return r.rows;
}

async function getUnreadCount(userId) {
  const r = await pool.query(`
    SELECT COUNT(*)::int as count
    FROM messages msg
    JOIN matches mat ON msg.match_id = mat.id
    JOIN profiles pa ON mat.a = pa.id
    JOIN profiles pb ON mat.b = pb.id
    WHERE (pa.user_id = $1 OR pb.user_id = $1)
      AND msg.from_user_id != $1
      AND msg.read_at IS NULL
  `, [userId]);
  return r.rows[0]?.count || 0;
}

// ─── Reviews ──────────────────────────────────────────────────
async function createReview(id, fromUserId, toProfileId, matchId, rating, text) {
  await pool.query(
    `INSERT INTO reviews (id, from_user_id, to_profile_id, match_id, rating, text) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, fromUserId, toProfileId, matchId, rating, text]
  );
  // update profile avg
  await pool.query(`
    UPDATE profiles SET
      avg_rating = (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE to_profile_id = $1),
      review_count = (SELECT COUNT(*) FROM reviews WHERE to_profile_id = $1)
    WHERE id = $1
  `, [toProfileId]);
  const r = await pool.query('SELECT * FROM reviews WHERE id = $1', [id]);
  return r.rows[0];
}

async function getReviewsForProfile(profileId) {
  const r = await pool.query(
    `SELECT r.*, u.name as from_name FROM reviews r JOIN users u ON r.from_user_id = u.id WHERE r.to_profile_id = $1 ORDER BY r.created_at DESC`,
    [profileId]
  );
  return r.rows;
}

async function getReviewForMatch(userId, matchId) {
  const r = await pool.query('SELECT * FROM reviews WHERE from_user_id = $1 AND match_id = $2', [userId, matchId]);
  return r.rows[0];
}

// ─── Reports ──────────────────────────────────────────────────
async function createReport(id, reporterUserId, reportedUserId, reason, details) {
  await pool.query(
    `INSERT INTO reports (id, reporter_user_id, reported_user_id, reason, details) VALUES ($1,$2,$3,$4,$5)`,
    [id, reporterUserId, reportedUserId, reason, details]
  );
  const r = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
  return r.rows[0];
}

async function getReports(status) {
  let q = 'SELECT r.*, u1.name as reporter_name, u2.name as reported_name FROM reports r JOIN users u1 ON r.reporter_user_id = u1.id JOIN users u2 ON r.reported_user_id = u2.id';
  const params = [];
  if (status) { q += ' WHERE r.status = $1'; params.push(status); }
  q += ' ORDER BY r.created_at DESC';
  const res = await pool.query(q, params);
  return res.rows;
}

async function resolveReport(reportId, adminNotes, newStatus) {
  await pool.query(
    `UPDATE reports SET status = $1, admin_notes = $2, resolved_at = now() WHERE id = $3`,
    [newStatus || 'resolved', adminNotes, reportId]
  );
  const r = await pool.query('SELECT * FROM reports WHERE id = $1', [reportId]);
  return r.rows[0];
}

// ─── Referrals ────────────────────────────────────────────────
async function createReferral(id, referrerUserId, referredEmail, code) {
  await pool.query(
    `INSERT INTO referrals (id, referrer_user_id, referred_email, code) VALUES ($1,$2,$3,$4)`,
    [id, referrerUserId, referredEmail, code]
  );
  const r = await pool.query('SELECT * FROM referrals WHERE id = $1', [id]);
  return r.rows[0];
}

async function redeemReferral(code, referredUserId) {
  const ref = await pool.query('SELECT * FROM referrals WHERE code = $1 AND status = $2', [code, 'pending']);
  if (!ref.rows[0]) return null;
  await pool.query(
    `UPDATE referrals SET referred_user_id = $1, status = 'redeemed' WHERE code = $2`,
    [referredUserId, code]
  );
  return { ...ref.rows[0], referred_user_id: referredUserId, status: 'redeemed' };
}

async function getReferralsByUser(userId) {
  const r = await pool.query(
    `SELECT r.*, u.name as referred_name FROM referrals r LEFT JOIN users u ON r.referred_user_id = u.id WHERE r.referrer_user_id = $1 ORDER BY r.created_at DESC`,
    [userId]
  );
  return r.rows;
}

// ─── Notifications ────────────────────────────────────────────
async function createNotification(id, userId, type, title, body, link) {
  await pool.query(
    `INSERT INTO notifications (id, user_id, type, title, body, link) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, userId, type, title, body, link]
  );
}

async function getNotifications(userId, unreadOnly) {
  let q = 'SELECT * FROM notifications WHERE user_id = $1';
  if (unreadOnly) q += ' AND read = false';
  q += ' ORDER BY created_at DESC LIMIT 50';
  const r = await pool.query(q, [userId]);
  return r.rows;
}

async function markNotificationRead(notifId) {
  await pool.query('UPDATE notifications SET read = true WHERE id = $1', [notifId]);
}

async function markAllNotificationsRead(userId) {
  await pool.query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [userId]);
}

async function getUnreadNotificationCount(userId) {
  const r = await pool.query('SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read = false', [userId]);
  return r.rows[0]?.count || 0;
}

// ─── Boosts ───────────────────────────────────────────────────
async function createBoost(id, profileId, durationHours) {
  const expiresAt = new Date(Date.now() + (durationHours || 24) * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO boosts (id, profile_id, expires_at) VALUES ($1,$2,$3)`,
    [id, profileId, expiresAt]
  );
  const r = await pool.query('SELECT * FROM boosts WHERE id = $1', [id]);
  return r.rows[0];
}

async function getActiveBoost(profileId) {
  const r = await pool.query(
    'SELECT * FROM boosts WHERE profile_id = $1 AND expires_at > now() ORDER BY expires_at DESC LIMIT 1',
    [profileId]
  );
  return r.rows[0] || null;
}

// ─── Saved Searches ──────────────────────────────────────────
async function createSavedSearch(id, userId, query, filters) {
  await pool.query(
    `INSERT INTO saved_searches (id, user_id, query, filters) VALUES ($1,$2,$3,$4)`,
    [id, userId, query, JSON.stringify(filters || {})]
  );
  const r = await pool.query('SELECT * FROM saved_searches WHERE id = $1', [id]);
  return r.rows[0];
}

async function getSavedSearches(userId) {
  const r = await pool.query('SELECT * FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return r.rows;
}

async function deleteSavedSearch(id) {
  await pool.query('DELETE FROM saved_searches WHERE id = $1', [id]);
}

// ─── Pagination-aware profiles ──────────────────────────────
async function getProfilesPaginated({ q, excludeForProfileId, limit, offset, skills, minPrice, maxPrice, minRating, availability, sort }) {
  let where = [];
  let params = [];
  let idx = 1;

  if (q) {
    where.push(`(u.name ILIKE $${idx} OR p.about ILIKE $${idx} OR p.skills::text ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }

  if (excludeForProfileId) {
    // exclude own profile
    where.push(`p.id != $${idx}`);
    params.push(excludeForProfileId);
    idx++;
    // exclude matched profiles
    where.push(`p.id NOT IN (SELECT b FROM matches WHERE a = $${idx - 1} UNION SELECT a FROM matches WHERE b = $${idx - 1})`);
    // exclude liked profiles
    where.push(`p.id NOT IN (SELECT to_profile FROM likes WHERE from_profile = $${idx - 1})`);
  }

  if (skills) {
    const skillList = skills.split(',').map(s => s.trim()).filter(Boolean);
    for (const s of skillList) {
      where.push(`p.skills::text ILIKE $${idx}`);
      params.push(`%${s}%`);
      idx++;
    }
  }

  if (minPrice !== undefined && minPrice !== null) {
    where.push(`CAST(p.price AS NUMERIC) >= $${idx}`);
    params.push(minPrice);
    idx++;
  }

  if (maxPrice !== undefined && maxPrice !== null) {
    where.push(`CAST(p.price AS NUMERIC) <= $${idx}`);
    params.push(maxPrice);
    idx++;
  }

  if (minRating !== undefined && minRating !== null) {
    where.push(`COALESCE(p.avg_rating, 0) >= $${idx}`);
    params.push(minRating);
    idx++;
  }

  if (availability) {
    where.push(`p.availability ILIKE $${idx}`);
    params.push(`%${availability}%`);
    idx++;
  }

  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  let orderBy = 'ORDER BY p.created_at DESC';
  if (sort === 'rating') orderBy = 'ORDER BY COALESCE(p.avg_rating, 0) DESC';
  else if (sort === 'price_low') orderBy = 'ORDER BY CAST(COALESCE(NULLIF(p.price, \'\'), \'0\') AS NUMERIC) ASC';
  else if (sort === 'price_high') orderBy = 'ORDER BY CAST(COALESCE(NULLIF(p.price, \'\'), \'0\') AS NUMERIC) DESC';
  else if (sort === 'boosted') orderBy = 'ORDER BY (SELECT COUNT(*) FROM boosts b WHERE b.profile_id = p.id AND b.expires_at > now()) DESC, p.created_at DESC';

  const lim = limit || 20;
  const off = offset || 0;

  const countQ = `SELECT COUNT(*)::int as total FROM profiles p JOIN users u ON p.user_id = u.id ${whereClause}`;
  const dataQ = `SELECT p.*, u.name, u.email as user_email FROM profiles p JOIN users u ON p.user_id = u.id ${whereClause} ${orderBy} LIMIT ${lim} OFFSET ${off}`;

  const [countRes, dataRes] = await Promise.all([
    pool.query(countQ, params),
    pool.query(dataQ, params)
  ]);

  return { profiles: dataRes.rows, total: countRes.rows[0].total, limit: lim, offset: off };
}

// ─── Enhanced admin summary ──────────────────────────────────
async function getAdminDashboard() {
  const [users, profiles, matches, contracts, disputes, reports, reviews, referrals, messages, boosts] = await Promise.all([
    pool.query('SELECT COUNT(*)::int as count FROM users'),
    pool.query('SELECT COUNT(*)::int as count FROM profiles'),
    pool.query('SELECT COUNT(*)::int as count FROM matches'),
    pool.query('SELECT COUNT(*)::int as count FROM contracts'),
    pool.query('SELECT COUNT(*)::int as count FROM disputes'),
    pool.query('SELECT COUNT(*)::int as count FROM reports WHERE status = $1', ['open']),
    pool.query('SELECT COUNT(*)::int as count FROM reviews'),
    pool.query('SELECT COUNT(*)::int as count FROM referrals WHERE status = $1', ['redeemed']),
    pool.query('SELECT COUNT(*)::int as count FROM messages'),
    pool.query('SELECT COUNT(*)::int as count FROM boosts WHERE expires_at > now()'),
  ]);

  // Recent signups (last 7 days)
  const recentUsers = await pool.query(`SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 10`);

  // Recent reports
  const recentReports = await pool.query(`SELECT r.*, u1.name as reporter_name, u2.name as reported_name FROM reports r JOIN users u1 ON r.reporter_user_id = u1.id JOIN users u2 ON r.reported_user_id = u2.id ORDER BY r.created_at DESC LIMIT 10`);

  // Recent audit logs
  const recentAudit = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20');

  return {
    counts: {
      users: users.rows[0].count,
      profiles: profiles.rows[0].count,
      matches: matches.rows[0].count,
      contracts: contracts.rows[0].count,
      disputes: disputes.rows[0].count,
      openReports: reports.rows[0].count,
      reviews: reviews.rows[0].count,
      referralsRedeemed: referrals.rows[0].count,
      messages: messages.rows[0].count,
      activeBoosts: boosts.rows[0].count,
    },
    recentUsers: recentUsers.rows,
    recentReports: recentReports.rows,
    recentAudit: recentAudit.rows,
  };
}

// ─── Search users (admin) ───────────────────────────────────
async function searchUsers(query) {
  const searchTerm = `%${query}%`;
  const r = await pool.query(
    'SELECT id, name, email, suspended, created_at FROM users WHERE LOWER(name) LIKE LOWER($1) OR LOWER(email) LIKE LOWER($1) ORDER BY created_at DESC LIMIT 20',
    [searchTerm]
  );
  return r.rows;
}

// ─── All users (admin) ───────────────────────────────────────
async function getAllUsers(limit, offset) {
  const lim = limit || 50;
  const off = offset || 0;
  const r = await pool.query('SELECT id, name, email, suspended, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2', [lim, off]);
  const count = await pool.query('SELECT COUNT(*)::int as total FROM users');
  return { users: r.rows, total: count.rows[0].total };
}

// ─── Audit logs (admin) ──────────────────────────────────────
async function getAuditLogs(limit, offset) {
  const lim = limit || 50;
  const off = offset || 0;
  const r = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2', [lim, off]);
  return r.rows;
}

// ─── Admin CRUD ──────────────────────────────────────────────
async function updateUser(id, fields) {
  const allowed = ['name', 'email', 'suspended'];
  const sets = [];
  const params = [id];
  let idx = 2;
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${idx}`);
      params.push(fields[key]);
      idx++;
    }
  }
  if (sets.length === 0) return getUserById(id);
  await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, params);
  return getUserById(id);
}

async function deleteUser(id) {
  // cascade: delete profile, messages, likes, matches, reviews, notifications, etc.
  const profile = await getProfileByUserId(id);
  if (profile) {
    await pool.query('DELETE FROM reviews WHERE to_profile_id = $1', [profile.id]);
    await pool.query('DELETE FROM likes WHERE from_profile = $1 OR to_profile = $1', [profile.id]);
    await pool.query('DELETE FROM boosts WHERE profile_id = $1', [profile.id]);
    // delete matches and messages for this profile
    const matches = await pool.query('SELECT id FROM matches WHERE a = $1 OR b = $1', [profile.id]);
    for (const m of matches.rows) {
      await pool.query('DELETE FROM messages WHERE match_id = $1', [m.id]);
      await pool.query('DELETE FROM contracts WHERE match_id = $1', [m.id]);
      await pool.query('DELETE FROM reviews WHERE match_id = $1', [m.id]);
    }
    await pool.query('DELETE FROM matches WHERE a = $1 OR b = $1', [profile.id]);
    await pool.query('DELETE FROM profiles WHERE id = $1', [profile.id]);
  }
  await pool.query('DELETE FROM notifications WHERE user_id = $1', [id]);
  await pool.query('DELETE FROM saved_searches WHERE user_id = $1', [id]);
  await pool.query('DELETE FROM referrals WHERE referrer_user_id = $1', [id]);
  await pool.query('DELETE FROM reports WHERE reporter_user_id = $1 OR reported_user_id = $1', [id]);
  await pool.query('DELETE FROM reviews WHERE from_user_id = $1', [id]);
  await pool.query('DELETE FROM messages WHERE from_user_id = $1', [id]);
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
  return { ok: true };
}

async function updateProfile(id, fields) {
  const allowed = ['skills', 'about', 'price', 'avatar_url'];
  const sets = [];
  const params = [id];
  let idx = 2;
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = $${idx}`);
      params.push(key === 'skills' && typeof fields[key] === 'string' ? fields[key].split(',').map(s => s.trim()) : fields[key]);
      idx++;
    }
  }
  if (sets.length === 0) return getProfileById(id);
  await pool.query(`UPDATE profiles SET ${sets.join(', ')} WHERE id = $1`, params);
  return getProfileById(id);
}

async function deleteProfile(id) {
  await pool.query('DELETE FROM reviews WHERE to_profile_id = $1', [id]);
  await pool.query('DELETE FROM likes WHERE from_profile = $1 OR to_profile = $1', [id]);
  await pool.query('DELETE FROM boosts WHERE profile_id = $1', [id]);
  const matches = await pool.query('SELECT id FROM matches WHERE a = $1 OR b = $1', [id]);
  for (const m of matches.rows) {
    await pool.query('DELETE FROM messages WHERE match_id = $1', [m.id]);
    await pool.query('DELETE FROM contracts WHERE match_id = $1', [m.id]);
    await pool.query('DELETE FROM reviews WHERE match_id = $1', [m.id]);
  }
  await pool.query('DELETE FROM matches WHERE a = $1 OR b = $1', [id]);
  await pool.query('DELETE FROM profiles WHERE id = $1', [id]);
  return { ok: true };
}

async function getAllProfiles(limit, offset) {
  const lim = limit || 50;
  const off = offset || 0;
  const r = await pool.query('SELECT p.*, u.name, u.email FROM profiles p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC LIMIT $1 OFFSET $2', [lim, off]);
  const count = await pool.query('SELECT COUNT(*)::int as total FROM profiles');
  return { profiles: r.rows, total: count.rows[0].total };
}

module.exports = {
  init,
  addUser,
  getUserByEmail,
  getUserById,
  createProfile,
  getProfiles,
  getProfilesPaginated,
  getProfileById,
  getProfileByUserId,
  createMatch,
  findMatchByProfiles,
  getMatchById,
  getMatches,
  deleteMatch,
  getMessages,
  addMessage,
  markMessagesRead,
  getConversations,
  getConversations_with_ratings,
  getUnreadCount,
  getSummary,
  getAdminDashboard,
  getAllUsers,
  searchUsers,
  getAllProfiles,
  getAuditLogs,
  setUserSuspended,
  addAuditLog,
  updateUser,
  deleteUser,
  updateProfile,
  deleteProfile,
  // likes
  createLike,
  findLike,
  deleteLike,
  deleteLikesBetween,
  getLikesTo,
  getLikesFrom,
  // reviews
  createReview,
  getReviewsForProfile,
  getReviewForMatch,
  // reports
  createReport,
  getReports,
  resolveReport,
  // referrals
  createReferral,
  redeemReferral,
  getReferralsByUser,
  // notifications
  createNotification,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  // boosts
  createBoost,
  getActiveBoost,
  // saved searches
  createSavedSearch,
  getSavedSearches,
  deleteSavedSearch,
};
