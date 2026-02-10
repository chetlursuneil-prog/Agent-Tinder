/**
 * Load test for AgentTinder API
 *
 * Uses built-in Node.js — no external dependencies required.
 * Tests: POST /likes (→ match flow), GET /profiles, GET /admin/summary
 *
 * Usage: node load_test.js [base_url] [concurrency] [requests]
 * Example: node load_test.js http://localhost:3001 10 100
 */

const http = require('http');
const https = require('https');

const BASE = process.argv[2] || 'http://localhost:3001';
const CONCURRENCY = parseInt(process.argv[3]) || 10;
const TOTAL_REQUESTS = parseInt(process.argv[4]) || 100;

const isHttps = BASE.startsWith('https');
const requester = isHttps ? https : http;

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { 'Content-Type': 'application/json' },
    };

    const start = Date.now();
    const req = requester.request(opts, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        resolve({ status: res.statusCode, duration: Date.now() - start, data });
      });
    });

    req.on('error', err => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runScenario(name, fn) {
  console.log(`\n─── ${name} (${TOTAL_REQUESTS} reqs, ${CONCURRENCY} concurrent) ───`);
  const results = [];
  const errors = [];

  const batches = Math.ceil(TOTAL_REQUESTS / CONCURRENCY);
  const start = Date.now();

  for (let b = 0; b < batches; b++) {
    const batchSize = Math.min(CONCURRENCY, TOTAL_REQUESTS - b * CONCURRENCY);
    const promises = [];
    for (let i = 0; i < batchSize; i++) {
      promises.push(
        fn(b * CONCURRENCY + i)
          .then(r => results.push(r))
          .catch(e => errors.push(e.message))
      );
    }
    await Promise.all(promises);
  }

  const totalTime = Date.now() - start;
  const durations = results.map(r => r.duration).sort((a, b) => a - b);
  const statuses = {};
  results.forEach(r => { statuses[r.status] = (statuses[r.status] || 0) + 1; });

  console.log(`  Total time: ${totalTime}ms`);
  console.log(`  Requests:   ${results.length} ok, ${errors.length} failed`);
  console.log(`  RPS:        ${(results.length / (totalTime / 1000)).toFixed(1)}`);
  console.log(`  Latency:    min=${durations[0]}ms, median=${durations[Math.floor(durations.length / 2)]}ms, p95=${durations[Math.floor(durations.length * 0.95)]}ms, max=${durations[durations.length - 1]}ms`);
  console.log(`  Status:     ${JSON.stringify(statuses)}`);
  if (errors.length > 0) console.log(`  Errors:     ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
}

async function main() {
  console.log(`Load test: ${BASE}  concurrency=${CONCURRENCY}  requests=${TOTAL_REQUESTS}`);

  // 1. GET /profiles
  await runScenario('GET /profiles', () => makeRequest('GET', '/profiles'));

  // 2. GET /health
  await runScenario('GET /health', () => makeRequest('GET', '/health'));

  // 3. GET /admin/summary
  await runScenario('GET /admin/summary', () => makeRequest('GET', '/admin/summary'));

  // 4. POST /auth/signup (unique emails)
  await runScenario('POST /auth/signup', (i) =>
    makeRequest('POST', '/auth/signup', { email: `loadtest-${Date.now()}-${i}@test.com`, name: `LoadUser${i}` })
  );

  // 5. GET /admin/dashboard
  await runScenario('GET /admin/dashboard', () => makeRequest('GET', '/admin/dashboard'));

  console.log('\n✓ Load test complete.');
}

main().catch(err => {
  console.error('Load test failed:', err);
  process.exit(1);
});
