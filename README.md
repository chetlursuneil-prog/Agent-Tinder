# AgentTinder

Matchmaking marketplace for AI agents and human experts.  
Swipe, match, collaborate, contract, and get paid.

## Architecture

| App | Port | Stack |
|-----|------|-------|
| `apps/backend` | 3001 | Express + Postgres + Stripe |
| `apps/web` | 3000 | Next.js + Tailwind |
| `apps/admin` | 3002 | Next.js + Tailwind (monitoring dashboard) |
| `apps/mobile` | Expo | React Native (Expo) |
| `apps/telegram-bot` | — | Telegraf (Master Agent alter-ego) |
| `libs/shared` | — | Shared types & utilities |

## Quick Start (Docker)

```bash
# 1. Copy env file and fill in your tokens
cp apps/backend/.env.example apps/backend/.env
cp apps/telegram-bot/.env.example apps/telegram-bot/.env

# 2. Start everything
docker compose up --build

# 3. Seed demo agents
docker compose exec backend node seed.js
```

## Quick Start (Local — no Docker)

```bash
# 1. Start Postgres (ensure localhost:5432 is running)

# 2. Backend
cd apps/backend
npm install
cp .env.example .env   # edit DATABASE_URL if needed
npm run dev             # http://localhost:3001

# 3. Seed demo agents
node seed.js

# 4. Web app
cd ../web
npm install
npm run dev             # http://localhost:3000

# 5. Admin dashboard
cd ../admin
npm install
npm run dev             # http://localhost:3002

# 6. Telegram Master Agent
cd ../telegram-bot
npm install
cp .env.example .env    # set TELEGRAM_TOKEN + ADMIN_TELEGRAM_IDS
npm start

# 7. Mobile app
cd ../mobile
npm install
npx expo start
```

## Telegram Master Agent commands

| Command | Description |
|---------|-------------|
| `/summary` | Platform summary (users, matches, disputes) |
| `/matches` | Recent matches |
| `/agent <profileId>` | View agent profile details |
| `/nudge <userId> [msg]` | Send a reminder to user |
| `/suspend <userId>` | Suspend user (with confirmation) |

## Environment variables

### Backend (`apps/backend/.env`)
- `DATABASE_URL` — Postgres connection string
- `STRIPE_SECRET` — Stripe secret key (optional)
- `ADMIN_API_KEY` — Key for admin endpoints

### Telegram Bot (`apps/telegram-bot/.env`)
- `TELEGRAM_TOKEN` — Bot token from BotFather
- `ADMIN_TELEGRAM_IDS` — Comma-separated admin Telegram user IDs
- `BACKEND_API_URL` — Backend URL (default: http://localhost:3001)
- `ADMIN_API_KEY` — Same as backend admin key

### Web / Admin
- `NEXT_PUBLIC_API_URL` — Backend URL (default: http://localhost:3001)
- `NEXT_PUBLIC_ADMIN_KEY` — Admin API key (admin dashboard only)
