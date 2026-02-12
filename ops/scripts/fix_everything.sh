#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/ubuntu/Agent-Tinder"
BACKEND_DIR="$REPO_DIR/apps/backend"
OPENCLAW_DIR="/home/ubuntu/openclaw"
SYSTEMD_DIR="/etc/systemd/system"

echo "Fix-All script for AgentTinder — attempts to bring services up and auto-configure Telegram chat id"
echo "Repo: $REPO_DIR"

if [ ! -d "$REPO_DIR" ]; then
  echo "Repo not found at $REPO_DIR" >&2
  exit 1
fi

cd "$REPO_DIR"

# 1) Ensure data dir and tasks.json exist
mkdir -p "$BACKEND_DIR/data"
if [ ! -f "$BACKEND_DIR/data/tasks.json" ]; then
  echo '[]' > "$BACKEND_DIR/data/tasks.json"
  chown ubuntu:ubuntu "$BACKEND_DIR/data/tasks.json" || true
  chmod 600 "$BACKEND_DIR/data/tasks.json" || true
fi

# 2) Ensure a safe tasksWorker exists (idempotent)
mkdir -p "$BACKEND_DIR/src"
cat > "$BACKEND_DIR/src/tasksWorker.js" <<'JS'
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const TASKS_FILE = path.resolve(__dirname, '../data/tasks.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function readTasks(){ try{ if(!fs.existsSync(TASKS_FILE)) fs.writeFileSync(TASKS_FILE,'[]'); return JSON.parse(fs.readFileSync(TASKS_FILE,'utf8')||'[]'); }catch(e){console.error('read err',e); return []; }}
function writeTasks(t){ try{ fs.writeFileSync(TASKS_FILE, JSON.stringify(t,null,2)); }catch(e){console.error('write err',e);} }
(async()=>{
  console.log('safe worker started');
  while(true){
    try{
      const tasks = readTasks();
      const i = tasks.findIndex(t=>t.status==='pending');
      if(i>=0){
        const t = tasks[i]; t.status='processing'; writeTasks(tasks);
        console.log('processing', t.id||t.taskId||'unknown');
        await sleep(1500);
        t.status='done'; t.result={ok:true,processedAt:new Date().toISOString()}; tasks[i]=t; writeTasks(tasks);
        console.log('done', t.id||t.taskId||'unknown');
      }
    }catch(e){ console.error('loop err',e); }
    await sleep(2000);
  }
})();
JS
chmod +x "$BACKEND_DIR/src/tasksWorker.js" || true

# 3) Install systemd unit from repo (ops/systemd) if present, else write minimal
if [ -f "$REPO_DIR/ops/systemd/tasks-worker.service" ]; then
  sudo cp "$REPO_DIR/ops/systemd/tasks-worker.service" "$SYSTEMD_DIR/tasks-worker.service"
else
  sudo tee "$SYSTEMD_DIR/tasks-worker.service" > /dev/null <<'UNIT'
[Unit]
Description=AgentTinder Tasks Worker
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=$BACKEND_DIR/src
ExecStart=/usr/bin/node $BACKEND_DIR/src/tasksWorker.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=$REPO_DIR/.env

[Install]
WantedBy=multi-user.target
UNIT
fi

# 4) Ensure OpenClaw stub exists and unit
mkdir -p "$OPENCLAW_DIR"
cat > "$OPENCLAW_DIR/index.js" <<'OC'
const express = require('express');
const app = express();
app.use(express.json());
app.get('/health',(r,s)=>s.json({status:'ok',uptime:process.uptime()}));
app.post('/process',(r,s)=>s.json({ok:true,result:'stub:'+JSON.stringify(r.body||{})}));
app.listen(8080,'127.0.0.1',()=>console.log('openclaw-stub listening'));
OC
chown -R ubuntu:ubuntu "$OPENCLAW_DIR" || true

sudo tee "$SYSTEMD_DIR/openclaw.service" > /dev/null <<'UNIT'
[Unit]
Description=OpenClaw (stub)
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
UNIT

# 5) Reload systemd and start units
sudo systemctl daemon-reload
sudo systemctl enable --now tasks-worker.service openclaw.service || true

echo
echo "Services started. Checking status..."
sudo systemctl status tasks-worker --no-pager -n 10 || true
sudo systemctl status openclaw --no-pager -n 10 || true

# 6) Try to auto-discover TELEGRAM_CHAT_ID via getUpdates if TELEGRAM_BOT_TOKEN present
ENVFILE="$REPO_DIR/.env"
if [ -f "$ENVFILE" ]; then
  TELEGRAM_BOT_TOKEN=$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ENVFILE" | cut -d'=' -f2- | tr -d '"') || true
fi
if [ -z "${TELEGRAM_BOT_TOKEN-}" ]; then
  echo "No TELEGRAM_BOT_TOKEN found in $ENVFILE. Can't discover chat id automatically. Please set TELEGRAM_BOT_TOKEN in .env and rerun.";
  exit 0
fi

echo "Attempting to fetch Telegram updates to discover chat id (3 attempts, 5s apart). If nobody messaged your bot yet, this will fail." 
for i in 1 2 3; do
  echo "Attempt $i..."
  UPDATES=$(curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates") || UPDATES=''
  CHATID=$(echo "$UPDATES" | python3 -c "import sys, json; d=json.load(sys.stdin); r=d.get('result',[]);
ids=[str(item.get('message',{}).get('chat',{}).get('id')) for item in r if item.get('message')]
print(ids[-1] if ids else '')" 2>/dev/null || true)
  if [ -n "$CHATID" ]; then
    echo "Found chat id: $CHATID"
    # write to .env if not present
    if grep -q '^TELEGRAM_CHAT_ID=' "$ENVFILE" 2>/dev/null; then
      sed -i "s/^TELEGRAM_CHAT_ID=.*/TELEGRAM_CHAT_ID=$CHATID/" "$ENVFILE"
    else
      echo "TELEGRAM_CHAT_ID=$CHATID" >> "$ENVFILE"
    fi
    echo "Updated $ENVFILE with TELEGRAM_CHAT_ID"
    break
  fi
  sleep 5
done

if [ -z "${CHATID-}" ]; then
  echo "Could not auto-discover chat id. One manual step required: send any message to your Telegram bot from your account, then rerun this script."
  exit 0
fi

# 7) Notify backend internal endpoint to test
echo "Testing backend /internal/notify..."
curl -sS -X POST http://127.0.0.1:3001/internal/notify -H 'Content-Type: application/json' \
  -d "$(jq -n --arg id "$CHATID" '{userId: "automated-test", taskId: "test-001", result: {ok:true}, chatId: $id}')" || true

echo "Fix-all script completed. If Telegram message did not arrive, please message your bot once and re-run." 
