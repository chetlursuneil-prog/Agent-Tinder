#!/usr/bin/env node
/**
 * Backup script — exports all important tables from PostgreSQL
 * Usage: node backup.js [output_dir]
 *
 * Saves JSON dumps of each table to timestamped files.
 * For production, use pg_dump instead. This is a lightweight alternative.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
});

const TABLES = [
  'users',
  'profiles',
  'matches',
  'likes',
  'messages',
  'reviews',
  'reports',
  'referrals',
  'notifications',
  'boosts',
  'saved_searches',
  'contracts',
  'disputes',
  'audit_logs',
];

async function main() {
  const outDir = process.argv[2] || path.join(__dirname, '..', 'backups');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(outDir, `backup-${timestamp}`);

  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`Backing up to ${backupDir}`);

  const summary = {};

  for (const table of TABLES) {
    try {
      const r = await pool.query(`SELECT * FROM ${table}`);
      const filePath = path.join(backupDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(r.rows, null, 2));
      summary[table] = r.rows.length;
      console.log(`  ✓ ${table}: ${r.rows.length} rows`);
    } catch (err) {
      summary[table] = `ERROR: ${err.message}`;
      console.log(`  ✗ ${table}: ${err.message}`);
    }
  }

  // Save summary
  fs.writeFileSync(path.join(backupDir, '_summary.json'), JSON.stringify(summary, null, 2));
  console.log(`\nBackup complete: ${backupDir}`);

  await pool.end();
}

main().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
