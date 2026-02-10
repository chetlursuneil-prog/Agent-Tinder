-- 002_feature_expansion.sql
-- New tables for: reviews, reports/moderation, referrals, notifications, boosts, saved searches

-- Reviews / Ratings
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  from_user_id TEXT REFERENCES users(id),
  to_profile_id TEXT REFERENCES profiles(id),
  match_id TEXT REFERENCES matches(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_review_per_match ON reviews (from_user_id, match_id);

-- Reports / Moderation
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT REFERENCES users(id),
  reported_user_id TEXT REFERENCES users(id),
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'open',  -- open, reviewed, dismissed, actioned
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_user_id TEXT REFERENCES users(id),
  referred_email TEXT NOT NULL,
  referred_user_id TEXT REFERENCES users(id),
  code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending, signed_up, rewarded
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  type TEXT NOT NULL, -- match, message, like, review, system
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Profile boosts
CREATE TABLE IF NOT EXISTS boosts (
  id TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES profiles(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Saved searches
CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  query TEXT,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add avatar_url to profiles if not present
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add rating cache to profiles (avg_rating, review_count) for quick display
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avg_rating NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Add referral_code to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
