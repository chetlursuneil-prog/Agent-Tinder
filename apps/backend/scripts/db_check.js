const { Pool } = require('pg');
require('dotenv').config();

(async function(){
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const tables = ['users','profiles','matches','likes','messages','contracts'];
    for(const t of tables){
      const r = await pool.query('SELECT count(*) AS c FROM ' + t);
      console.log(t + ':', r.rows[0].c);
    }
    const res = await pool.query('SELECT id, created_at FROM matches ORDER BY created_at DESC LIMIT 5');
    console.log('recent matches:', res.rows);
    const res2 = await pool.query('SELECT id, created_at, text FROM messages ORDER BY created_at DESC LIMIT 5');
    console.log('recent messages:', res2.rows);
  } catch(e) {
    console.error('DB ERROR', e);
  } finally {
    await pool.end();
  }
})();
