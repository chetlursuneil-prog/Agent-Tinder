#!/usr/bin/env bash
set -euo pipefail

# Run from your local machine to copy the unit and restart the service on the EC2 host.
# Usage: ./deploy_from_local.sh <ec2-user@host> [repo-path-on-remote]
# Example: ./deploy_from_local.sh ubuntu@16.171.1.185 /home/ubuntu/Agent-Tinder

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <ec2-user@host> [repo-path-on-remote]"
  exit 2
fi

REMOTE="$1"
REMOTE_REPO_PATH="${2:-/home/ubuntu/Agent-Tinder}"

LOCAL_UNIT="ops/systemd/telegram-bot.service"
if [ ! -f "$LOCAL_UNIT" ]; then
  echo "Local unit $LOCAL_UNIT not found in this checkout. Creating remote unit from canonical content instead."
fi

echo "Copying unit to remote /tmp and installing via SSH..."
if [ -f "$LOCAL_UNIT" ]; then
  scp "$LOCAL_UNIT" "$REMOTE:/tmp/telegram-bot.service"
  SSH_CMD="sudo cp /tmp/telegram-bot.service /etc/systemd/system/telegram-bot.service"
else
  # Send canonical unit via SSH heredoc
  ssh "$REMOTE" 'sudo tee /etc/systemd/system/telegram-bot.service > /dev/null <<"EOF"
[Unit]
Description=AgentTinder Telegram Bot
After=network.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/Agent-Tinder/apps/telegram-bot
# Environment file should contain TELEGRAM_TOKEN, ADMIN_TELEGRAM_IDS, OPENCLAW_API_URL
EnvironmentFile=/home/ubuntu/Agent-Tinder/apps/telegram-bot/.env
Environment=NODE_OPTIONS=--dns-result-order=ipv4first
ExecStart=/usr/bin/node src/bot.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF'
  SSH_CMD="true"
fi

echo "Running remote systemctl reload + restart"
ssh "$REMOTE" "sudo systemctl daemon-reload && sudo systemctl enable --now telegram-bot || true && sudo systemctl restart telegram-bot || true && sudo journalctl -u telegram-bot -n 200 --no-pager"

echo "Done. If there are errors, run the EC2-side script: $REMOTE_REPO_PATH/ops/systemd/deploy_telegram_bot.sh on the remote host." 
