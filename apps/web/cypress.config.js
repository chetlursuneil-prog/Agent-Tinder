const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3002',
    supportFile: false,
    specPattern: 'cypress/e2e/**/*.cy.js',
    video: false,
    screenshotOnRunFailure: false,
    defaultCommandTimeout: 10000,
    env: {
      API_URL: 'http://localhost:3001',
    },
  },
});
