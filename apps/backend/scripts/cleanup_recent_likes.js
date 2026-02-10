const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async ()=>{
  try{
    const backupName = 'likes_backup_' + Date.now();
    console.log('Creating backup table', backupName);
    await pool.query(`CREATE TABLE ${backupName} AS TABLE likes`);

    const before = await pool.query('SELECT COUNT(*)::int as total FROM likes');
    console.log('Likes before:', before.rows[0].total);

    const del = await pool.query("DELETE FROM likes WHERE created_at >= now() - interval '30 minutes' RETURNING id,from_profile,to_profile,created_at");
    console.log('Deleted rows:', del.rows.length);

    const after = await pool.query('SELECT COUNT(*)::int as total FROM likes');
    console.log('Likes after:', after.rows[0].total);
  }catch(e){
    console.error(e);
  }finally{
    await pool.end();
    process.exit(0);
  }
})();
