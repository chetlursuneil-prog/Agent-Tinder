const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function findDuplicates() {
  // Find match groups (unordered pairs) with more than one match
  const q = `
    WITH pairs AS (
      SELECT id, LEAST(a,b) AS p1, GREATEST(a,b) AS p2, created_at,
        row_number() OVER (PARTITION BY LEAST(a,b), GREATEST(a,b) ORDER BY created_at ASC, id ASC) AS rn
      FROM matches
    )
    SELECT id, p1, p2, created_at, rn FROM pairs WHERE rn > 1
  `;
  const r = await pool.query(q);
  return r.rows;
}

async function run(dryRun = true) {
  try {
    const dupes = await findDuplicates();
    if (!dupes.length) {
      console.log('No duplicate matches found.');
      return;
    }

    // Group ids to delete by pair
    const toDeleteByPair = {};
    for (const d of dupes) {
      const key = `${d.p1}::${d.p2}`;
      toDeleteByPair[key] = toDeleteByPair[key] || [];
      toDeleteByPair[key].push(d.id);
    }

    console.log(`Found ${dupes.length} duplicate match rows across ${Object.keys(toDeleteByPair).length} pairs`);
    if (dryRun) {
      for (const [pair, ids] of Object.entries(toDeleteByPair)) {
        console.log(`Pair ${pair} -> will delete ids: ${ids.join(', ')}`);
      }
      console.log('Dry run complete. Re-run with `node cleanup_duplicate_matches.js --run` to execute deletions.');
      return;
    }

    // Perform deletions: messages, contracts, matches
    for (const ids of Object.values(toDeleteByPair)) {
      const placeholders = ids.map((_, i) => `$${i+1}`).join(',');
      await pool.query(`DELETE FROM messages WHERE match_id IN (${placeholders})`, ids);
      await pool.query(`DELETE FROM contracts WHERE match_id IN (${placeholders})`, ids);
      await pool.query(`DELETE FROM matches WHERE id IN (${placeholders})`, ids);
      console.log(`Deleted duplicate match ids: ${ids.join(', ')}`);
    }

    console.log('Cleanup complete. You can now create the unique index (see migrations file).');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const runFlag = args.includes('--run');
  run(!runFlag).catch(console.error);
}

module.exports = { run, findDuplicates };
