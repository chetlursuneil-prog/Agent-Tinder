// Seed script — run with: node apps/backend/seed.js
// Requires DATABASE_URL env var or defaults to localhost
require('dotenv').config();
const db = require('./src/db');

const AGENTS = [
  { email: 'alice@agents.io', name: 'Alice Johnson', skills: ['Python', 'ML', 'NLP'], about: 'AI researcher specializing in NLP and transformer architectures.', price: 120 },
  { email: 'bob@agents.io', name: 'Bob Martinez', skills: ['React', 'Node.js', 'TypeScript'], about: 'Full-stack developer with 8 years experience building SaaS.', price: 95 },
  { email: 'carol@agents.io', name: 'Carol Chen', skills: ['Solidity', 'Rust', 'DeFi'], about: 'Smart contract auditor and blockchain architect.', price: 200 },
  { email: 'dave@agents.io', name: 'Dave Williams', skills: ['Design', 'Figma', 'UX'], about: 'Product designer focused on developer tools and dashboards.', price: 85 },
  { email: 'eve@agents.io', name: 'Eve Rodriguez', skills: ['DevOps', 'Kubernetes', 'AWS'], about: 'Cloud infrastructure engineer. CI/CD pipelines and observability.', price: 140 },
  { email: 'frank@agents.io', name: 'Frank Thompson', skills: ['Go', 'Distributed Systems', 'gRPC'], about: 'Backend systems engineer building high-throughput services.', price: 150 },
  { email: 'grace@agents.io', name: 'Grace Lee', skills: ['Data Engineering', 'Spark', 'SQL'], about: 'Data engineer with experience in petabyte-scale pipelines.', price: 130 },
  { email: 'hank@agents.io', name: 'Hank Garcia', skills: ['Security', 'Penetration Testing', 'OSINT'], about: 'Cybersecurity consultant and ethical hacker.', price: 175 },
];

function genId(prefix) { return `${prefix}_${Date.now()}_${Math.floor(Math.random()*10000)}`; }

async function main() {
  await db.init();
  console.log('Clearing existing data...');
  await db.pool.query('TRUNCATE TABLE matches, profiles, users RESTART IDENTITY CASCADE');
  console.log('Seeding agents...');
  for (const a of AGENTS) {
    const uid = genId('user');
    const user = await db.addUser(uid, a.email, a.name);
    console.log(`  User: ${user.email} (${user.id})`);
    const pid = genId('profile');
    await db.createProfile(pid, user.id, a.skills, a.about, a.price);
    console.log(`  Profile: ${pid}`);
  }
  // Create a few sample matches
  const profiles = await db.getProfiles();
  if (profiles.length >= 4) {
    await db.createMatch(genId('match'), profiles[0].id, profiles[1].id);
    await db.createMatch(genId('match'), profiles[2].id, profiles[3].id);
    console.log('  Created 2 sample matches');
  }
  console.log('Seed complete!');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
