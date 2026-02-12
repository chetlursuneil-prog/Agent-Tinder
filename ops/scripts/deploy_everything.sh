#!/usr/bin/env bash
set -euo pipefail

echo "========================================"
echo "AgentTinder Complete Deployment Script"
echo "========================================"

BASE=/home/ubuntu/Agent-Tinder
cd "$BASE"

echo "[1/7] Patching backend for degraded DB mode"
INDEX="$BASE/apps/backend/src/index.js"
if [ -f "$INDEX" ]; then
  if ! grep -q "DB initialization failed, continuing in degraded mode" "$INDEX" 2>/dev/null; then
    cp -n "$INDEX" "$INDEX.bak.deploy" || true
    perl -0777 -pe 's/await db.init\(\);/try {\n        await db.init();\n    } catch (err) {\n        console.warn("DB initialization failed, continuing in degraded mode (file-backed features only).", err?.message || err);\n    }/s' -i "$INDEX"
    echo " ✓ Patched backend"
  else
    echo " ✓ Backend already patched"
  fi
fi

echo "[2/7] Ensuring tasks.json exists"
TASKS_FILE="$BASE/apps/backend/data/tasks.json"
mkdir -p "$(dirname "$TASKS_FILE")"
if [ ! -s "$TASKS_FILE" ]; then
  echo "[]" > "$TASKS_FILE"
  echo " ✓ Created $TASKS_FILE"
else
  echo " ✓ tasks.json exists"
fi

echo "[3/7] Deploying fixed telegram bot"
BOT_FIXED="$BASE/apps/telegram-bot/src/bot-fixed.js"
if [ -f "$BOT_FIXED" ]; then
  echo " ✓ bot-fixed.js present"
else
  echo " ! bot-fixed.js missing — copying from repo if available"
  if [ -f "$BASE/ops/scripts/../apps/telegram-bot/src/bot-fixed.js" ]; then
    cp "$BASE/ops/scripts/../apps/telegram-bot/src/bot-fixed.js" "$BOT_FIXED"
  fi
fi

echo "[4/7] Installing systemd units"
sudo cp "$BASE/ops/systemd/telegram-bot-fixed.service" /etc/systemd/system/telegram-bot.service 2>/dev/null || {
  echo " ! telegram-bot-fixed.service not in repo; writing inline"
  sudo tee /etc/systemd/system/telegram-bot.service > /dev/null <<'EOFUNIT'
[Unit]
Description=AgentTinder Telegram Bot
After=network.target backend.service
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/Agent-Tinder/apps/telegram-bot
EnvironmentFile=/home/ubuntu/Agent-Tinder/.env
Environment=NODE_OPTIONS=--dns-result-order=ipv4first
Environment=BACKEND_API_URL=http://127.0.0.1:3001
ExecStart=/usr/bin/node /home/ubuntu/Agent-Tinder/apps/telegram-bot/src/bot-fixed.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOFUNIT
}
echo " ✓ Installed telegram-bot.service"

echo "[5/7] Reloading systemd and restarting services"
sudo systemctl daemon-reload
for svc in openclaw tasks-worker backend telegram-bot; do
  if systemctl list-units --type=service --all | grep -q "${svc}.service"; then
    sudo systemctl enable ${svc}.service || true
    sudo systemctl restart ${svc}.service || true
    echo " ✓ Restarted ${svc}.service"
  else
    echo " ! ${svc}.service not found"
  fi
done

echo "[6/7] Waiting 3 seconds for services to stabilize"
sleep 3

echo "[7/7] Checking service statuses"
for svc in openclaw tasks-worker backend telegram-bot; do
  if systemctl list-units --type=service --all | grep -q "${svc}.service"; then
    if sudo systemctl is-active --quiet ${svc}.service; then
      echo " ✓ ${svc}.service is active"
    else
      echo " ✗ ${svc}.service is NOT active"
      sudo systemctl status ${svc}.service --no-pager --lines=10 || true
    fi
  fi
done

echo ""
echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Open your Telegram app and send /start to your bot"
echo "2. Send: /plan add a hello world feature"
echo "3. Watch for the bot's reply with task results"
echo ""
echo "To monitor logs in real-time:"
echo "  sudo journalctl -u telegram-bot -f"
echo "  sudo journalctl -u tasks-worker -f"
echo "  sudo journalctl -u backend -f"
echo ""
