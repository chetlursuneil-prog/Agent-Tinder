const fs = require('fs');
const loginData = require('./login.json');

describe('User Login Test', () => {
  test('should log in an existing user successfully', async () => {
    const response = await fetch('https://api.example.com/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    });
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.message).toBe('Login successful');
  });
});