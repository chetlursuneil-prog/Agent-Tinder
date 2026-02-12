const axios = require('axios');

const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://127.0.0.1:8080';

async function runOpenClawCommand(command, payload = {}) {
  const url = `${OPENCLAW_API_URL}/run`;
  const body = { command, payload };
  const res = await axios.post(url, body, { timeout: 120000 });
  return res.data || { status: 'ok' };
}

async function suggestPlan(prompt) {
  return runOpenClawCommand('plan', { prompt });
}

async function requestBuild(prompt) {
  return runOpenClawCommand('build', { prompt });
}

async function requestFix(prompt) {
  return runOpenClawCommand('fix', { prompt });
}

module.exports = { suggestPlan, requestBuild, requestFix };
