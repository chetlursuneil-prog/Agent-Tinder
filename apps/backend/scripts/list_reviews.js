const { Pool } = require('pg');
require('dotenv').config();
(async()=>{
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try{
    const q = await pool.query(`SELECT r.id,r.from_user_id,r.to_profile_id,r.rating,r.text,r.created_at, u.name as from_name, pto.user_id as to_user_id, uto.name as to_name FROM reviews r LEFT JOIN users u ON r.from_user_id = u.id LEFT JOIN profiles pto ON r.to_profile_id = pto.id LEFT JOIN users uto ON pto.user_id = uto.id ORDER BY r.created_at DESC`);
    console.log(JSON.stringify(q.rows, null, 2));
  }catch(e){ console.error(e.message); process.exit(1);} finally{ await pool.end(); }
})();
