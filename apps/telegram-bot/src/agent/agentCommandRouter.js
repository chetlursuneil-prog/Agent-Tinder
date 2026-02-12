const { suggestPlan, requestBuild, requestFix } = require('./openclawClient');

async function handlePlan(prompt) {
  return suggestPlan(prompt);
}

async function handleBuild(prompt) {
  return requestBuild(prompt);
}

async function handleFix(prompt) {
  return requestFix(prompt);
}

module.exports = { handlePlan, handleBuild, handleFix };
