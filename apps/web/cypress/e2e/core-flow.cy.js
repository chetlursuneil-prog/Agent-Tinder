/**
 * E2E Smoke Test: Full user flow
 * signup → create profile → search → swipe → match → message
 */

const API = Cypress.env('API_URL');
const timestamp = Date.now();
const testEmailA = `cypress-a-${timestamp}@test.com`;
const testEmailB = `cypress-b-${timestamp}@test.com`;

describe('AgentTinder E2E — Core Flow', () => {
  let userA, userB, profileA, profileB;

  it('creates two test users via API', () => {
    // User A
    cy.request('POST', `${API}/auth/signup`, { email: testEmailA, name: 'CypressA' })
      .then(res => {
        expect(res.status).to.eq(200);
        expect(res.body).to.have.property('id');
        userA = res.body;
      });

    // User B
    cy.request('POST', `${API}/auth/signup`, { email: testEmailB, name: 'CypressB' })
      .then(res => {
        expect(res.status).to.eq(200);
        userB = res.body;
      });
  });

  it('creates profiles for both users via API', () => {
    cy.request('POST', `${API}/profiles`, {
      userId: userA.id,
      skills: ['Python', 'AI'],
      about: 'Cypress test agent A',
      price: '100',
    }).then(res => {
      expect(res.status).to.eq(200);
      profileA = res.body;
    });

    cy.request('POST', `${API}/profiles`, {
      userId: userB.id,
      skills: ['React', 'Node'],
      about: 'Cypress test agent B',
      price: '150',
    }).then(res => {
      expect(res.status).to.eq(200);
      profileB = res.body;
    });
  });

  it('User A likes User B → one-sided like', () => {
    cy.request('POST', `${API}/matches`, { a: profileA.id, b: profileB.id })
      .then(res => {
        expect(res.status).to.eq(202);
        expect(res.body).to.have.property('liked', true);
      });
  });

  it('User B likes User A → mutual match', () => {
    cy.request('POST', `${API}/matches`, { a: profileB.id, b: profileA.id })
      .then(res => {
        expect(res.status).to.eq(201);
        expect(res.body).to.have.property('id');
      });
  });

  it('sends a message from A to B', () => {
    cy.request('GET', `${API}/matches`).then(matchesRes => {
      const match = matchesRes.body.find(
        m => (m.a === profileA.id && m.b === profileB.id) || (m.a === profileB.id && m.b === profileA.id)
      );
      expect(match).to.not.be.undefined;

      cy.request('POST', `${API}/messages`, {
        matchId: match.id,
        fromUserId: userA.id,
        text: 'Hello from CypressA!',
      }).then(res => {
        expect(res.status).to.eq(200);
        expect(res.body).to.have.property('text', 'Hello from CypressA!');
      });
    });
  });

  it('loads search page and sees profiles', () => {
    cy.visit('/search');
    cy.contains('Browse Marketplace').should('be.visible');
  });

  it('loads login page', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').should('be.visible');
  });

  it('User A can leave a review for User B', () => {
    cy.request('GET', `${API}/matches`).then(matchesRes => {
      const match = matchesRes.body.find(
        m => (m.a === profileA.id && m.b === profileB.id) || (m.a === profileB.id && m.b === profileA.id)
      );

      cy.request('POST', `${API}/reviews`, {
        fromUserId: userA.id,
        toProfileId: profileB.id,
        matchId: match.id,
        rating: 5,
        text: 'Great agent!',
      }).then(res => {
        expect(res.status).to.eq(201);
        expect(res.body).to.have.property('rating', 5);
      });
    });
  });

  it('User B sees reviews on their profile', () => {
    cy.request('GET', `${API}/reviews/${profileB.id}`).then(res => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.length.greaterThan(0);
      expect(res.body[0]).to.have.property('rating', 5);
    });
  });

  it('User A can create a referral', () => {
    cy.request('POST', `${API}/referrals`, {
      referrerUserId: userA.id,
      referredEmail: 'friend@test.com',
    }).then(res => {
      expect(res.status).to.eq(201);
      expect(res.body).to.have.property('code');
    });
  });

  it('Admin dashboard loads', () => {
    cy.request('GET', `${API}/admin/dashboard`).then(res => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.property('counts');
      expect(res.body.counts).to.have.property('users');
    });
  });
});
