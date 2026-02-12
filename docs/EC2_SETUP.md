# EC2 Free Tier Setup — Exact Steps (Safe defaults)

This document contains copy/paste commands and exact options for launching and configuring a single Free Tier EC2 instance to host OpenClaw (localhost-only) and the Telegram bot.

Important safety summary:
- Instance type: t3.micro (or t2.micro for stricter Free Tier safety)
- AMI: Ubuntu Server 22.04 LTS
- Root disk: gp3, 20 GiB
- Security Group: SSH (22) only from YourIP/32. Do NOT open 0.0.0.0/0.
- OpenClaw must bind to 127.0.0.1 and NOT be exposed via Security Group.

## 1) Create instance (Console)
Use the EC2 Launch Instance wizard with these options:
- AMI: Ubuntu Server 22.04 LTS
- Instance type: t3.micro (or t2.micro)
- Key pair: create or use existing (download PEM)
- Network: default VPC
- Security group inbound rules: only SSH port 22, source = YOUR_IP/32
- Storage: gp3, 20 GiB

## 2) Add AWS Budget immediately
Console -> Billing -> Budgets -> Create budget
- Type: Cost budget, Monthly
- Budget amount: $1
- Alert: 50% ($0.50) -> send to your account email

## 3) Connect (example on Windows PowerShell)
```powershell
ssh -i "C:\path\to\your-key.pem" ubuntu@<EC2_PUBLIC_IP>
```

## 4) On the instance (run copy/paste blocks)

Update + base packages:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential python3 python3-venv python3-pip
```

Install Node.js LTS (20.x):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

Install GitHub CLI:
```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install -y gh
gh --version
```

Clone repo:
```bash
cd /home/ubuntu
git clone https://github.com/chetlursuneil-prog/Agent-Tinder.git agenttinder
cd agenttinder
git status
```

Run the included bootstrap script (it will create a safe OpenClaw stub and systemd units):
```bash
chmod +x /home/ubuntu/agenttinder/scripts/bootstrap-ec2.sh
./scripts/bootstrap-ec2.sh
```

Before starting the telegram bot service, create the `.env` file for the bot:
```bash
cat > /home/ubuntu/agenttinder/apps/telegram-bot/.env <<'EOF'
TELEGRAM_TOKEN=replace_with_token
ADMIN_TELEGRAM_IDS=123456789
OPENCLAW_API_URL=http://127.0.0.1:8080
BACKEND_API_URL=http://127.0.0.1:3001
ADMIN_API_KEY=replace_with_admin_key_if_used
EOF

Then start the bot service (if not already started by bootstrap):
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw.service
sudo systemctl enable --now telegram-bot.service
sudo systemctl status openclaw.service --no-pager
sudo systemctl status telegram-bot.service --no-pager
```

## 5) Verify local bindings and health
```bash
# OpenClaw should bind to 127.0.0.1:8080 only
ss -tlnp | grep 8080 || true

curl -sS http://127.0.0.1:8080/health
# expected: {"status":"ok","time":"..."}
```

## 6) GitHub CLI auth (for PR automation)
Run `gh auth login` and follow interactive prompts. Choose HTTPS and authenticate with a Personal Access Token
that has `repo` permissions (or use `gh auth login --with-token` and paste token). DO NOT store token in repo. Use GitHub Secrets for CI.

## 7) Billing safety checks (do this after launch)
- Verify instance type: `ec2 > Instances` (should be t3.micro or t2.micro)
- Verify root EBS volume ≤ 20 GiB
- Verify no other instances or ELBs exist in this account/region

## Common charge mistakes to avoid
- Creating NAT Gateway, Load Balancer, RDS, or additional EBS volumes
- Leaving multiple instances running
- Enabling detailed CloudWatch metrics with retention settings
- Using non-Free-Tier instance types

If you want, I can walk you through each SSH step in real time — tell me when you're connected and I will confirm outputs.
