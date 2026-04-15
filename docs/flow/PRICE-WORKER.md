# Price Worker

> Continuous token price fetching from Jupiter, stored in PostgreSQL for portfolio valuation, TVL computation, and vault share pricing.

The price worker is a **standalone process** (not embedded in the Fastify app) that runs on a cron schedule to fetch USD prices for all tracked tokens. It writes to the `TokenPrice` table, which is consumed by the TVL service, share price computation, rebalancer, and portfolio charts.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  PRICE WORKER (single auto-scaling process)                      │
│                                                                  │
│  Entrypoint: apps/back/src/workers/price-worker.ts               │
│  Script:     pnpm --filter @repo/back start:price-worker         │
│                                                                  │
│  1. Query active vault allocations + holdings → list of mints    │
│  2. Split into batches of PRICE_BATCH_SIZE (default: 50)         │
│  3. Distribute batches round-robin across API keys               │
│  4. Fire concurrently through token-bucket rate limiters         │
│  5. USDC hardcoded to $1.00                                      │
│  6. Bulk insert ALL prices with shared timestamp                 │
│                                                                  │
│  Schedule: CRON_FETCH_PRICES (default: every minute)             │
│  Overlap guard: skips cycle if previous still running            │
└──────────────┬───────────────────────────────────────────────────┘
               │
               │  GET https://api.jup.ag/price/v3?ids=<50 mints>
               │  Concurrent requests, rate-limited per key
               ▼
┌──────────────────────────────────────────────────────────────────┐
│  JUPITER PRICE API v3 (one or more accounts)                     │
│                                                                  │
│  Key 1 ──→ rate limiter (JUPITER_RPM/min) ──→ batches 0,4,8…   │
│  Key 2 ──→ rate limiter (JUPITER_RPM/min) ──→ batches 1,5,9…   │
│  Key 3 ──→ rate limiter (JUPITER_RPM/min) ──→ batches 2,6,10…  │
│  Key N ──→ rate limiter (JUPITER_RPM/min) ──→ batches 3,7,11…  │
│                                                                  │
│  Effective throughput: N keys × JUPITER_RPM req/min              │
└──────────────┬───────────────────────────────────────────────────┘
               │
               │  Bulk insert (all prices, shared timestamp)
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
| 1 | Query mints | Collect unique mints from `SnapshotAllocation` (active vaults) + `SnapshotHolding` (current holdings) + always include USDC |
| 2 | Hardcode USDC | Set `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` → $1.00 |
| 3 | Split into batches | Groups of `PRICE_BATCH_SIZE` mints (default: 50, Jupiter max) |
| 4 | Distribute batches | Round-robin across API keys (batch 0 → key 0, batch 1 → key 1, …) |
| 5 | Fetch concurrently | Up to `PRICE_CONCURRENCY` in-flight requests, rate-limited per key |
| 6 | Bulk insert | All prices written with a single shared timestamp via `createMany()` |
| 7 | Log summary | `pricesFetched`, `pricesStored`, `elapsedMs`, key/concurrency metadata |

### Overlap Guard

If a cycle takes longer than the cron interval, the next scheduled run is skipped with a warning log. No overlapping fetches.

## Multi-Account Scaling

Rate limits are **per Jupiter account** (not per API key or per IP). Multiple keys from the same account share one pool. To increase throughput, use keys from **different accounts**.

```
JUPITER_API_KEYS="acct1_key,acct2_key,acct3_key,acct4_key"
JUPITER_RPM=55
→ Effective: 220 RPM (4 × 55)
```

No VPN needed — Jupiter does not rate-limit by IP.

### Performance Projections (Free Tier — 60 RPM per account, 50 mints/batch)

| Tokens | Batches | 1 account | 2 accounts | 4 accounts |
|--------|---------|-----------|------------|------------|
| 4,500 | 90 | ~98s | ~49s | ~25s |
| 10,000 | 200 | ~218s | ~109s | ~55s |
| 20,000 | 400 | ~436s | ~218s | ~109s |

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

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JUPITER_API_KEY` | Yes | — | Jupiter Price API v3 key (used when `JUPITER_API_KEYS` not set) |
| `JUPITER_API_KEYS` | No | — | Comma-separated keys from **different** Jupiter accounts for higher throughput |
| `JUPITER_RPM` | No | `55` | Requests per minute **per key** (free: 55, Pro I: 550) |
| `PRICE_CONCURRENCY` | No | `10` | Max concurrent in-flight Jupiter requests |
| `PRICE_BATCH_SIZE` | No | `50` | Mints per Jupiter API call (Jupiter max is 50) |
| `BIRDEYE_API_KEY` | Yes | — | Birdeye API key (fallback pricing + historical data) |
| `CRON_FETCH_PRICES` | No | `* * * * *` | Cron schedule for price fetch cycle |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |

These are registered in `turbo.json` under `globalEnv`.

## Database Models

### Token

Stores token metadata. The worker queries only mints that appear in active vault allocations (`SnapshotAllocation`) or current holdings (`SnapshotHolding`), plus USDC. This avoids pricing unused tokens.

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

Stores point-in-time USD prices. One row per price fetch per token. All prices from one cycle share the same `date` timestamp.

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | CUID primary key |
| `tokenId` | String | FK → Token |
| `usdPrice` | Float | USD price at fetch time |
| `date` | DateTime | Shared timestamp for entire cycle |

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
| `apps/back/src/workers/price-worker.ts` | Standalone worker — concurrent fetch, bulk insert, overlap guard |
| `apps/back/src/utils/rate-limiter.ts` | Token-bucket rate limiter + semaphore for concurrency |
| `apps/back/src/services/live-price.service.ts` | Jupiter + Birdeye on-demand fetching (used by TVL, rebalancer) |
| `apps/back/src/services/token-price.service.ts` | Seeds USDC at $1.00 in DB |
| `apps/back/src/cron/fetch-prices.ts` | Cron entry point in main Fastify app |
| `apps/back/src/store/token-price.repository.ts` | DB operations — bulk insert, latest price map, history |
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
# Single account (uses JUPITER_API_KEY)
pnpm --filter @repo/back start:price-worker

# Multiple accounts (4x throughput)
JUPITER_API_KEYS="key1,key2,key3,key4" pnpm --filter @repo/back start:price-worker

# Pro tier with higher RPM
JUPITER_RPM=550 pnpm --filter @repo/back start:price-worker
```

The worker also runs embedded in the main app via `CRON_FETCH_PRICES` cron (for vault share pricing only).

## Key Design Decisions

1. **Single auto-scaling process** — No manual multi-instance deployment. One process handles all tokens using concurrent fetching with rate limiters. Scale by adding API keys from different Jupiter accounts.

2. **Token-bucket rate limiter per key** — Each API key gets its own rate limiter at `JUPITER_RPM`. Batches are distributed round-robin across keys. Effective throughput = N keys × RPM.

3. **Bulk insert with shared timestamp** — All prices from one cycle are inserted via `createMany()` with the same `date` value. This ensures all tokens have entries at approximately the same time.

4. **Overlap guard** — If a cycle exceeds the cron interval, the next scheduled run is skipped. No overlapping fetches.

5. **Batch size of 50** — Jupiter Price API v3 accepts max 50 mint addresses per request.

6. **USDC hardcoded to $1.00** — USDC is the base stablecoin for all vault operations. Hardcoding avoids unnecessary API calls and prevents stale pricing from affecting TVL calculations.

7. **Vault tokens priced separately** — Vault share tokens derive their price from on-chain TVL (NAV = TVL / supply), not from market data. This is computed in the main app's cron job, not the standalone worker.

8. **Jupiter rate limits are per account, not per IP** — Multiple accounts from the same server work fine. No VPN needed.
