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

describe('profiles integration', () => {
  jest.setTimeout(30000);

  test('excludeForProfileId hides self, matches, and outgoing likes', async () => {
    await ensureUp();

    // create two users and profiles
    const emailA = `${genId('user')}@example.com`;
    const emailB = `${genId('user')}@example.com`;

    const uA = (await axios.post(`${API}/auth/signup`, { email: emailA, name: 'A' })).data;
    const uB = (await axios.post(`${API}/auth/signup`, { email: emailB, name: 'B' })).data;
    const pA = (await axios.post(`${API}/profiles`, { userId: uA.id, skills: ['x'], about: 'A' })).data;
    const pB = (await axios.post(`${API}/profiles`, { userId: uB.id, skills: ['y'], about: 'B' })).data;

    // A likes B (one-sided)
    await axios.post(`${API}/matches`, { a: pA.id, b: pB.id });

    // Now request profiles excluding A
    const res = (await axios.get(`${API}/profiles`, { params: { excludeForProfileId: pA.id } })).data;
    // Should not include A
    expect(res.find(p => p.id === pA.id)).toBeUndefined();
    // Should not include B because A liked B
    expect(res.find(p => p.id === pB.id)).toBeUndefined();

    // Also test that without exclude param both profiles are present
    const all = (await axios.get(`${API}/profiles`)).data;
    expect(all.find(p => p.id === pA.id)).toBeDefined();
    expect(all.find(p => p.id === pB.id)).toBeDefined();
  });
});
