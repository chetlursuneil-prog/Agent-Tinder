const db = require('../src/db');

function rndId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random()*100000)}`;
}

async function run() {
  const pool = await db.init();

  const demos = [
    { email: 'samantha@example.com', name: 'Samantha Ortiz', skills: ['design','ux'], about: 'Product designer who loves AI agents.', price: 50 },
    { email: 'michael@example.com', name: 'Michael Brown', skills: ['javascript','node'], about: 'Full-stack dev and coffee enthusiast.', price: 80 },
    { email: 'priya@example.com', name: 'Priya Singh', skills: ['data','ml'], about: 'ML engineer focusing on NLP.', price: 120 },
    { email: 'liuwei@example.com', name: 'Liu Wei', skills: ['go','systems'], about: 'Systems engineer and distributed systems fan.', price: 90 },
    { email: 'carlos@example.com', name: 'Carlos Mendes', skills: ['marketing','growth'], about: 'Growth marketer with startup experience.', price: 60 },
    { email: 'amelia@example.com', name: 'Amelia Johnson', skills: ['product','strategy'], about: 'Product manager with design sensibility.', price: 100 },
    { email: 'noah@example.com', name: 'Noah Kim', skills: ['react','frontend'], about: 'Frontend engineer and accessibility advocate.', price: 70 },
    { email: 'fatima@example.com', name: 'Fatima Zahra', skills: ['qa','testing'], about: 'QA engineer who loves robust systems.', price: 55 }
  ];

  for (const d of demos) {
    try {
      const existing = await db.getUserByEmail(d.email);
      if (existing) {
        console.log('Skipping existing user:', d.email);
        continue;
      }

      const userId = rndId('user');
      const profileId = rndId('prof');
      await db.addUser(userId, d.email, d.name);
      await db.createProfile(profileId, userId, d.skills, d.about, d.price);
      console.log('Inserted', d.name, d.email);
    } catch (err) {
      console.error('Error inserting', d.email, err.message);
    }
  }

  console.log('Done');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
