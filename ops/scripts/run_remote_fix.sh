#!/usr/bin/env bash
set -euo pipefail

# Usage: ./run_remote_fix.sh <host> [ssh_key_path]
# Example: ./run_remote_fix.sh 16.171.1.185 ~/.ssh/id_ed25519_agenttinder

HOST=${1:-}
KEY=${2:-$HOME/.ssh/id_ed25519_agenttinder}
USER=${3:-ubuntu}
REPO_DIR=${4:-/home/ubuntu/Agent-Tinder}

if [ -z "$HOST" ]; then
  echo "Usage: $0 <host> [ssh_key_path]" >&2
  exit 1
fi

SSH_OPTS="-o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$HOME/.ssh/known_hosts"

echo "Running remote fix on ${USER}@${HOST} using key ${KEY}"

ssh -i "$KEY" $SSH_OPTS ${USER}@${HOST} bash -s <<'REMOTE'
set -euo pipefail
cd /home/ubuntu/Agent-Tinder || cd /home/ubuntu/agent-tinder || exit 1
echo "Updating repo on remote..."
git fetch origin || true
git reset --hard origin/main || true

echo "Running fix script..."
if [ -f ops/scripts/fix_everything.sh ]; then
  sudo bash ops/scripts/fix_everything.sh
else
  echo "fix_everything.sh not found in repo on remote" >&2
  exit 1
fi

echo "Ensuring telegram detector timer is installed"
if [ -f ops/scripts/telegram_chat_detector.sh ]; then
  chmod +x ops/scripts/telegram_chat_detector.sh || true
  sudo cp -f ops/systemd/telegram-chat-detector.service /etc/systemd/system/ || true
  sudo cp -f ops/systemd/telegram-chat-detector.timer /etc/systemd/system/ || true
  sudo systemctl daemon-reload
  sudo systemctl enable --now telegram-chat-detector.timer || true
fi

echo "Status:"
sudo systemctl status tasks-worker --no-pager -n 10 || true
sudo systemctl status openclaw --no-pager -n 10 || true
sudo systemctl status telegram-chat-detector.timer --no-pager -n 10 || true
ls -l apps/backend/data/tasks.json || true
REMOTE

echo "Remote fix completed. Check the SSH output above for details." 
