# API & Scripts Curl Reference

## Context

Reference of all endpoints and scripts available to operate the platform — focused on data improvement operations (backfill, add KOL, trigger backtest, etc.).

Backend URL: `https://backend-fetch-data-production.up.railway.app` (prod) or `http://localhost:4001` (local).

---

## Data Improvement Operations (curl)

### Add a KOL's tweet (auto-creates KOL if new)
```bash
curl -X POST $API/api/tweets \
  -H "Content-Type: application/json" \
  -d '{"url": "https://x.com/username/status/1234567890"}'
```

### Ingest external content (non-Twitter sources)
```bash
curl -X POST $API/api/content \
  -H "Content-Type: application/json" \
  -d '{"kolId":"<kolId>","text":"...","source":"telegram"}'
```
- **kolId** or **kolUsername** — at least one required (KOL must already exist)
- **text** — required
- **source** — required, one of: `x`, `reddit`, `substack`, `blog`, `dm`, `telegram`, `discord`
- **sourceUrl** — optional URL to the original content
- **postedAt** — optional ISO date, defaults to now

Returns 201 with the created record. The record enters the classification + thesis pipeline automatically.

### Sync all KOL Twitter profiles (avatar, bio, followers)
```bash
curl -X POST $API/api/kols/sync-profiles
```

### Create a manual portfolio snapshot
```bash
curl -X POST $API/api/kols/<kolId>/portfolio \
  -H "Content-Type: application/json" \
  -d '{"thesisSummary":"...","allocations":[{"asset":"SOL","percentage":60},{"asset":"USDC","percentage":40}],"changes":["manual entry"]}'
```

### Run backtest for a KOL
```bash
curl $API/api/kols/<kolId>/backtest
```

### Force snapshot vault on-chain holdings
```bash
curl -X POST $API/api/vaults/<vaultId>/holdings/snapshot
```

---

## Read-Only Endpoints (curl)

### List all active KOLs
```bash
curl $API/api/kols               # active only (default)
curl "$API/api/kols?all=true"    # include inactive
```

### Get single KOL (with last 50 tweets)
```bash
curl $API/api/kols/<kolId>
```

### List KOL tweets (paginated, with date filter)
```bash
curl "$API/api/kols/<kolId>/tweets?limit=50&offset=0&from=2026-02-01&to=2026-02-28"
```

### List significant tweets with impact scores
```bash
curl "$API/api/kols/<kolId>/tweets/significant?limit=20&minScore=0.5"
```

### Get tweet thread
```bash
curl $API/api/kols/<kolId>/threads/<conversationId>
```

### Get latest portfolio snapshot
```bash
curl $API/api/kols/<kolId>/portfolio
```

### Get portfolio history
```bash
curl "$API/api/kols/<kolId>/portfolio/history?limit=50"
```

### List vaults
```bash
curl $API/api/vaults
```

### Get vault details / performance / holdings
```bash
curl $API/api/vaults/<id>
curl "$API/api/vaults/<id>/performance?period=7d"
curl $API/api/vaults/<id>/holdings
```

### Wallet balances
```bash
curl $API/api/wallet/balances/<solanaAddress>
curl $API/api/wallet/portfolio/<solanaAddress>
```

### Health check
```bash
curl $API/health
```

---

## CLI Scripts (run from repo root)

### Backfill tweets for a KOL (historical data)
```bash
source .env && export DATABASE_URL
pnpm --filter @repo/back exec tsx src/scripts/backfill-tweets.ts <username> [maxPages]
# maxPages defaults to 5 (~200 tweets). Each page = ~40 tweets.
# KOL must have a restId (run sync-profiles first)
```

### Seed KOLs (hardcoded list of 19)
```bash
pnpm --filter @repo/back seed:kols
```

### Seed vaults
```bash
pnpm --filter @repo/back seed-vaults
```

### Create on-chain vault for a KOL
```bash
pnpm --filter @repo/back create-vault <username> [--name "..."] [--description "..."] [--dry-run=false]
```

### Sync Jupiter token list
```bash
pnpm --filter @repo/back sync-tokens
```

### Run classification + thesis for one KOL
```bash
source .env && export DATABASE_URL
pnpm --filter @repo/back exec tsx src/scripts/run-algo-one-kol.ts <username>
```

### Reset thread classifications (for re-classification)
```bash
source .env && export DATABASE_URL
pnpm --filter @repo/back exec tsx src/scripts/reset-thread-classifications.ts [username] [maxThreads]
```

### Test thread detection for a KOL
```bash
source .env && export DATABASE_URL
pnpm --filter @repo/back exec tsx src/scripts/test-thread-sync.ts <username>
```

---

## Cron Jobs (auto-run on server)

| Job | Default Schedule | What it does |
|-----|-----------------|--------------|
| `fetch-tweets` | every 15 min | Fetch new tweets for all active KOLs |
| `run-algo` | every 30 min | Classify tweets + synthesize thesis/portfolio |
| `fetch-prices` | every 1 min | Fetch token prices (Birdeye) + vault prices |
| `rebalance-vaults` | every 6 hours | Execute on-chain swaps to match thesis |
| `sync-profiles` | Sunday 3am | Refresh KOL Twitter profiles |
| `health-check` | every 6 hours | Probe external APIs, alert on Telegram |

All schedules configurable via env vars: `CRON_FETCH_TWEETS`, `CRON_RUN_ALGO`, etc.

---

## Missing Endpoints (no HTTP, script-only)

These operations have **no curl endpoint** — they can only be triggered via CLI scripts or crons:

- **Tweet backfilling** — `backfill-tweets.ts` script only
- **KOL seeding** — `seed-kols.ts` script only
- **Classification + synthesis** — `run-algo` cron or `run-algo-one-kol.ts` script
- **Price backfilling** — `fetch-prices` cron only (no manual trigger endpoint)
