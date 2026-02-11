const fs = require('fs');
const signupData = require('./signup.json');

describe('User Signup Test', () => {
  test('should sign up a new user successfully', async () => {
    const response = await fetch('https://api.example.com/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signupData)
    });
    const result = await response.json();
    expect(response.status).toBe(201);
    expect(result.message).toBe('Signup successful');
  });
});