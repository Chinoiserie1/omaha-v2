# Autopilot

AI-powered KOL (Key Opinion Leader) trading pipeline on Solana. Fetches tweets, classifies them with Claude AI, generates portfolio allocations, and rebalances on-chain vaults via GLAM SDK.

## Tech Stack

| Layer           | Technology            | Version  |
| --------------- | --------------------- | -------- |
| Monorepo        | Turborepo             | 2.7.x    |
| Package Manager | pnpm                  | 9.15.0   |
| Web Frontend    | Next.js               | 15.x     |
| Mobile          | Expo / React Native   | SDK 52   |
| Backend         | Fastify               | 5.x      |
| Database        | PostgreSQL + Prisma   | 16 / 6.x |
| Validation      | Zod                   | 3.x      |
| AI              | Anthropic Claude      | Latest   |
| Blockchain      | Solana + GLAM SDK     | 1.98.x   |
| Auth            | Privy                 | Latest   |
| Language        | TypeScript (ESM only) | 5.7.x    |

## Project Structure

```
autopilot/
├── apps/
│   ├── web/           # Next.js 15 web app (port 3000)
│   ├── back/          # Fastify 5 REST API (port 3001)
│   └── native/        # Expo SDK 52 mobile app
├── packages/
│   ├── shared/        # Shared types, DTOs, Zod schemas
│   ├── database/      # Prisma ORM setup, schema, client
│   ├── config-eslint/ # Shared ESLint 9 flat configs
│   └── config-typescript/ # Shared TypeScript configs
├── turbo.json         # Turborepo pipeline config
├── docker-compose.yml # PostgreSQL container
└── package.json       # Root scripts (single source of truth)
```

## Prerequisites

- **Node.js 20+** — use `nvm use` (reads `.nvmrc`)
- **pnpm 9.15.0** — `corepack enable && corepack prepare pnpm@9.15.0 --activate`
- **Docker** — for local PostgreSQL database

### API Keys (required for full functionality)

| Key                        | Purpose                        |
| -------------------------- | ------------------------------ |
| `RAPIDAPI_KEY`             | Twitter data via RapidAPI      |
| `ANTHROPIC_API_KEY`        | Claude AI tweet classification |
| `EXPO_PUBLIC_PRIVY_APP_ID` | Privy authentication           |
| `PRIVY_APP_SECRET`         | Privy server-side auth         |
| `SOLANA_RPC_URL`           | Solana RPC endpoint (optional) |
| `JUPITER_API_KEY`          | Jupiter swap API (optional)    |

## Quick Start

```bash
# 1. Clone and install
git clone <repository-url>
cd autopilot
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start database
pnpm db:up

# 4. Run migrations and generate Prisma client
pnpm db:generate
pnpm db:migrate

# 5. Start all apps in development
pnpm dev
```

After startup:

- Web app: http://localhost:3000
- Backend API: http://localhost:3001
- Prisma Studio: `pnpm db:studio` (port 5555)

## Development Commands

> **All commands must be run from the repository root.** Never `cd` into `apps/` or `packages/`.

### All Apps

```bash
pnpm dev            # Start all apps in dev mode
pnpm build          # Build all apps and packages
pnpm lint           # Lint all packages
pnpm typecheck      # Type check all packages
pnpm test           # Run tests
pnpm clean          # Clean all build artifacts
```

### Specific Apps

```bash
pnpm dev:web        # Web app only (port 3000)
pnpm dev:back       # Backend API only (port 3001)
pnpm dev:native     # Expo native app only
```

### Database

```bash
pnpm db:up          # Start PostgreSQL container
pnpm db:down        # Stop PostgreSQL container
pnpm db:generate    # Generate Prisma client (run after schema changes)
pnpm db:migrate     # Run database migrations
pnpm db:push        # Push schema without migration (dev only)
pnpm db:studio      # Open Prisma Studio GUI
```

### KOL Pipeline

```bash
pnpm seed:kols      # Seed KOL data into database
pnpm sync-tokens    # Sync tradeable tokens from Jupiter
pnpm create-vault   # Create Solana vaults for KOLs
pnpm seed-vaults    # Seed vault data
```

## Architecture

### KOL Trading Pipeline

The backend runs an automated pipeline via cron jobs:

```
1. Fetch Tweets       →  Twitter RapidAPI fetches KOL tweets
2. AI Classification  →  Claude AI classifies tweets (sentiment, assets, category)
3. Portfolio Gen      →  Algorithm generates portfolio snapshots from signals
4. Vault Rebalance    →  Jupiter swaps execute via GLAM SDK on Solana
```

**Cron schedules** (configurable via `.env`):

| Job              | Default Schedule | Env Variable            |
| ---------------- | ---------------- | ----------------------- |
| Fetch tweets     | Every 15 min     | `CRON_FETCH_TWEETS`     |
| Run algorithm    | Every 30 min     | `CRON_RUN_ALGO`         |
| Rebalance vaults | Every 6 hours    | `CRON_REBALANCE_VAULTS` |

### Database Models

- **User** — Privy-authenticated users
- **Kol** — Key Opinion Leaders (twitter accounts)
- **Tweet** — Raw tweets with engagement metrics
- **ClassifiedTweet** — AI-classified tweets (sentiment, assets, category)
- **PortfolioSnapshot** — Generated portfolio allocations
- **KolVault** — Solana vaults (GLAM) linked to KOLs
- **RebalanceEvent** — Vault rebalancing history
- **TradeableAsset** — Supported tokens (symbol, mint, decimals)

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database (matches docker-compose.yml defaults)
DATABASE_URL="postgresql://user:password@localhost:5456/autopilot"
NODE_ENV=development

# Privy Authentication
EXPO_PUBLIC_PRIVY_APP_ID="your-privy-app-id"
EXPO_PUBLIC_PRIVY_CLIENT_ID="your-privy-client-id"
PRIVY_APP_SECRET="your-privy-app-secret"

# Twitter (RapidAPI)
RAPIDAPI_KEY=
RAPIDAPI_HOST=twitter241.p.rapidapi.com
FETCH_DELAY_MS=1500

# AI (Anthropic)
ANTHROPIC_API_KEY=

# Solana (optional)
SOLANA_RPC_URL=
KEEPER_PRIVATE_KEY=
GLAM_PROGRAM_ID=GLAMpaME8wdTEzxtiYEAa5yD8fZbxZiz2hNtV58RZiEz

# Jupiter
JUPITER_API_KEY=

# Rebalancing
REBALANCE_DRY_RUN=true
MAX_PRICE_IMPACT_BPS=100
MIN_SWAP_USD=5
MAX_SWAP_EQUITY_PCT=25
SNAPSHOT_STALENESS_H=24

# Cron Schedules
CRON_FETCH_TWEETS="*/15 * * * *"
CRON_RUN_ALGO="*/30 * * * *"
CRON_REBALANCE_VAULTS="0 */6 * * *"
```

## Contributing

### Code Style

- ESLint 9 with flat config
- Strict TypeScript — no `any` types
- ESM only (`"type": "module"`) — no CommonJS
- Consistent type imports: `import type { X } from "y"`

### Shared Code

Types, DTOs, and Zod schemas live in `packages/shared`:

```typescript
import { createUserSchema, type CreateUserDto, type User } from "@repo/shared";
```

Database client from `packages/database`:

```typescript
import { prisma, type User } from "@repo/database";
```

### PR Strategy

1. Keep your branch up to date: `git pull origin main --rebase`
2. Force push safely: `git push --force-with-lease`
3. Always use **Squash and merge** when merging PRs

### Adding Dependencies

Internal packages use the workspace protocol:

```json
{
  "dependencies": {
    "@repo/shared": "workspace:*",
    "@repo/database": "workspace:*"
  }
}
```

### Database Schema Changes

1. Modify `packages/database/prisma/schema.prisma`
2. Run `pnpm db:migrate` (creates migration file)
3. Run `pnpm db:generate` (regenerates Prisma client)
