#!/bin/bash
set -e

echo "========================================"
echo "OpenClaw Repository Access Fix Script"
echo "========================================"
echo ""

# Configuration
REPO_URL="https://github.com/yourusername/Agent-Tinder.git"  # Will auto-detect from existing clone
REPO_DIR="/home/ubuntu/Agent-Tinder"
OPENCLAW_DIR="/home/ubuntu/openclaw"
AGENT_FILE="$OPENCLAW_DIR/agent.py"

echo "[1/7] Checking current directory structure..."
ls -la /home/ubuntu/ | grep -E "Agent|openclaw|agenttinder" || echo "  No obvious repo directories found"
echo ""

echo "[2/7] Checking if Agent-Tinder repo exists..."
if [ -d "$REPO_DIR/.git" ]; then
    echo "  ✓ Repository found at $REPO_DIR"
    cd "$REPO_DIR"
    CURRENT_BRANCH=$(git branch --show-current)
    echo "  Current branch: $CURRENT_BRANCH"
    REPO_URL=$(git config --get remote.origin.url)
    echo "  Remote URL: $REPO_URL"
    
    echo ""
    echo "  Pulling latest changes..."
    git fetch origin
    git pull origin main || echo "  Note: Pull had conflicts or issues, continuing..."
else
    echo "  ✗ Repository not found at $REPO_DIR"
    
    # Check alternate locations
    if [ -d "/home/ubuntu/agenttinder/.git" ]; then
        REPO_DIR="/home/ubuntu/agenttinder"
        echo "  ✓ Found repo at alternate location: $REPO_DIR"
        cd "$REPO_DIR"
        REPO_URL=$(git config --get remote.origin.url)
    else
        echo "  Will clone repository..."
        
        # Try to get repo URL from agent.py or local clone
        if [ -d "/home/ubuntu/Agent-Tinder/.git" ]; then
            cd /home/ubuntu/Agent-Tinder
            REPO_URL=$(git config --get remote.origin.url)
            REPO_DIR="/home/ubuntu/Agent-Tinder"
        elif [ ! -z "$GITHUB_TOKEN" ]; then
            # If we have GitHub token in env, use it
            read -p "Enter your GitHub username: " GH_USER
            REPO_URL="https://${GITHUB_TOKEN}@github.com/${GH_USER}/Agent-Tinder.git"
            cd /home/ubuntu
            git clone "$REPO_URL" Agent-Tinder
            REPO_DIR="/home/ubuntu/Agent-Tinder"
        else
            echo ""
            echo "  ERROR: Cannot clone repository. Please either:"
            echo "    1. Set GITHUB_TOKEN environment variable, or"
            echo "    2. Manually clone the repo to $REPO_DIR"
            echo ""
            echo "  Example: git clone https://YOUR_TOKEN@github.com/yourusername/Agent-Tinder.git $REPO_DIR"
            exit 1
        fi
    fi
fi

echo ""
echo "[3/7] Checking OpenClaw agent.py..."
if [ -f "$AGENT_FILE" ]; then
    echo "  ✓ OpenClaw agent found at $AGENT_FILE"
    
    # Check what repo path it's using
    if grep -q "REPO_PATH\|repo_path\|workspace" "$AGENT_FILE"; then
        echo "  Current repo configuration:"
        grep -E "REPO_PATH|repo_path|workspace.*=" "$AGENT_FILE" | head -5 | sed 's/^/    /'
    fi
else
    echo "  ✗ OpenClaw agent.py not found at $AGENT_FILE"
    echo "  ERROR: OpenClaw agent is missing. Please check deployment."
    exit 1
fi

echo ""
echo "[4/7] Checking GitHub credentials..."
if [ ! -z "$GITHUB_TOKEN" ]; then
    echo "  ✓ GITHUB_TOKEN is set in environment"
else
    echo "  ⚠ GITHUB_TOKEN not found in current environment"
    
    # Check .env file
    if [ -f "$REPO_DIR/.env" ]; then
        if grep -q "GITHUB_TOKEN" "$REPO_DIR/.env"; then
            echo "  ✓ GITHUB_TOKEN found in $REPO_DIR/.env"
            source "$REPO_DIR/.env"
        fi
    fi
    
    if [ -f "/home/ubuntu/.env" ]; then
        if grep -q "GITHUB_TOKEN" "/home/ubuntu/.env"; then
            echo "  ✓ GITHUB_TOKEN found in /home/ubuntu/.env"
        fi
    fi
fi

# Configure git user if not set
if [ -z "$(git config --global user.email)" ]; then
    echo "  Setting git user config..."
    git config --global user.email "openclaw@agenttinder.local"
    git config --global user.name "OpenClaw Agent"
fi

echo ""
echo "[5/7] Updating OpenClaw agent.py with correct repo path..."
# Create backup
cp "$AGENT_FILE" "$AGENT_FILE.backup.$(date +%s)"

# Update the repo path in agent.py
if grep -q "REPO_PATH\s*=" "$AGENT_FILE"; then
    echo "  Updating existing REPO_PATH variable..."
    sed -i "s|REPO_PATH\s*=.*|REPO_PATH = '$REPO_DIR'|g" "$AGENT_FILE"
elif grep -q "repo_path\s*=" "$AGENT_FILE"; then
    echo "  Updating existing repo_path variable..."
    sed -i "s|repo_path\s*=.*|repo_path = '$REPO_DIR'|g" "$AGENT_FILE"
else
    echo "  Adding REPO_PATH configuration..."
    # Add after imports section
    sed -i "/^import\s/a\\
\\
# Repository configuration\\
REPO_PATH = '$REPO_DIR'\\
" "$AGENT_FILE"
fi

echo "  ✓ Updated agent.py"

echo ""
echo "[6/7] Verifying repository is accessible..."
cd "$REPO_DIR"
FILE_COUNT=$(find . -type f -name "*.js" -o -name "*.py" -o -name "*.ts" | wc -l)
echo "  Found $FILE_COUNT source files in repository"

if [ $FILE_COUNT -lt 5 ]; then
    echo "  ⚠ Warning: Very few files found. Repository may be incomplete."
fi

echo ""
echo "[7/7] Restarting OpenClaw service..."
sudo systemctl daemon-reload
sudo systemctl restart openclaw.service
sleep 2

if sudo systemctl is-active --quiet openclaw.service; then
    echo "  ✓ OpenClaw service is running"
else
    echo "  ✗ OpenClaw service failed to start"
    echo ""
    echo "  Recent logs:"
    sudo journalctl -u openclaw -n 20 --no-pager
    exit 1
fi

echo ""
echo "========================================"
echo "✅ Fix Complete!"
echo "========================================"
echo ""
echo "Repository: $REPO_DIR"
echo "OpenClaw agent: $AGENT_FILE"
echo ""
echo "Testing OpenClaw (this may take a few seconds)..."
sleep 3

# Test OpenClaw
TEST_RESPONSE=$(curl -s -X POST http://127.0.0.1:8080/process \
    -H "Content-Type: application/json" \
    -d '{"type":"plan","body":{"prompt":"list repository structure"}}' \
    || echo '{"error":"connection failed"}')

if echo "$TEST_RESPONSE" | grep -q "error.*No relevant files"; then
    echo "✗ OpenClaw still reporting 'No relevant files found'"
    echo ""
    echo "Debug info:"
    echo "  Check OpenClaw logs: sudo journalctl -u openclaw -n 50 --no-pager"
    echo "  Verify repo path in agent.py: grep REPO_PATH $AGENT_FILE"
elif echo "$TEST_RESPONSE" | grep -q "error"; then
    echo "⚠ OpenClaw returned error:"
    echo "$TEST_RESPONSE" | head -c 500
    echo ""
    echo "Check logs: sudo journalctl -u openclaw -n 50 --no-pager"
else
    echo "✅ OpenClaw is responding!"
    echo ""
    echo "Response preview:"
    echo "$TEST_RESPONSE" | head -c 300
    echo ""
fi

echo ""
echo "Next steps:"
echo "  1. Try sending a Telegram message: 'plan a test PR'"
echo "  2. Check OpenClaw logs: sudo journalctl -u openclaw -f"
echo "  3. Check tasks worker logs: sudo journalctl -u tasks-worker -f"
echo ""
