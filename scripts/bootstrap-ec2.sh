#!/usr/bin/env bash
set -euo pipefail

# Bootstrap script for EC2 (Ubuntu 22.04) — run as ubuntu user with sudo
# This script automates the exact Free-Tier-safe install steps from the doc.

echo "Starting AgentTinder EC2 bootstrap"

sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential python3 python3-venv python3-pip

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install GitHub CLI
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install -y gh

echo "Configuring git identity (update as needed)"
git config --global user.name "Your Name"
git config --global user.email "you@example.com"

cd /home/ubuntu

if [ ! -d agenttinder ]; then
  echo "Cloning repo into /home/ubuntu/agenttinder"
  git clone https://github.com/chetlursuneil-prog/Agent-Tinder.git agenttinder
else
  echo "Repository already exists, skipping clone"
fi

# Create OpenClaw stub
mkdir -p /home/ubuntu/openclaw
cat > /home/ubuntu/openclaw/index.js <<'EOF'
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

app.post('/run', (req, res) => {
  const { command, payload } = req.body || {};
  const id = 'oc-' + Date.now();
  const safeOutput = {
    id,
    command: command || null,
    result: `Received ${command || '<none>'}`,
    payloadPreview: payload && typeof payload === 'object' ? payload : null,
  };
  return res.json({ status: 'ok', output: safeOutput });
});

app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const server = app.listen(8080, '127.0.0.1', () => {
  console.log('OpenClaw stub listening on http://127.0.0.1:8080');
});
module.exports = server;
EOF

cd /home/ubuntu/openclaw
npm init -y >/dev/null
npm install express body-parser >/dev/null

echo "Installing Telegram bot deps"
cd /home/ubuntu/agenttinder/apps/telegram-bot
npm install >/dev/null || true

echo "Installing openclaw systemd unit and telegram-bot systemd unit"
sudo tee /etc/systemd/system/openclaw.service > /dev/null <<'EOF'
[Unit]
Description=OpenClaw Local Stub (binds to localhost only)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/openclaw
ExecStart=/usr/bin/node index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/telegram-bot.service > /dev/null <<'EOF'
[Unit]
Description=AgentTinder Telegram Bot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/agenttinder/apps/telegram-bot
EnvironmentFile=/home/ubuntu/agenttinder/apps/telegram-bot/.env
ExecStart=/usr/bin/node src/bot.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now openclaw.service
sudo systemctl enable --now telegram-bot.service || echo "You must create /home/ubuntu/agenttinder/apps/telegram-bot/.env first"

echo "Bootstrap complete. Check 'sudo systemctl status openclaw' and 'sudo systemctl status telegram-bot'"
