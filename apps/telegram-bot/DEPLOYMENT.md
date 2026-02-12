# Telegram Bot Deployment Feature

## Overview

The Telegram bot now supports **safe live deployments** with automatic PR/Deploy confirmation flow and conversation context tracking.

## Features

### 1. Smart PR/Deploy Confirmation

When you request a code change (e.g., "Add a new feature X"), the bot will:

- **Detect explicit deployment intent**: If your message includes "deploy", "go live", or "push to production", it deploys directly
- **Ask for confirmation otherwise**: Prompts you to choose between:
  - **PR** - Create a Pull Request for code review
  - **Deploy** - Deploy directly to production

### 2. Safe Deployment Process

When you choose "Deploy", the bot:

1. **Creates a safety tag** (format: `safety-pre-deploy-<timestamp>`)
2. **Pushes the tag** to remote for rollback safety
3. **Commits changes** with a descriptive message
4. **Pushes to main** branch
5. **SSH to EC2** and updates the code
6. **Restarts services** (backend, telegram-bot, openclaw)
7. **Reports service status** and provides rollback command

### 3. Conversation Context

The bot maintains conversation context for:
- Recent PRs created
- Pending deployment confirmations
- User creation flows
- Chat history for AI responses

## Environment Variables

Required for deployment functionality:

```bash
# Telegram & OpenAI
TELEGRAM_TOKEN=<your-telegram-bot-token>
TELEGRAM_ADMIN_IDS=<comma-separated-telegram-user-ids>
OPENAI_API_KEY=<your-openai-api-key>

# Backend & Services
BACKEND_API_URL=http://localhost:3001
OPENCLAW_API_URL=http://127.0.0.1:8080
ADMIN_API_KEY=<your-admin-api-key>

# GitHub
GITHUB_TOKEN=<your-github-token>
GITHUB_REPO=chetlursuneil-prog/Agent-Tinder

# EC2 Deployment (defaults provided)
EC2_HOST=16.171.1.185
EC2_USER=ubuntu
EC2_SSH_KEY_PATH=~/.ssh/agenttinder-key.pem
EC2_REPO_PATH=/home/ubuntu/Agent-Tinder
```

## Usage Examples

### Example 1: Explicit Deployment
```
User: Deploy a new login rate limiter to production
Bot: 🚀 Deploying: "Deploy a new login rate limiter..."
     [Creates code, pushes to main, deploys to EC2]
```

### Example 2: Confirmation Flow
```
User: Add email notifications for matches
Bot: 🔍 Task Detected: plan
     
     Request: "Add email notifications for matches"
     
     How would you like to proceed?
     • Reply "PR" - Create Pull Request for review
     • Reply "Deploy" - Deploy directly to production

User: Deploy
Bot: 🚀 Deploying live...
     [Proceeds with safe deployment]
```

### Example 3: Create PR
```
User: Build a dashboard for admin stats
Bot: [Shows PR/Deploy options]

User: PR
Bot: 📝 Creating PR...
     ✅ PR Created
     PR: #42
     Branch: feature/admin-dashboard
```

## Rollback

If a deployment causes issues, rollback using the safety tag:

```bash
# On local machine
git reset --hard safety-pre-deploy-<timestamp>
git push origin main --force

# On EC2 (via SSH)
cd /home/ubuntu/Agent-Tinder
git fetch --all
git reset --hard safety-pre-deploy-<timestamp>
sudo systemctl restart backend telegram-bot openclaw
```

Or use the Telegram bot:
```
User: Rollback to safety-pre-deploy-1770912345678
```

## Safety Features

1. **Safety tags**: Every deployment creates a timestamped tag before pushing
2. **Service status**: Deployment reports whether each service started successfully
3. **Conversation context**: Bot remembers what you asked for
4. **Error handling**: Failed deployments don't break the system
5. **Easy rollback**: Clear instructions provided after each deployment

## Testing

Test the bot without affecting production:

```bash
# Start bot locally
cd apps/telegram-bot
npm start

# In Telegram, send test message
"Add a test feature"
# Bot will ask: PR or Deploy?
# Reply "PR" to test PR creation
```

## Architecture

```
User Message
    ↓
Intent Detection (GPT-4)
    ↓
"task" category detected
    ↓
Check for explicit "deploy" keyword
    ↓
    ├─ Yes → Deploy directly
    └─ No  → Ask PR or Deploy?
              ↓
        User responds
              ↓
        ├─ "PR" → Create PR via OpenClaw
        └─ "Deploy" → Execute safe deployment
                        ↓
                  1. Create safety tag
                  2. Push tag
                  3. Commit & push to main
                  4. SSH to EC2
                  5. Git reset --hard origin/main
                  6. Restart services
                  7. Report status
```

## Monitoring

After deployment, check:

1. **Service status** (reported by bot)
2. **Backend logs**: `sudo journalctl -u backend -f`
3. **Telegram bot logs**: `sudo journalctl -u telegram-bot -f`
4. **Application**: Visit `http://<EC2_HOST>:3001/health`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "SSH deploy failed" | Check EC2_SSH_KEY_PATH and permissions (`chmod 600`) |
| "git push failed" | Ensure bot has write access to repo |
| Services not active | Check systemd logs: `sudo journalctl -u <service>` |
| Context lost | Bot restarts clear context; redeploy to EC2 for persistence |

## Future Enhancements

- [ ] Add deployment approval workflow for multiple admins
- [ ] Integration tests before deployment
- [ ] Automatic rollback on service failure
- [ ] Deployment history and statistics
- [ ] Slack/Discord integration
- [ ] Blue-green deployment support
