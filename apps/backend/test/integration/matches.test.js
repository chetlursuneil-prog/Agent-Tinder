const axios = require('axios');

const API = process.env.API_BASE || 'http://localhost:3001';

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
}

async function ensureUp() {
  const max = 20;
  for (let i = 0; i < max; i++) {
    try {
      const r = await axios.get(`${API}/health`, { timeout: 2000 });
      if (r.status === 200) return true;
    } catch (e) {
      // ignore
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('API did not become ready');
}

describe('matches integration', () => {
  jest.setTimeout(30000);

  test('concurrent match creation results in a single match', async () => {
    await ensureUp();

    // Create two users + profiles
    const emailA = `${genId('user')}@example.com`;
    const emailB = `${genId('user')}@example.com`;

    const uA = (await axios.post(`${API}/auth/signup`, { email: emailA, name: 'A' })).data;
    const uB = (await axios.post(`${API}/auth/signup`, { email: emailB, name: 'B' })).data;

    const pA = (await axios.post(`${API}/profiles`, { userId: uA.id, skills: ['x'], about: 'A' })).data;
    const pB = (await axios.post(`${API}/profiles`, { userId: uB.id, skills: ['y'], about: 'B' })).data;

    // First, A likes B - should return 202 (one-sided like)
    const likeResp = await axios.post(`${API}/matches`, { a: pA.id, b: pB.id });
    expect(likeResp.status).toBe(202);
    expect(likeResp.data.liked).toBe(true);

    // Verify no match exists yet
    const allBefore = (await axios.get(`${API}/matches`)).data;
    const [x, y] = pA.id < pB.id ? [pA.id, pB.id] : [pB.id, pA.id];
    const beforeFiltered = allBefore.filter(m => m.a === x && m.b === y);
    expect(beforeFiltered.length).toBe(0);

    // Now B likes A back concurrently (multiple times to test race)
    const concurrent = 12;
    const promises = [];
    for (let i = 0; i < concurrent; i++) {
      promises.push(
        axios.post(`${API}/matches`, { a: pB.id, b: pA.id }).then(r => ({ status: r.status, data: r.data })).catch(e => ({ status: e.response?.status || 500, data: e.response?.data || e.message }))
      );
    }

    const results = await Promise.all(promises);

    // At least one should return 201 (match created) or 200 (match already exists)
    const matchCreated = results.filter(r => r.status === 201 || r.status === 200).length;
    expect(matchCreated).toBeGreaterThanOrEqual(1);

    // Verify exactly one match exists
    const all = (await axios.get(`${API}/matches`)).data;
    const filtered = all.filter(m => m.a === x && m.b === y);
    expect(filtered.length).toBe(1);
  });
});
