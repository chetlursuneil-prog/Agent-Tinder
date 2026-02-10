const axios = require('axios');
require('dotenv').config();

const API = process.env.API_BASE || 'http://localhost:3001';

async function createMatch(a, b) {
  try {
    const r = await axios.post(`${API}/matches`, { a, b }, { timeout: 5000 });
    return { status: r.status, data: r.data };
  } catch (err) {
    if (err.response) return { status: err.response.status, data: err.response.data };
    return { error: err.message };
  }
}

async function run() {
  const a = process.argv[2] || 'profile_test_a';
  const b = process.argv[3] || 'profile_test_b';
  const concurrent = parseInt(process.argv[4] || '10', 10);

  console.log(`Running concurrency test: ${concurrent} concurrent POST /matches for pair (${a}, ${b}) against ${API}`);

  const promises = [];
  for (let i = 0; i < concurrent; i++) {
    promises.push(createMatch(a, b).then((res) => ({ idx: i, res })));
  }

  const results = await Promise.all(promises);
  const summary = {};
  for (const r of results) {
    const key = r.res && r.res.status ? `status_${r.res.status}` : `err_${r.res && r.res.error ? 'node_err' : 'unknown'}`;
    summary[key] = (summary[key] || 0) + 1;
  }

  console.log('Results summary:', summary);
  for (const r of results) {
    console.log(`[#${r.idx}]`, r.res && r.res.status, (r.res && r.res.data && r.res.data.id) ? r.res.data.id : JSON.stringify(r.res && r.res.data || r.res));
  }
}

if (require.main === module) run().catch(console.error);
