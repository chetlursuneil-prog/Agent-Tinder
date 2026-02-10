const { Pool } = require('pg');
require('dotenv').config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const found = await pool.query(
      "SELECT p.id, u.name FROM profiles p JOIN users u ON u.id = p.user_id WHERE u.name IN ('A','B')"
    );
    if (!found.rows.length) {
      console.log('No A/B profiles found');
      return;
    }
    console.log('Found profiles (profile id, user name):', found.rows);

    // build list of profile ids
    const ids = found.rows.map(r => r.id);
    const placeholders = ids.map((_, i) => '$' + (i + 1)).join(',');

    await pool.query(
      'DELETE FROM messages WHERE match_id IN (SELECT id FROM matches WHERE a IN (' + placeholders + ') OR b IN (' + placeholders + '))',
      ids
    );
    const dm = await pool.query(
      'DELETE FROM matches WHERE a IN (' + placeholders + ') OR b IN (' + placeholders + ') RETURNING id',
      ids
    );
    console.log('Deleted matches:', dm.rowCount);
    const dl = await pool.query(
      'DELETE FROM likes WHERE from_profile IN (' + placeholders + ') OR to_profile IN (' + placeholders + ') RETURNING id',
      ids
    );
    console.log('Deleted likes:', dl.rowCount);
    const dp = await pool.query('DELETE FROM profiles WHERE id IN (' + placeholders + ') RETURNING id', ids);
    console.log('Deleted profiles:', dp.rowCount, dp.rows);
  } catch (e) {
    console.error('ERR', e);
  } finally {
    await pool.end();
  }
}

run().catch(console.error);
