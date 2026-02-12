#!/usr/bin/env bash
set -euo pipefail

# Run this on the EC2 instance as ubuntu (or adjust WORKDIR).
# It will install the prepared unit (if present in the repo) or write a safe unit,
# reload systemd and restart the service, then show recent logs.

WORKDIR=/home/ubuntu/Agent-Tinder/apps/telegram-bot
UNIT_IN_REPO="$WORKDIR/ops/systemd/telegram-bot.service"

if [ -f "$UNIT_IN_REPO" ]; then
  echo "Using unit from repo: $UNIT_IN_REPO"
  sudo cp "$UNIT_IN_REPO" /etc/systemd/system/telegram-bot.service
else
  echo "No repo unit found; writing canonical unit to /etc/systemd/system/telegram-bot.service"
  sudo tee /etc/systemd/system/telegram-bot.service > /dev/null <<'EOF'
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
EOF
fi

echo "Reloading systemd and starting telegram-bot"
sudo systemctl daemon-reload
sudo systemctl enable --now telegram-bot || true
sudo systemctl restart telegram-bot || true

echo
echo "Last 200 journal lines for telegram-bot:"
sudo journalctl -u telegram-bot -n 200 --no-pager

echo
echo "If you need to run the bot manually for debugging, run:" 
echo "  cd $WORKDIR && export TELEGRAM_TOKEN=\$(grep '^TELEGRAM_TOKEN=' .env | cut -d'=' -f2-) && NODE_OPTIONS=--dns-result-order=ipv4first node src/bot.js"
