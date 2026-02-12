import { suggestPlan, requestBuild, requestFix } from './openclawClient';

export async function handlePlan(prompt: string) {
  // return a suggested plan from OpenClaw
  const r = await suggestPlan(prompt);
  return r;
}

export async function handleBuild(prompt: string) {
  const r = await requestBuild(prompt);
  return r;
}

export async function handleFix(prompt: string) {
  const r = await requestFix(prompt);
  return r;
}
