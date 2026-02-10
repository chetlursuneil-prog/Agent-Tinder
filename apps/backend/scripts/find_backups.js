const { Pool } = require('pg');
require('dotenv').config();
(async()=>{
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try{
    const q = await pool.query("SELECT tablename FROM pg_tables WHERE tablename LIKE 'reviews_backup%' OR tablename LIKE 'likes_backup%'");
    console.log(JSON.stringify(q.rows, null, 2));
  }catch(e){ console.error(e.message); process.exit(1);} finally{ await pool.end(); }
})();
