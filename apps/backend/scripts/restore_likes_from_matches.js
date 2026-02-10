const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function restore() {
  console.log('Restoring likes from matches...');
  const matches = (await pool.query('SELECT id,a,b FROM matches')).rows;
  let inserted = 0;
  for (const m of matches) {
    const a = m.a;
    const b = m.b;
    // ensure like a -> b exists
    const r1 = await pool.query('SELECT id FROM likes WHERE from_profile = $1 AND to_profile = $2 LIMIT 1', [a,b]);
    if (r1.rows.length === 0) {
      const id = 'like_' + Date.now() + '_' + Math.floor(Math.random()*1000);
      await pool.query('INSERT INTO likes (id, from_profile, to_profile) VALUES ($1,$2,$3)', [id,a,b]).catch(e=>{});
      inserted++;
    }
    // ensure like b -> a exists
    const r2 = await pool.query('SELECT id FROM likes WHERE from_profile = $1 AND to_profile = $2 LIMIT 1', [b,a]);
    if (r2.rows.length === 0) {
      const id = 'like_' + (Date.now()+1) + '_' + Math.floor(Math.random()*1000);
      await pool.query('INSERT INTO likes (id, from_profile, to_profile) VALUES ($1,$2,$3)', [id,b,a]).catch(e=>{});
      inserted++;
    }
  }
  console.log('Inserted likes:', inserted);
  process.exit(0);
}

restore().catch(err => { console.error(err); process.exit(1); });
