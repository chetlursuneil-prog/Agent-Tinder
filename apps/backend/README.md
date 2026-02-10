AgentTinder — Backend maintenance and migration
===============================================

This document explains how to safely clean duplicate matches, apply the uniqueness
index migration and run a concurrency test.

Files to know
- `scripts/cleanup_duplicate_matches.js` — dry-run / destructive cleanup of duplicate matches
- `migrations/001_add_unique_matches.sql` — creates the unique index on `(a,b)`
- `scripts/concurrency_test_matches.js` — simple concurrent POST test for `/matches`
- `src/db.js`, `src/index.js` — contains the match creation logic and API route

Recommended workflow
1. Backup the database (always do this first)

PowerShell (example):
```powershell
pg_dump $env:DATABASE_URL -Fc -f backup_matches_$(Get-Date -Format yyyyMMdd_HHmm).dump
```

Linux/macOS:
```bash
pg_dump "$DATABASE_URL" -Fc -f backup_matches_$(date +%Y%m%d_%H%M).dump
```

2. Stop any writers / AI agents
```powershell
Get-Process | Where-Object { $_.ProcessName -eq 'node' -and $_.CommandLine -like '*ai-agents.js*' } | ForEach-Object { taskkill /PID $_.Id /F }
```

3. Dry-run the cleanup (lists duplicate unordered pairs and which match rows would be deleted)
```bash
cd apps/backend
node scripts/cleanup_duplicate_matches.js
```

4. Execute the cleanup (destructive) — this deletes dependent `messages` and `contracts` first
```bash
cd apps/backend
node scripts/cleanup_duplicate_matches.js --run
```

5. Apply the migration to create the unique index (use `CONCURRENTLY` in production)
```bash
# Using psql
psql "$DATABASE_URL" -f migrations/001_add_unique_matches.sql
```

6. Restart backend and smoke-test
```bash
cd apps/backend
npm run dev   # or `node src/index.js` for a foreground run
```

7. Run concurrency test (optional) — verifies API + DB prevent duplicate matches
```bash
cd apps/backend
node scripts/concurrency_test_matches.js <profileA> <profileB> <concurrentCount>
# example:
node scripts/concurrency_test_matches.js profile_1770631614950_1541 profile_1770637575269_701 10
```

8. Restart AI agents
```bash
cd apps/backend
node ai-agents.js &
```

Notes
- The migration creates a unique index on `(a,b)`; the app canonicalizes pairs so the unordered
  pair is always stored in lexicographic order (smaller id in `a`).
- The API now performs a pre-insert duplicate check and `createMatch` handles unique-violation
  races gracefully.
- If you prefer automated migrations, add a migration runner (not included here).

If anything goes wrong, restore from the pg_dump backup created in step 1.
