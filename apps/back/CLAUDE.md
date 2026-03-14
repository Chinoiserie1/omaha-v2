# CLAUDE.md — apps/back

> This file is the entry point for Claude Code working on the back-end.
> Read this FIRST, then read the linked docs before touching the relevant area.

## Golden Rules

1. **Optimize for accuracy over speed.** Never guess values, addresses, or formats. If unsure, ask Nadar.
2. **Never send 4000+ Jupiter tokens to an LLM prompt.** The curated asset list exists for a reason. See `docs/ASSET-PIPELINE.md`.
3. **Never arbitrarily add or remove tickers.** `curated-assets.ts` is a DERIVED file — its contents come from alias targets + mint lookups + stock dedup. See `docs/ASSET-PIPELINE.md` for inclusion criteria and source of truth. If a token is tradeable on Jupiter and is an alias target, it belongs in the curated list. No subjective filtering.
4. **One-time fixes must be removed after use.** No temporary workarounds in the codebase.
5. **Always include `prisma migrate deploy`** in the build script of `package.json`.
6. **Use cron jobs, not infinite loops.** 1-service architecture with embedded node-cron.
7. **Never assume zero fees for custom vaults.** Always explicitly set fee params.
8. **Crypto markets are 24/7/365.** Every calendar date should have a price. Never assume weekend/holiday gaps in price data. If a date is missing, it's genuinely missing data that needs fetching — not a market closure.

## Architecture Overview

Read `docs/DATA-PIPELINE.md` for the full system flow diagram.

Quick summary: Tweets → Classify → Thesis → Rebalance → Swap

```
CRON_FETCH_TWEETS  →  Twitter API  →  Tweet table (per Quant)
CRON_RUN_ALGO      →  Classify (LLM) + Thesis (LLM)  →  PortfolioSnapshot (per Quant)
CRON_REBALANCE     →  Delta computation  →  Jupiter swaps via Execute CPI (per Vault)
CRON_FETCH_PRICES  →  Birdeye/Jupiter  →  TokenPrice table
```

## Key Documentation

| Doc                                                    | What it covers                                                                                  | Read before touching...                                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `docs/ASSET-PIPELINE.md`                               | Two-tier asset system (aliases vs curated), stock deduplication logic, how to add/remove assets | `curated-assets.ts`, `asset-aliases.json`, `sync-asset-aliases.ts`, `classifier.service.ts`, `thesis.service.ts` |
| `docs/DATA-PIPELINE.md`                                | Full data flow from tweet ingestion to vault rebalancing, every cron job, every service         | Any cron job, any service file                                                                                   |
| `docs/backtest.md`                                     | Backtest pipeline, snapshot lifecycle (cold start → retroactive weekly snapshots → incremental) | `thesis.service.ts`, `backtest.service.ts`                                                                       |
| [`docs/flow/FUND-SOL.md`](../../docs/flow/FUND-SOL.md) | USDC → SOL swap flow for transaction fees: API, services, tx builder, mobile UI                 | `fund-sol.service.ts`, `fund-sol-tx.builder.ts`, `solana/config.ts`, native fund-sol components                  |
| `docs/STATE-OF-RWA-ON-SOL.md`                          | Tokenized stocks on Solana: xStocks vs Ondo, tradability, liquidity, why Ondo is disabled       | `curated-assets.ts`, `seed-stock-tokens.ts`, `rebalancer.service.ts`                                             |
| `docs/JUPITER-API.md`                                  | Jupiter API endpoints, auth, token providers (xStocks vs Ondo), tradability rules, liquidity    | `jupiter-swap.service.ts`, `jupiter.service.ts`, `compare-liquidity.ts`, `rebalancer.service.ts`                 |
| `docs/LST-HANDLING.md`                                 | LST equivalence groups, double-counting prevention, synthesis pipeline steps                    | `asset-groups.ts`, `thesis.service.ts`                                                                           |
| `docs/Quant_thesis_algo.md`                            | Algorithm design intent: why LLM, rolling thesis model, classification schema, conviction decay | `classifier.service.ts`, `thesis.service.ts`, `backtest.service.ts`                                              |

## Tech Stack

- **Runtime**: Node.js + TypeScript (ESM)
- **Framework**: Fastify
- **DB**: PostgreSQL via Prisma ORM
- **Scheduling**: node-cron (embedded, not separate Railway services)
- **LLM**: Claude Haiku via Anthropic API
- **Blockchain**: Solana (web3.js, omaha-programs-sdk, Jupiter API)
- **Deploy**: Railway (single service)

## File Layout

```
src/
├── cron/           # Cron job entry points (thin wrappers calling services)
├── data/           # Static data files
│   ├── curated-assets.ts    # ~155 assets the thesis LLM can invest in
│   └── asset-aliases.json   # ~500 aliases for classifier normalization
├── infra/          # Infrastructure (WebSocket, queues)
│   └── websocket.ts         # WebSocket server + notifyUser broadcast
├── scripts/        # One-off scripts (seed, sync, debug)
├── services/       # Business logic
│   ├── classifier.service.ts   # Tweet classification (uses aliases)
│   ├── thesis.service.ts       # Portfolio synthesis (uses curated assets)
│   ├── rebalancer.service.ts   # Vault rebalancing (uses Jupiter tradeableAssets)
│   ├── withdrawal.service.ts   # Multi-step withdrawal flow (triggers WS notifications)
│   ├── fund-sol.service.ts     # Jupiter quote + swap plan builder for USDC → SOL
│   ├── fund-sol-tx.builder.ts  # Transaction builder with fee payer partial sign
│   └── jupiter-instruction.util.ts  # Shared Jupiter instruction deserializer
├── store/          # Prisma repository layer
├── solana/         # On-chain interaction (vault program, Jupiter swaps)
└── utils/          # Shared utilities (logger, LLM client, env)
```

## Common Tasks

### Adding a new Quant

Create a placeholder User + Quant record. The algo picks them up automatically on next cron run.

### Adding a new asset

See `docs/ASSET-PIPELINE.md` § "How to Add an Asset". You need to update BOTH the aliases file AND curated-assets.ts.

### Running the algo for one Quant

```bash
set -a && source .env && set +a && pnpm --filter @repo/back exec tsx src/scripts/run-algo-one-quant.ts <username>
```

### Typecheck

```bash
pnpm --filter @repo/back typecheck
```

Note: Some pre-existing errors (ioredis, @fastify/websocket, bullmq types) are known.

## Reminders

- Update `FORNADAR.md` after changes.
- Update `README.md` when changes affect architecture, data sources, or constraints.
- Nadar deploys on Railway. Use env vars from `.env`.
- M2 MacBook with x86 Homebrew at `/usr/local` — use `arch -x86_64` for build issues.
- When creating vaults, always confirm token name/symbol with Nadar first.

## Configuration

### TypeScript

Extends `@repo/config-typescript/node.json` with:

- `module: "NodeNext"`
- `moduleResolution: "NodeNext"`
- `target: "ES2022"`
- Output to `dist/`

### ESLint

Uses `@repo/config-eslint/node` which includes:

- Node.js specific rules (eslint-plugin-n)
- TypeScript ESLint
- Console logging allowed for `info`, `warn`, `error`

## Key Services

- **TweetClassifier** - Analyzes tweets for sentiment, assets, and signals
- **ThesisService** - Generates portfolio allocations from classified tweets
- **BacktestService** - Runs historical portfolio simulations with real token prices
- **RebalancerService** - Executes on-chain vault swaps via Jupiter
- **TwitterService** - Fetches tweets via RapidAPI
- **PortfolioSnapshotService** - Captures portfolio value snapshots on-demand (March 2026)
- **WithdrawalService** - Manages user withdrawals with multi-step flow
- **FundSolService** - Gets Jupiter USDC→SOL quotes and builds swap plans with platform fees
- **FundSolTxBuilder** - Builds funded swap transactions with fee payer partial signing

## Key Repositories

- **QuantRepository** - Quant data access (with `algoEnabled` flag support)
- **TweetRepository** - Tweet storage & queries
- **VaultRepository** - Vault data & performance
- **PortfolioRepository** - Portfolio snapshots & history
- **PortfolioSnapshotRepository** - Historical portfolio values (March 2026)
- **PriceRepository** - Token pricing data
- **PerformanceRepository** - Vault performance metrics

## Cron Jobs

Scheduled tasks run from `src/cron/index.ts`:

| Job                   | Schedule         | Purpose                                        |
| --------------------- | ---------------- | ---------------------------------------------- |
| `fetch-tweets`        | Every 15 min     | Fetch new tweets for active Quants              |
| `run-algo`            | Every 30 min     | Classify tweets + generate theses              |
| `fetch-prices`        | Every 1 min      | Update token prices from Birdeye               |
| `rebalance-vaults`    | Every 6 hours    | Execute on-chain swaps                         |
| `snapshot-portfolios` | Every 6 hours    | Capture portfolio values for charts (Mar 2026) |
| `sync-profiles`       | Weekly (Sun 3am) | Refresh Quant Twitter profiles                  |
| `health-check`        | Every 6 hours    | Monitor API health                             |

## API Routes (Main Endpoints)

### Health Check

```
GET /health
Response: { status: "ok", timestamp: "2024-01-01T00:00:00.000Z" }
```

### Quant Management

| Method | Endpoint                                  | Description                                     |
| ------ | ----------------------------------------- | ----------------------------------------------- |
| GET    | `/api/quants`                             | List active Quants (supports `?all=true`)       |
| GET    | `/api/quants/:id`                         | Get Quant details with recent tweets            |
| POST   | `/api/quants/sync-profiles`               | Refresh all Quant Twitter profiles              |
| POST   | `/api/quants/:quantId/instant-run-algo`   | Trigger classify + thesis for one Quant         |
| GET    | `/api/quants/:id/tweets`                  | List tweets by Quant (paginated, date filter)   |
| GET    | `/api/quants/:id/tweets/significant`      | Significant tweets with impact scores           |
| GET    | `/api/quants/:id/threads/:conversationId` | Get tweet thread (context for classification)   |
| GET    | `/api/quants/:id/portfolio`               | Latest portfolio snapshot                       |
| GET    | `/api/quants/:id/portfolio/history`       | Portfolio history (paginated)                   |
| POST   | `/api/quants/:id/portfolio`               | Create manual portfolio snapshot                |
| GET    | `/api/quants/:id/backtest`                | Run backtest for Quant strategy                 |

### Wallet & User Data (March 2026)

| Method | Endpoint                               | Description                                |
| ------ | -------------------------------------- | ------------------------------------------ |
| GET    | `/api/wallet/balances/:address`        | User SPL token balances                    |
| GET    | `/api/wallet/portfolio/:address`       | User vault holdings summary                |
| GET    | `/api/wallet/:address/portfolio/chart` | Portfolio value history for chart          |
| GET    | `/api/wallet/:address/active-theses`   | Active investment theses from vaults       |
| GET    | `/api/profile/me`                      | Current user profile (Privy authenticated) |

### Vault Management

| Method | Endpoint                          | Description                                     |
| ------ | --------------------------------- | ----------------------------------------------- |
| GET    | `/api/vaults`                     | List vaults (with search, infinite scroll)      |
| GET    | `/api/vaults/:id`                 | Vault details + performance + holdings          |
| GET    | `/api/vaults/:id/performance`     | Vault returns (7d/30d/all-time)                 |
| GET    | `/api/vaults/:id/holdings`        | Current vault token holdings                    |
| POST   | `/api/vaults/:id/subscribe`       | Begin subscription (with on-chain confirmation) |
| POST   | `/api/vaults/:id/investor-status` | Check user's investor status                    |
| POST   | `/api/vaults/:id/redeem`          | Initiate redemption                             |

### Withdrawal Flow

| Method | Endpoint                                 | Description                                 |
| ------ | ---------------------------------------- | ------------------------------------------- |
| POST   | `/api/withdrawals/initiate`              | Start withdrawal request                    |
| POST   | `/api/withdrawals/:id/confirm-subscribe` | Confirm withdrawal subscription             |
| GET    | `/api/withdrawals/:id/claim`             | Claim withdrawn tokens (after batch window) |
| POST   | `/api/withdrawals/:id/confirm-claim`     | Finalize claim                              |

### WebSocket

| Protocol | Endpoint          | Description                         |
| -------- | ----------------- | ----------------------------------- |
| WS       | `/ws/withdrawals` | Real-time withdrawal status updates |

**Connection**: `ws://localhost:4001/ws/withdrawals?token=<privy_auth_token>`

**Authentication**: Privy token passed as `token` query parameter. Invalid tokens close the connection with code 4001.

**Heartbeat**: Server pings every 30 seconds to keep connections alive.

**Message format** (server → client):

```json
{ "event": "<event_name>", "data": { ... } }
```

**Events**:

| Event               | Status       | Triggered When               | Extra Fields        |
| ------------------- | ------------ | ---------------------------- | ------------------- |
| `withdrawal:status` | `PROCESSING` | Redeem tx confirmed on-chain | `redeemTxSignature` |
| `withdrawal:status` | `CLAIMABLE`  | Fulfill batch tx succeeded   | —                   |
| `withdrawal:status` | `CLAIMED`    | Claim tx confirmed on-chain  | `claimTxSignature`  |
| `withdrawal:status` | `FAILED`     | Fulfill batch failed         | `errorMessage`      |

All payloads include `withdrawalId`, `status`, and `timestamp`.

**Source files**:

- `src/infra/websocket.ts` — Server setup, connection tracking, `notifyUser()` broadcast
- `src/routes/withdrawals/handlers/confirm-redeem.ts` — Sends PROCESSING
- `src/routes/withdrawals/handlers/confirm-claim.ts` — Sends CLAIMED
- `src/services/withdrawal.service.ts` — Sends PROCESSING / FAILED

### Swap & Fund SOL

| Method | Endpoint             | Description                                                        |
| ------ | -------------------- | ------------------------------------------------------------------ |
| POST   | `/api/swap/fund-sol` | Swap USDC → SOL for gas fees (auth required, $1-$10 limit, 2% fee) |

**Fund SOL Details:**

- **Request**: `{ amountUsd: number (1-10), signerPublicKey: string }`
- **Response**: `{ success: true, data: { transaction: base64, quote: FundSolQuote } }`
- **Auth**: Requires valid Privy auth token
- **Fee**: Platform takes `FUND_SOL_FEE_PCT` (default 2%) from swap
- **Fee Payer**: Optional fee payer wallet (`FEE_PAYER_PRIVATE_KEY`) covers Solana tx fees

### Content Ingestion

| Method | Endpoint       | Description                                      |
| ------ | -------------- | ------------------------------------------------ |
| POST   | `/api/tweets`  | Ingest tweet from URL (auto-creates Quant)       |
| POST   | `/api/content` | Ingest external content (Telegram, Reddit, etc.) |

## Using Shared Packages

### Prisma Client

```typescript
import { prisma } from "@repo/database";

const users = await prisma.user.findMany();
```

### Zod Validation

```typescript
import { createUserSchema, type ApiResponse } from "@repo/shared";

const result = createUserSchema.safeParse(request.body);
if (!result.success) {
  return reply.status(400).send({
    success: false,
    error: result.error.errors.map((e) => e.message).join(", "),
  } satisfies ApiResponse<never>);
}
```

## Route Pattern

```typescript
import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/database";
import { someSchema, type ApiResponse } from "@repo/shared";

export async function myRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    // Validate query/params/body with Zod
    // Use Prisma for database operations
    // Return typed response
  });
}
```

## Error Handling

Use the `ApiResponse` type from `@repo/shared`:

```typescript
// Success
return { success: true, data: user } satisfies ApiResponse<User>;

// Error
return reply.status(400).send({
  success: false,
  error: "Validation failed",
} satisfies ApiResponse<never>);
```

## Environment Variables

### Core

- `PORT` - Server port (default: 3001)
- `HOST` - Server host (default: 0.0.0.0)
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment (development/production)

### Fund SOL (Swap USDC → SOL)

- `FEE_PAYER_PRIVATE_KEY` (optional) - Base64 or JSON array keypair for fee payer wallet
- `FUND_SOL_FEE_PCT` (optional, default: 2) - Platform fee percentage for fund-sol swaps

## Build Output

Production build generates:

- `dist/` - Compiled JavaScript (ESM)

Run with: `node dist/index.js`

## ESM Import Notes

When importing local files, use `.js` extension:

```typescript
import { buildApp } from "./app.js";
import { userRoutes } from "./routes/users.js";
```

## CORS

CORS is enabled for all origins in development:

```typescript
await app.register(cors, { origin: true });
```

## Logging

Fastify logger is configured:

- Development: `debug` level
- Production: `info` level

## Testing

(Add testing setup when implemented)

## Important Notes

- Uses tsx for development (fast TypeScript execution)
- ESM-only (no CommonJS)
- Prisma client must be generated before starting
- Database must be accessible via `DATABASE_URL`
