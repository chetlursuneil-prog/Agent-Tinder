-- Migration: create unique index on canonical pair (a,b)
-- IMPORTANT: Ensure duplicates are removed before running this (use scripts/cleanup_duplicate_matches.js)

-- Use CONCURRENTLY in production to avoid locking.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_matches_pair ON matches (a, b);
