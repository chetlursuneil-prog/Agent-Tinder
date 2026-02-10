const { Pool } = require('pg');
require('dotenv').config();
(async()=>{
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try{
    const email = process.argv[2] || 'chetlur.suneil@gmail.com';
    const name = process.argv[3] || 'Suneil Chetlur';
    const q = await pool.query('SELECT id,email,name,created_at FROM users WHERE email = $1 OR name = $2 LIMIT 10', [email, name]);
    console.log(JSON.stringify(q.rows, null, 2));
  }catch(e){ console.error(e.message); process.exit(1);} finally{ await pool.end(); }
})();
