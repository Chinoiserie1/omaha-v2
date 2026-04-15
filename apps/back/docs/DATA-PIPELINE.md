# Data Pipeline

> Complete flow from tweet ingestion to vault rebalancing.
> Read this before modifying any cron job or service file.

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        RAILWAY (single service)                       │
│                                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ FETCH_TWEETS │  │  RUN_ALGO   │  │  REBALANCE  │  │FETCH_PRICES│ │
│  │  every 6h    │  │  every 30m  │  │  every 6h   │  │  every 1m  │ │
│  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │
│         │                 │                 │               │         │
│         ▼                 ▼                 ▼               ▼         │
│  ┌────────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────┐  │
│  │  Twitter    │  │  Classifier  │  │ Rebalancer │  │   Price    │  │
│  │  Service    │  │  + Thesis    │  │  Service   │  │  Service   │  │
│  │            │  │  Services    │  │            │  │            │  │
│  └──────┬─────┘  └──────┬───────┘  └──────┬─────┘  └─────┬──────┘  │
│         │                │                 │               │         │
│         ▼                ▼                 ▼               ▼         │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    PostgreSQL (Prisma ORM)                       │ │
│  │  Tweet │ ClassifiedTweet │ PortfolioSnapshot │ TokenPrice │ ... │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│         External APIs: Twitter241 (RapidAPI), Anthropic, Jupiter,     │
│                        Birdeye, GLAM SDK                              │
└──────────────────────────────────────────────────────────────────────┘
```

## Step-by-Step Pipeline

### Step 1: Tweet Fetching (`CRON_FETCH_TWEETS`)

**Schedule**: Every 6 hours (env `CRON_FETCH_TWEETS`)
**Entry**: `src/cron/fetch-tweets.ts` → `twitter.service.ts`

```
For each active KOL:
  1. Resolve Twitter username → rest_id (Twitter241 /user endpoint)
  2. Fetch latest 40 tweets (Twitter241 /user-tweets endpoint)
  3. Smart deduplication via lastTweetId — only process tweets newer than last fetch
  4. Store in Tweet table (tweetId, fullText, postedAt, conversationId, etc.)
  5. Thread detection: tweets with same conversationId are grouped
```

**Rate limiting**: Twitter241 RapidAPI has strict limits. Current issue: rate limited on first KOL, aborting entire batch. 17 KOLs, sequential processing.

**Tables written**: `Tweet`

### Step 2: Classification (`CRON_RUN_ALGO`, first phase)

**Schedule**: Every 30 minutes (env `CRON_RUN_ALGO`)
**Entry**: `src/cron/run-algo.ts` → `classifier.service.ts`

```
For each active KOL with algoEnabled:
  1. Find unclassified tweets for this KOL
  2. Group tweets by conversationId (threads classified as one unit)
  3. Batch into groups of 30
  4. Send each batch to Claude Haiku with CLASSIFICATION_SYSTEM_PROMPT
  5. LLM returns: { category, assets[], sentiment, conviction } per tweet
  6. normalizeAsset() resolves each asset name using asset-aliases.json
     Example: "nvidia" → lookup aliases → "NVDAx"
  7. Store in ClassifiedTweet table
```

**Categories**: `market_analysis`, `trade_signal`, `portfolio_update`, `macro_thesis`, `noise`
**Sentiment**: `bullish`, `bearish`, `neutral`
**Conviction**: `high`, `medium`, `low`

**Tables read**: `Tweet`, `asset-aliases.json` (static file)
**Tables written**: `ClassifiedTweet`

### Step 3: Thesis Synthesis (`CRON_RUN_ALGO`, second phase)

**Schedule**: Same cron as classification (runs immediately after)
**Entry**: `src/cron/run-algo.ts` → `thesis.service.ts`

```
For each active KOL:
  1. Load latest PortfolioSnapshot (if any)
  2. Load curated asset symbols from curated-assets.ts (~155 symbols)
     ⚠️  NOT the full Jupiter list (was 4,425 — that's the bug we fixed)
  3. If cold start (no previous snapshot):
     - Load ALL relevant classified tweets for this KOL
     - Prompt: "Build their investment thesis from scratch"
  4. If updating:
     - Load only classified tweets SINCE last snapshot
     - Prompt: "Here's current thesis + new tweets, update it"
  5. Send to Claude Haiku with thesis system prompt
  6. LLM returns: { thesisSummary, allocations[], changes[] }
     Each allocation: { asset, percentage, conviction, reasoning, since, lastSignal }
  7. Validate allocations sum to ~100%
  8. Resolve mint addresses from Jupiter tradeableAssets map
  9. Apply conviction decay (>30d: downgrade, >90d: stale)
  10. Store in PortfolioSnapshot table
  11. Compute tweet impact scores (non-fatal)
  12. Compute backtest performance (non-fatal)
```

**Direct allocation override**: If `useDirectAllocations: true` is set in the KOL's knowledge (via `PATCH /api/kols/:kolId/knowledge`), step 3 is replaced entirely — allocations are taken directly from the knowledge JSON, no LLM call is made. See `Quant_thesis_algo.md` § 11.

**Key detail**: The thesis is ROLLING — it persists until contradicted. No sliding time window. The LLM carries forward the previous thesis and only modifies based on new evidence.

**Cost**: ~$1.50/month (Haiku) for 10-17 KOLs at current tweet volume.

**Tables read**: `ClassifiedTweet`, `PortfolioSnapshot`, `Token`
**Tables written**: `PortfolioSnapshot`, `TweetImpact`, `BacktestPeriod`

### Step 4: Vault Rebalancing (`CRON_REBALANCE_VAULTS`)

**Schedule**: Every 6 hours (env `CRON_REBALANCE_VAULTS`)
**Entry**: `src/cron/rebalance-vaults.ts` → `rebalancer.service.ts`

```
For each KOL-vault pair:
  1. Load latest PortfolioSnapshot
  2. Check freshness — skip if snapshot is too stale
  3. Check if vault has Jupiter enabled
  4. Get current vault holdings (on-chain via GLAM SDK)
  5. Compute swap deltas:
     - For each target allocation: targetPct - currentPct = deltaPct
     - Skip small deltas (<1% or <MIN_SWAP_USD)
     - Identify positions to sell (current not in target, or overweight)
  6. Execute sells first (free up USDC), then buys
  7. Each swap: GLAM vault → Jupiter quote → sign & send transaction
  8. Store rebalance record with status
```

**DRY_RUN mode**: Configurable — logs deltas without executing swaps.

**Tables read**: `PortfolioSnapshot`, `Vault`, `Token`
**Tables written**: `RebalanceLog`, `VaultHolding`

### Step 5: Price Fetching

Token prices are fetched by two complementary systems:

**A) Standalone Price Worker** (`src/workers/price-worker.ts`)
- Runs as a separate process: `pnpm --filter @repo/back start:price-worker`
- Fetches all non-vault token prices from Jupiter Price API v3
- Supports multi-account scaling via `JUPITER_API_KEYS` (round-robin across keys)
- Concurrent batch fetching with token-bucket rate limiter per key
- Bulk inserts all prices with a shared timestamp
- See [`docs/flow/PRICE-WORKER.md`](../../docs/flow/PRICE-WORKER.md) for full architecture

**B) Main App Cron** (`CRON_FETCH_PRICES`)
- Schedule: Every minute (env `CRON_FETCH_PRICES`)
- Entry: `src/cron/fetch-prices.ts`
- Seeds USDC at $1.00 + computes vault share prices from on-chain TVL

```
  Standalone worker:
    1. Query all non-vault Token mints
    2. Batch fetch from Jupiter (50 mints/request, concurrent, rate-limited)
    3. Bulk insert into TokenPrice

  Main app cron:
    1. Seed USDC at $1.00
    2. Compute vault share prices (TVL / supply)
    3. Store vault share prices in TokenPrice
```

**Tables written**: `TokenPrice`

### Supporting Crons

| Cron | Schedule | Purpose |
|------|----------|---------|
| `SYNC_PROFILES` | Daily | Re-fetch KOL Twitter profile data (avatar, bio, followers) |
| `HEALTH_CHECK` | Every 5m | Verify system liveness, alert on failures |
| `RECOVERY_WITHDRAWALS` | Every 15m | Retry failed withdrawal transactions |

### WebSocket: Real-Time Withdrawal Notifications

**Endpoint**: `GET /ws/withdrawals?token=<privy_token>` (upgraded to WebSocket)
**Source**: `src/infra/websocket.ts`

The withdrawal flow uses WebSocket to push status updates to connected clients in real time, avoiding polling.

```
User initiates withdrawal
  │
  ├─ POST /api/withdrawals/initiate
  │
  ├─ POST /api/withdrawals/:id/confirm-redeem
  │     └─ WS event: { event: "withdrawal:status", data: { status: "PROCESSING" } }
  │
  ├─ Background worker processes fulfill batch
  │     ├─ Success → WS event: { status: "CLAIMABLE" }
  │     └─ Failure → WS event: { status: "FAILED" }
  │
  └─ POST /api/withdrawals/:id/confirm-claim
        └─ WS event: { status: "CLAIMED" }
```

**Connection management**: Server tracks connections per userId in a `Map<string, Set<WebSocket>>`. Multiple connections per user are supported (e.g., multiple browser tabs). Heartbeat pings every 30 seconds. Stale connections are cleaned up on close/error.

**Broadcast function**: `notifyUser(userId, event, data)` — sends JSON to all open sockets for a user. Called from withdrawal route handlers and the withdrawal service.

## Database Schema (Key Tables)

```
Quant
  ├── id, userId, isActive, algoEnabled
  └── knowledge (JSON), lastFetchedAt

Tweet
  ├── id, quantId, tweetId (Twitter ID), fullText, postedAt
  └── conversationId (for thread grouping), isRetweet, metrics

ClassifiedTweet
  ├── id, tweetId (FK)
  ├── category (market_analysis | trade_signal | portfolio_update | macro_thesis | noise)
  ├── assets[] (normalized symbols, e.g. ["NVDAx", "AAPLx"])
  ├── sentiment (bullish | bearish | neutral)
  └── conviction (high | medium | low)

PortfolioSnapshot
  ├── id, quantId, createdAt
  ├── thesisSummary (text)
  ├── changes[], sourceTweetIds[]
  └── allocationRows → SnapshotAllocation[]

SnapshotAllocation (relational child of PortfolioSnapshot)
  ├── id, snapshotId (FK), tokenId (FK → Token, optional)
  ├── asset (symbol), mint (on-chain address, nullable)
  ├── percentage, conviction, reasoning
  └── since, lastSignal

Vault
  ├── id, quantId, statePda, vaultName, vaultSymbol
  ├── isActive, dryRun
  └── shareToken → Token (isVault=true)

HoldingsSnapshot
  ├── id, vaultId, totalEquityUsd
  ├── startDate, endDate (null = current)
  └── holdingRows → SnapshotHolding[]

SnapshotHolding (relational child of HoldingsSnapshot)
  ├── id, snapshotId (FK), tokenId (FK → Token, optional)
  ├── mint, symbol, uiAmount, price
  └── valueUsd, percentage

Token
  ├── mint (Solana address), symbol, name, decimals
  └── isActive, isVault, logoUri

TokenPrice
  ├── tokenId, usdPrice, date
  └── Indexed on (tokenId, date)
```

## External API Dependencies

| API | Used By | Purpose | Rate Limits |
|-----|---------|---------|-------------|
| Twitter241 (RapidAPI) | Tweet fetcher | Fetch KOL tweets | Strict — currently hitting limits |
| Anthropic (Claude Haiku) | Classifier + Thesis | LLM classification and synthesis | Standard API limits |
| Jupiter Token List | Asset sync | Verified token list + swap quotes | Public, generous |
| Jupiter Quote/Swap | Rebalancer | Execute token swaps | Per-request |
| Birdeye | Price service, asset sync | Token prices + trending tokens | API key required, rate limited |
| GLAM SDK | Rebalancer, vault monitoring | Vault operations (holdings, swaps) | On-chain (RPC limits) |

## Environment Variables

Key cron schedules (all node-cron format):
```
CRON_FETCH_TWEETS=*/15 * * * *       # Every 15 minutes
CRON_RUN_ALGO=*/30 * * * *           # Every 30 minutes
CRON_REBALANCE_VAULTS=0 */6 * * *    # Every 6 hours
CRON_FETCH_PRICES=* * * * *           # Every minute
CRON_SYNC_PROFILES=0 3 * * 0         # Weekly (Sun 3am)
CRON_HEALTH_CHECK=0 */6 * * *        # Every 6 hours
CRON_RECOVERY_WITHDRAWALS=*/5 * * * * # Every 5 minutes
CRON_SNAPSHOT_PORTFOLIOS=0 0 * * 0   # Weekly (Sun midnight)
```

## One-Off Scripts

### Backfill + Run Algo for All KOLs

Backfills historical tweets and runs the full algo (classify + synthesize thesis) for every active Twitter KOL. Processes KOLs sequentially so if interrupted, earlier KOLs are fully done.

```bash
# From repo root — load env then run
set -a && source .env && set +a && cd apps/back && npx tsx src/scripts/backfill-and-run-algo-all.ts

# Custom page count (default: 10)
npx tsx src/scripts/backfill-and-run-algo-all.ts 20

# Skip backfill (only classify + thesis on existing tweets)
npx tsx src/scripts/backfill-and-run-algo-all.ts --skip-backfill

# Skip algo (only backfill tweets, no classification/thesis)
npx tsx src/scripts/backfill-and-run-algo-all.ts --skip-algo
```

**How pages work**: The Twitter241 API requests 40 tweets per page, but after filtering out retweets and replies, each page yields ~15-21 original tweets. Pagination uses a cursor — each response includes a cursor to the next page of older tweets.

| Pages | Estimated tweets per KOL | Time per KOL |
|-------|--------------------------|--------------|
| 5     | ~80-100                  | ~2-3 min     |
| 10    | ~150-200                 | ~4-5 min     |
| 20    | ~300-400                 | ~8-10 min    |
| 50    | ~700-1000                | ~20-25 min   |

Total time scales with number of KOLs × pages. The algo phase (classify + thesis) adds ~1-2 min per KOL on top of backfill time.

**Error handling**: Errors are isolated per KOL (one failure doesn't stop the batch), except rate limits which abort immediately. A summary is printed at the end.

### Backfill Tweets for One KOL

```bash
set -a && source .env && set +a && cd apps/back && npx tsx src/scripts/backfill-tweets.ts <username> [maxPages]
```

### Run Algo for One KOL

```bash
set -a && source .env && set +a && cd apps/back && npx tsx src/scripts/run-algo-one-kol.ts <username>
```

## Failure Modes

| Failure | Impact | Recovery |
|---------|--------|----------|
| Twitter rate limit | No new tweets ingested | System retries next cron run. Thesis uses stale data. |
| LLM API down | No classifications or thesis updates | Skips KOL, retries next run. Existing snapshot persists. |
| Jupiter API down | Can't execute swaps | Rebalancer skips, retries next run. Positions unchanged. |
| Stale snapshot (>7d) | Rebalancer skips vault | Need new tweets → new classification → new thesis to unblock. |
| Invalid LLM output | Thesis rejected | Logged, skipped. Previous snapshot persists. |
