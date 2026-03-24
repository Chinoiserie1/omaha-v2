# Price Worker

> Continuous token price fetching from Jupiter and Birdeye, stored in PostgreSQL for portfolio valuation, TVL computation, and vault share pricing.

The price worker is a **standalone process** (not embedded in the Fastify app) that runs on a cron schedule to fetch USD prices for all tracked tokens. It writes to the `TokenPrice` table, which is consumed by the TVL service, share price computation, rebalancer, and portfolio charts.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  PRICE WORKER (standalone process)                              │
│                                                                 │
│  Entrypoint: apps/back/src/workers/price-worker.ts              │
│  Script:     pnpm --filter @repo/back start:price-worker        │
│                                                                 │
│  1. Query Token table (isVault=false) → list of mints           │
│  2. Filter mints by instance ID (round-robin sharding)          │
│  3. Batch mints in groups of 100                                │
│  4. Fetch from Jupiter Price API v3 (1.1s between batches)      │
│  5. USDC hardcoded to $1.00                                     │
│  6. Write prices to TokenPrice table                            │
│                                                                 │
│  Schedule: CRON_FETCH_PRICES (default: every minute)            │
│  Runs immediately on startup, then on cron                      │
└──────────────┬──────────────────────────────────────────────────┘
               │
               │  GET https://api.jup.ag/price/v3?ids=<mints>
               │  Header: x-api-key: JUPITER_API_KEY
               ▼
┌──────────────────────────────────┐
│  JUPITER PRICE API v3            │
│  Primary price source            │
│  Returns: { [mint]: usdPrice }   │
│  Rate limit: 60 req/min          │
└──────────────────────────────────┘
               │
               │  Prices stored
               ▼
┌──────────────────────────────────┐
│  POSTGRESQL                      │
│  TokenPrice table                │
│  { tokenId, usdPrice, date }    │
└──────────────┬───────────────────┘
               │
               │  Consumed by
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  DOWNSTREAM CONSUMERS                                            │
│                                                                  │
│  • TVL Service         — vault holdings valuation                │
│  • Share Price Service  — NAV computation (TVL / supply)         │
│  • Rebalancer          — delta calculation for swaps             │
│  • Portfolio Charts    — historical price lookups                │
│  • Vault Price Service — vault share token pricing (main app)    │
└──────────────────────────────────────────────────────────────────┘
```

## Price Fetch Cycle

Each cycle runs these steps:

| Step | Action | Details |
|------|--------|---------|
| 1 | Query mints | `SELECT mint FROM Token WHERE isVault = false` + always include USDC |
| 2 | Shard mints | `mints[i] % PRICE_TOTAL_INSTANCES === PRICE_INSTANCE_ID` |
| 3 | Hardcode USDC | Set `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` → $1.00 |
| 4 | Batch fetch | Groups of 100 mints per Jupiter API call |
| 5 | Rate limit | 1.1s delay between batches (stays under 60 req/min) |
| 6 | Store prices | Insert `TokenPrice` row per mint with current timestamp |
| 7 | Log summary | `pricesStored`, `elapsedMs`, instance metadata |

## Live Price Service

Separate from the worker, `live-price.service.ts` provides on-demand price fetching used by the TVL service, share price updater, and rebalancer. It uses a **two-source fallback**:

```
fetchLivePrices(mints)
├── USDC → hardcoded $1.00
├── Jupiter Price API v3 (primary)
│   └── All non-USDC mints in a single request
└── Birdeye multi-price API (fallback)
    └── Only mints Jupiter missed
```

This is called inline (not cached) when fresh prices are critical — e.g., during rebalancing or share price updates.

## Vault Share Token Pricing

Vault share tokens (`isVault=true`) are **not** priced by the worker. Instead, the main Fastify app computes them via the `CRON_FETCH_PRICES` cron job:

```
Cron (main app) → fetchAndStoreVaultPrices()
├── For each active vault:
│   ├── computeSharePrice(statePda)
│   │   ├── computeTvl() → sum of holdings × cached prices
│   │   └── NAV = TVL / total share supply
│   └── Store share token price in TokenPrice table
```

The on-chain share price is updated separately by `share-price-updater.service.ts` after each rebalance.

## Multi-Instance Scaling

The worker supports horizontal scaling via round-robin mint distribution:

```
Instance 0: mints[0], mints[3], mints[6], ...
Instance 1: mints[1], mints[4], mints[7], ...
Instance 2: mints[2], mints[5], mints[8], ...
```

Configure with:
- `PRICE_INSTANCE_ID` — This instance's index (0-based)
- `PRICE_TOTAL_INSTANCES` — Total number of instances

Single instance (default): `PRICE_INSTANCE_ID=0`, `PRICE_TOTAL_INSTANCES=1` — processes all mints.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JUPITER_API_KEY` | Yes | — | Jupiter Price API v3 authentication key |
| `BIRDEYE_API_KEY` | Yes | — | Birdeye API key (fallback pricing + historical data) |
| `CRON_FETCH_PRICES` | No | `* * * * *` | Cron schedule for price fetch cycle (every minute) |
| `PRICE_INSTANCE_ID` | No | `0` | This instance's ID for multi-instance sharding (0-indexed) |
| `PRICE_TOTAL_INSTANCES` | No | `1` | Total number of price worker instances |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (for TokenPrice writes) |

These are registered in `turbo.json` under `globalEnv`.

## Database Models

### Token

Stores token metadata. The worker queries all rows where `isVault = false` to get mints for pricing.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | CUID primary key |
| `mint` | String | On-chain mint address (unique) |
| `symbol` | String | Ticker symbol (unique) |
| `name` | String | Display name |
| `decimals` | Int | Token decimals |
| `isVault` | Boolean | `true` = vault share token (priced by TVL, not worker) |
| `isActive` | Boolean | Whether token is actively tracked |

### TokenPrice

Stores point-in-time USD prices. One row per price fetch per token.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | CUID primary key |
| `tokenId` | String | FK → Token |
| `usdPrice` | Float | USD price at fetch time |
| `date` | DateTime | Timestamp of price fetch |

Indexed on `(tokenId, date)` for efficient latest-price and history queries.

### TokenPriceDaily

Stores historical daily prices for backtesting (populated by `price.service.ts`, not the worker).

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | String | Token ticker |
| `date` | Date | Calendar date |
| `priceUsd` | Float | USD price |
| `source` | String | Data source (birdeye, yahoo) |

## Source Files

### Price Worker

| File | Responsibility |
|------|---------------|
| `apps/back/src/workers/price-worker.ts` | Standalone worker process — cron schedule, batch fetch, DB writes |
| `apps/back/src/services/live-price.service.ts` | Jupiter + Birdeye on-demand fetching (used by TVL, rebalancer) |
| `apps/back/src/services/token-price.service.ts` | Seeds USDC at $1.00 in DB |
| `apps/back/src/cron/fetch-prices.ts` | Cron entry point in main Fastify app |
| `apps/back/src/store/token-price.repository.ts` | DB operations — upsert, latest price map, history |
| `apps/back/src/utils/env.ts` | Environment variable validation (Zod schemas) |

### Vault Share Pricing

| File | Responsibility |
|------|---------------|
| `apps/back/src/services/vault-price.service.ts` | Computes and stores vault share token prices |
| `apps/back/src/services/share-price.service.ts` | NAV-based share price: TVL / total supply |
| `apps/back/src/services/share-price-updater.service.ts` | Updates share price on-chain after rebalance |
| `apps/back/src/services/tvl.service.ts` | Vault TVL from on-chain accounts + cached/live prices |

### Historical Prices (Backtesting)

| File | Responsibility |
|------|---------------|
| `apps/back/src/services/price.service.ts` | Birdeye OHLCV + Yahoo Finance daily prices |
| `apps/back/src/store/price.repository.ts` | Daily price upsert, date lookup, near-date fallback |

## Running the Worker

```bash
# Start the standalone price worker
pnpm --filter @repo/back start:price-worker

# Multi-instance example (3 instances)
PRICE_INSTANCE_ID=0 PRICE_TOTAL_INSTANCES=3 pnpm --filter @repo/back start:price-worker
PRICE_INSTANCE_ID=1 PRICE_TOTAL_INSTANCES=3 pnpm --filter @repo/back start:price-worker
PRICE_INSTANCE_ID=2 PRICE_TOTAL_INSTANCES=3 pnpm --filter @repo/back start:price-worker
```

The worker also runs embedded in the main app via `CRON_FETCH_PRICES` cron (for vault share pricing).

## Key Design Decisions

1. **Standalone process** — The price worker runs separately from the Fastify app to isolate price fetching from API request handling. This prevents slow Jupiter API calls from blocking HTTP responses.

2. **Jupiter primary, Birdeye fallback** — Jupiter is the primary DEX aggregator used for swaps, so its prices are most consistent with actual trade execution. Birdeye serves as fallback for tokens Jupiter doesn't price.

3. **Batch size of 100** — Jupiter Price API accepts comma-separated mint lists. Batching at 100 balances throughput with URL length limits and per-request latency.

4. **1.1s rate limit** — Jupiter enforces ~60 requests/minute. The 1.1s delay between batches stays safely under this limit while maximizing throughput.

5. **USDC hardcoded to $1.00** — USDC is the base stablecoin for all vault operations. Hardcoding avoids unnecessary API calls and prevents stale/inaccurate stablecoin pricing from affecting TVL calculations.

6. **Round-robin sharding** — Simple deterministic partitioning allows horizontal scaling without coordination. Each instance independently knows which mints to fetch based on its ID.

7. **Vault tokens priced separately** — Vault share tokens derive their price from on-chain TVL (NAV = TVL / supply), not from market data. This is computed in the main app's cron job, not the standalone worker.
