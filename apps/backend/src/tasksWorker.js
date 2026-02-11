#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const TASKS_FILE = path.resolve(__dirname, '../data/tasks.json');
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
(async function main(){
  console.log('tasksWorker started', new Date().toISOString());
  while(true){
    try{
      const tasks = safeRead();
      const idx = tasks.findIndex(t => t.status === 'pending');
      if(idx >= 0){
        const t = tasks[idx];
        t.status = 'processing';
        safeWrite(tasks);
        console.log('processing task', t.id || t.taskId || 'unknown');
        // Simulate work (placeholder) — replace with real OpenClaw call later
        await sleep(1500);
        t.status = 'done';
        t.result = { ok: true, processedAt: new Date().toISOString() };
        tasks[idx] = t;
        safeWrite(tasks);
        console.log('finished task', t.id || t.taskId || 'unknown');
      }
    } catch(err){ console.error('worker loop error', err); }
    await sleep(2000);
  }
})();
