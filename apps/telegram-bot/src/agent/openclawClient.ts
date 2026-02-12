import axios from 'axios';

const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://127.0.0.1:8080';

export interface OpenClawResponse {
  id?: string;
  status?: string;
  output?: any;
}

export async function runOpenClawCommand(command: string, payload: any = {}): Promise<OpenClawResponse> {
  // POST to the OpenClaw HTTP API. Adjust path if your OpenClaw uses a different route.
  const url = `${OPENCLAW_API_URL}/run`;
  const body = { command, payload };
  const res = await axios.post(url, body, { timeout: 120000 });
  return res.data || { status: 'ok' };
}

export async function suggestPlan(prompt: string) {
  return runOpenClawCommand('plan', { prompt });
}

export async function requestBuild(prompt: string) {
  return runOpenClawCommand('build', { prompt });
}

export async function requestFix(prompt: string) {
  return runOpenClawCommand('fix', { prompt });
}
