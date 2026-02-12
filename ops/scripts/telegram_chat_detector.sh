#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/ubuntu/Agent-Tinder"
ENVFILE="$REPO_DIR/.env"

if [ ! -f "$ENVFILE" ]; then
  echo "No .env at $ENVFILE, nothing to do." >&2
  exit 0
fi

TELEGRAM_BOT_TOKEN=$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ENVFILE" | cut -d'=' -f2- | tr -d '"') || true
if [ -z "${TELEGRAM_BOT_TOKEN-}" ]; then
  echo "No TELEGRAM_BOT_TOKEN in $ENVFILE" >&2
  exit 0
fi

UPDATES=$(curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates" || true)
CHATID=$(echo "$UPDATES" | python3 -c 'import sys, json
try:
  d=json.load(sys.stdin)
  r=d.get("result",[])
  ids=[str(item.get("message",{}).get("chat",{}).get("id")) for item in r if item.get("message")]
  print(ids[-1] if ids else "")
except Exception:
  print("")') || true

if [ -n "$CHATID" ]; then
  if grep -q '^TELEGRAM_CHAT_ID=' "$ENVFILE" 2>/dev/null; then
    sed -i "s/^TELEGRAM_CHAT_ID=.*/TELEGRAM_CHAT_ID=$CHATID/" "$ENVFILE"
  else
    echo "TELEGRAM_CHAT_ID=$CHATID" >> "$ENVFILE"
  fi
  echo "Wrote TELEGRAM_CHAT_ID=$CHATID to $ENVFILE"
else
  echo "No chat id found in bot updates." >&2
fi

exit 0
