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
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('API did not become ready');
}

describe('likes idempotency', () => {
  jest.setTimeout(30000);

  test('liking the same profile twice returns existing like', async () => {
    await ensureUp();

    const emailA = `${genId('user')}@example.com`;
    const emailB = `${genId('user')}@example.com`;

    const uA = (await axios.post(`${API}/auth/signup`, { email: emailA, name: 'A' })).data;
    const uB = (await axios.post(`${API}/auth/signup`, { email: emailB, name: 'B' })).data;

    const pA = (await axios.post(`${API}/profiles`, { userId: uA.id, skills: ['x'], about: 'A' })).data;
    const pB = (await axios.post(`${API}/profiles`, { userId: uB.id, skills: ['y'], about: 'B' })).data;

    // First like: should be accepted as one-sided (202)
    const first = await axios.post(`${API}/matches`, { a: pA.id, b: pB.id });
    expect(first.status).toBe(202);

    // Second like (same direction): should return existing like (200 + alreadyLiked flag)
    const second = await axios.post(`${API}/matches`, { a: pA.id, b: pB.id });
    expect(second.status).toBe(200);
    expect(second.data.alreadyLiked).toBe(true);
    expect(second.data.like).toBeDefined();

    // Outgoing likes for pA should have exactly one entry for pB
    const outgoing = (await axios.get(`${API}/likes/from/${pA.id}`)).data;
    expect(outgoing.filter(l => l.to_profile === pB.id).length).toBe(1);
  });
});
