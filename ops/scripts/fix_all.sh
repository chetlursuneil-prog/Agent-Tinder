#!/usr/bin/env bash
set -euo pipefail

BASE=/home/ubuntu/Agent-Tinder
INDEX="$BASE/apps/backend/src/index.js"
BACKUP="$INDEX.bak.fix_all"
TASKS_FILE="$BASE/apps/backend/data/tasks.json"

echo "[fix_all] base=$BASE"

if [ -f "$INDEX" ]; then
  if ! grep -q "DB initialization failed, continuing in degraded mode" "$INDEX" 2>/dev/null; then
    echo "[fix_all] backing up $INDEX -> $BACKUP"
    cp -n "$INDEX" "$BACKUP" || true
    echo "[fix_all] patching $INDEX to tolerate DB failures"
    perl -0777 -pe 's/await db.init\(\);/try {\n        await db.init();\n    } catch (err) {\n        console.warn("DB initialization failed, continuing in degraded mode (file-backed features only).", err?.message || err);\n    }/s' -i "$INDEX"
  else
    echo "[fix_all] backend already patched for degraded DB mode"
  fi
else
  echo "[fix_all] WARNING: backend index not found at $INDEX"
fi

echo "[fix_all] ensuring tasks file exists"
mkdir -p "$(dirname "$TASKS_FILE")"
if [ ! -s "$TASKS_FILE" ]; then
  echo "[]" > "$TASKS_FILE"
  echo "[fix_all] created $TASKS_FILE"
else
  # basic sanity: ensure valid JSON array (try with node if available)
  if command -v node >/dev/null 2>&1; then
    node -e "try{const fs=require('fs');const t=fs.readFileSync('$TASKS_FILE','utf8')||'[]'; JSON.parse(t); if(!Array.isArray(JSON.parse(t))) throw 1;}catch(e){process.exit(2)}" || { echo "[]" > "$TASKS_FILE"; echo "[fix_all] reset $TASKS_FILE to empty array"; }
  fi
fi

echo "[fix_all] reloading systemd and restarting services"
sudo systemctl daemon-reload
for svc in openclaw tasks-worker backend telegram-bot telegram-chat-detector; do
  if systemctl list-units --type=service --all | grep -q "${svc}.service"; then
    sudo systemctl restart ${svc}.service || true
    echo "[fix_all] restarted ${svc}.service"
  else
    echo "[fix_all] service ${svc}.service not found, skipping"
  fi
done

echo "[fix_all] validating Telegram token with getMe"
TOKEN=$(sed -n 's/^TELEGRAM_BOT_TOKEN=//p' "$BASE/.env" 2>/dev/null || true)
if [ -z "$TOKEN" ]; then
  echo "[fix_all] TELEGRAM_BOT_TOKEN not set in $BASE/.env"
else
  curl -sS "https://api.telegram.org/bot${TOKEN}/getMe" || true
fi

CHAT_ID=$(sed -n 's/^TELEGRAM_CHAT_ID=//p' "$BASE/.env" 2>/dev/null || true)
if [ -z "$CHAT_ID" ]; then
  echo "[fix_all] TELEGRAM_CHAT_ID not set in $BASE/.env — cannot run notify test"
else
  echo "[fix_all] running internal/notify test to chat_id=$CHAT_ID"
  curl -i -sS -X POST http://127.0.0.1:3001/internal/notify \
    -H 'Content-Type: application/json' \
    -d "{\"userId\":\"$CHAT_ID\",\"taskId\":\"fix_all_test\",\"result\":{\"ok\":true,\"message\":\"fix_all notify test\"}}" || true
fi

echo "[fix_all] enqueueing a demo task to /tasks"
curl -sS -X POST http://127.0.0.1:3001/tasks \
  -H 'Content-Type: application/json' \
  -d '{"userId":"manual-test","type":"build","body":{"repo":"demo"}}' || true

echo "[fix_all] collecting recent logs (backend + tasks-worker)"
sudo journalctl -u backend -n 200 --no-pager | sed -n '1,200p' || true
sudo journalctl -u tasks-worker -n 200 --no-pager | sed -n '1,200p' || true

echo "[fix_all] finished — check Telegram for notify and watch logs with 'sudo journalctl -u tasks-worker -f'"
