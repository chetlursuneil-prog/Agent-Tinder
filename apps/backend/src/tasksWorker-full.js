#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const TASKS_FILE = path.resolve(__dirname, '../data/tasks.json');
const OPENCLAW_URL = process.env.OPENCLAW_API_URL || 'http://127.0.0.1:8080';
const BACKEND_URL = process.env.BACKEND_API_URL || 'http://127.0.0.1:3001';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function safeRead(){
  try {
    if(!fs.existsSync(TASKS_FILE)) fs.writeFileSync(TASKS_FILE, '[]', {mode:0o600});
    return JSON.parse(fs.readFileSync(TASKS_FILE,'utf8')||'[]');
  } catch(e){ console.error('read error',e); return []; }
}

function safeWrite(tasks){
  try{ fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2)); } catch(e){ console.error('write error', e); }
}

async function callOpenClaw(type, body) {
  try {
    const res = await fetch(`${OPENCLAW_URL}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, body })
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error('OpenClaw error:', res.status, txt);
      return { ok: false, error: `OpenClaw returned ${res.status}` };
    }
    return await res.json();
  } catch (err) {
    console.error('OpenClaw call failed:', err?.message || err);
    return { ok: false, error: err?.message || 'OpenClaw unreachable' };
  }
}

async function notifyBackend(userId, taskId, result) {
  try {
    const res = await fetch(`${BACKEND_URL}/internal/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, taskId, result })
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error('Backend notify failed:', res.status, txt);
      return false;
    }
    console.log('Notified backend for task', taskId);
    return true;
  } catch (err) {
    console.error('Backend notify error:', err?.message || err);
    return false;
  }
}

(async function main(){
  console.log('tasksWorker started', new Date().toISOString());
  console.log('OpenClaw URL:', OPENCLAW_URL);
  console.log('Backend URL:', BACKEND_URL);
  
  while(true){
    try{
      const tasks = safeRead();
      const idx = tasks.findIndex(t => t.status === 'pending');
      if(idx >= 0){
        const t = tasks[idx];
        t.status = 'processing';
        safeWrite(tasks);
        console.log('processing task', t.id, 'type:', t.type);
        
        // Call OpenClaw
        const result = await callOpenClaw(t.type, t.body);
        
        t.status = 'done';
        t.result = result;
        t.processedAt = new Date().toISOString();
        tasks[idx] = t;
        safeWrite(tasks);
        console.log('finished task', t.id, 'ok:', result.ok);
        
        // Notify user via backend
        if (t.userId) {
          await notifyBackend(t.userId, t.id, result);
        }
      }
    } catch(err){ console.error('worker loop error', err); }
    await sleep(2000);
  }
})();
