-- Idempotent inserts for demo users and profiles (no truncation)
-- Run this in your Postgres (psql) or Supabase SQL editor.

INSERT INTO users (id, email, name, created_at)
VALUES
  ('demo_user_samantha','samantha@example.com','Samantha Ortiz', now()),
  ('demo_user_michael','michael@example.com','Michael Brown', now()),
  ('demo_user_priya','priya@example.com','Priya Singh', now()),
  ('demo_user_liuwei','liuwei@example.com','Liu Wei', now()),
  ('demo_user_carlos','carlos@example.com','Carlos Mendes', now()),
  ('demo_user_amelia','amelia@example.com','Amelia Johnson', now()),
  ('demo_user_noah','noah@example.com','Noah Kim', now()),
  ('demo_user_fatima','fatima@example.com','Fatima Zahra', now())
ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, user_id, skills, about, price, created_at)
VALUES
  ('demo_prof_samantha','demo_user_samantha', ARRAY['design','ux'],'Product designer who loves AI agents.', 50, now()),
  ('demo_prof_michael','demo_user_michael', ARRAY['javascript','node'],'Full-stack dev and coffee enthusiast.', 80, now()),
  ('demo_prof_priya','demo_user_priya', ARRAY['data','ml'],'ML engineer focusing on NLP.', 120, now()),
  ('demo_prof_liuwei','demo_user_liuwei', ARRAY['go','systems'],'Systems engineer and distributed systems fan.', 90, now()),
  ('demo_prof_carlos','demo_user_carlos', ARRAY['marketing','growth'],'Growth marketer with startup experience.', 60, now()),
  ('demo_prof_amelia','demo_user_amelia', ARRAY['product','strategy'],'Product manager with design sensibility.', 100, now()),
  ('demo_prof_noah','demo_user_noah', ARRAY['react','frontend'],'Frontend engineer and accessibility advocate.', 70, now()),
  ('demo_prof_fatima','demo_user_fatima', ARRAY['qa','testing'],'QA engineer who loves robust systems.', 55, now())
ON CONFLICT (id) DO NOTHING;

-- You may want to verify the rows:
-- SELECT u.id, u.email, u.name, p.id AS profile_id, p.skills FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.email LIKE '%@example.com';
