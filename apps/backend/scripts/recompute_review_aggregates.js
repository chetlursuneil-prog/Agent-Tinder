const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function recompute() {
  console.log('Recomputing review aggregates for profiles...');
  const profiles = (await pool.query('SELECT id FROM profiles')).rows;
  let updated = 0;
  for (const p of profiles) {
    const r = await pool.query('SELECT COALESCE(AVG(rating),0) AS avg_rating, COUNT(*)::int AS review_count FROM reviews WHERE to_profile_id = $1', [p.id]);
    const avg = r.rows[0].avg_rating || 0;
    const cnt = r.rows[0].review_count || 0;
    await pool.query('UPDATE profiles SET avg_rating = $1, review_count = $2 WHERE id = $3', [avg, cnt, p.id]);
    updated++;
  }
  console.log('Updated profiles:', updated);
  process.exit(0);
}

recompute().catch(err => { console.error(err); process.exit(1); });
