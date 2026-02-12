#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/ubuntu/Agent-Tinder"
BACKEND_DIR="$REPO_DIR/apps/backend"
TELEGRAM_DIR="$REPO_DIR/apps/telegram-bot"
OPENCLAW_STUB_DIR="/home/ubuntu/openclaw"

echo "Bootstrap AgentTinder (safe, single-run)."
echo "This script will: install deps, create an OpenClaw stub, install a tasks worker, and install systemd units."
echo "It will NOT touch AWS resources. Ensure you run this on your EC2 t3.micro only."

sudo apt-get update
sudo apt-get install -y nodejs npm tmux curl jq

if [ ! -d "$REPO_DIR" ]; then
  echo "Repository not found at $REPO_DIR — please clone AgentTinder there before running this script." >&2
  exit 1
fi

echo "Creating OpenClaw stub (127.0.0.1:8080)"
sudo mkdir -p "$OPENCLAW_STUB_DIR"
cat > "$OPENCLAW_STUB_DIR/index.js" <<'JS'
const express = require('express');
const app = express();
app.use(express.json());
app.get('/health', (req,res)=>res.json({ok:true, time:new Date().toISOString()}));
app.post('/process', (req,res)=>{
  // simulate processing
  const { type, body } = req.body || {};
  res.json({ ok:true, result: `processed:${type}:${JSON.stringify(body||{})}` });
});
app.listen(8080,'127.0.0.1',()=>console.log('openclaw-stub listening 127.0.0.1:8080'));
JS

sudo chown -R ubuntu:ubuntu "$OPENCLAW_STUB_DIR"

echo "Installing OpenClaw systemd unit (local stub)"
sudo tee /etc/systemd/system/openclaw.service > /dev/null <<'SERVICE'
[Unit]
Description=OpenClaw (safe stub) - localhost only
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/openclaw
ExecStart=/usr/bin/node /home/ubuntu/openclaw/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

echo "Preparing backend file queue and worker"
mkdir -p "$BACKEND_DIR/data"
touch "$BACKEND_DIR/data/tasks.json"
chown -R ubuntu:ubuntu "$BACKEND_DIR/data"

echo "Installing tasks worker"
cat > "$BACKEND_DIR/src/tasksWorker.js" <<'JS'
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const DATA_FILE = path.join(__dirname, '..', 'data', 'tasks.json');
const BACKEND_API = process.env.BACKEND_API_URL || 'http://127.0.0.1:3001';

async function loadTasks(){
  try{ const txt = await fs.readFile(DATA_FILE,'utf8'); return JSON.parse(txt||'[]'); }catch(e){ return []; }
}
async function saveTasks(tasks){ await fs.writeFile(DATA_FILE, JSON.stringify(tasks,null,2),'utf8'); }

async function poll(){
  while(true){
    const tasks = await loadTasks();
    const pending = tasks.find(t=>t.status==='pending');
    if(!pending){ await new Promise(r=>setTimeout(r,3000)); continue; }
    try{
      pending.status='processing'; await saveTasks(tasks);
      const resp = await axios.post('http://127.0.0.1:8080/process', { type: pending.type, body: pending.body }, { timeout: 20000 });
      pending.status='done'; pending.result = resp.data; pending.done_at = new Date().toISOString();
      await saveTasks(tasks);
      // notify backend internal endpoint (if present)
      try{ await axios.post(BACKEND_API + '/internal/notify', { userId: pending.userId, taskId: pending.id, result: pending.result }); }catch(e){ console.error('notify failed', e.message); }
    }catch(err){
      console.error('process task failed', err?.message||err);
      pending.status='failed'; pending.error = err?.message || String(err); await saveTasks(tasks);
    }
  }
}

poll().catch(e=>{ console.error('worker crashed', e); process.exit(1); });
JS

# Install the tasks-worker systemd unit from the repo (keeps future deploys consistent)
if [ -f "$REPO_DIR/ops/systemd/tasks-worker.service" ]; then
  echo "Copying tasks-worker.service from repo"
  sudo cp "$REPO_DIR/ops/systemd/tasks-worker.service" /etc/systemd/system/tasks-worker.service
else
  echo "No tasks-worker.service in repo; writing a minimal unit to /etc/systemd/system"
  sudo tee /etc/systemd/system/tasks-worker.service > /dev/null <<'SERVICE'
[Unit]
Description=AgentTinder Tasks Worker
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$BACKEND_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node $BACKEND_DIR/src/tasksWorker.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE
fi

echo "Ensure systemd picks up units and start services"
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw.service || true
sudo systemctl enable --now tasks-worker.service || true

echo "Bootstrap complete."
echo "Verify OpenClaw: curl -sS http://127.0.0.1:8080/health"
echo "Tasks file: $BACKEND_DIR/data/tasks.json"
echo "To test: POST a task to your backend /tasks endpoint; worker will pick up entries in that file and call OpenClaw."

exit 0
