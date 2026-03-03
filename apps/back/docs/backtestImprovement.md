# Backtest Improvement: Retroactive Portfolio Snapshots

## Problem (v1)

Cold start in `synthesizeThesis()` created a single snapshot from ALL historical tweets, losing temporal granularity. Backtest could only start from the day the KOL was added to the DB, not from their earliest tweet activity.

Example: Mert had tweets since Nov 2025, but snapshots only from Feb 23 2026 (KOL created Feb 22).

## Solution v1: Weekly Retroactive Snapshots (Cold Start Only)

When a KOL has zero existing snapshots, generate weekly retroactive snapshots from their historical tweet timeline.

## Problem (v2)

The v1 retroactive logic only triggered on cold start (`if (!latestSnapshot)`). For existing KOLs who already had snapshots from the old single-snapshot cold start, the retroactive path never fired — they were stuck with a backtest starting from the day they were added, even though they had tweets going back months earlier.

This required manually deleting all snapshots to re-trigger cold start — fragile and operational overhead.

## Solution v2: Automatic Gap-Detection Backfill

Replace the `if (!latestSnapshot)` guard with gap-detection logic. No manual deletion needed.

### How It Works

1. Fetch earliest existing snapshot + all relevant tweets
2. Compare oldest tweet's `postedAt` vs earliest snapshot's `createdAt`
3. Three paths:
   - **Cold start** (no snapshots): full retroactive generation (same as v1)
   - **Gap backfill** (tweets older than earliest snapshot): generate retroactive snapshots only for tweets before the earliest snapshot, then fall through to incremental
   - **No gap** (earliest snapshot covers all tweets): skip straight to incremental

### Design Decisions

- **Weekly (Mon–Sun) granularity** balances cost vs resolution. Daily would be too many LLM calls; monthly too coarse for meaningful backtests.
- **Empty windows are skipped** — sparse KOLs don't generate useless snapshots.
- **First window** uses cold start prompt (cumulative tweets), **subsequent windows** use incremental prompt (chaining from previous snapshot).
- **Conviction decay uses `window.endDate`** as reference, not `new Date()`. Otherwise all historical snapshots get decay computed relative to today.
- **Gap backfill passes only pre-gap tweets** to `generateRetroactiveSnapshots()`, so retroactive snapshots don't overlap with existing ones.

### Files Changed

| File | What |
|------|------|
| `apps/back/src/services/thesis.service.ts` | Replaced `if (!latestSnapshot)` with gap-detection logic using `findEarliestSnapshot()` |
| `apps/back/src/store/portfolio.repository.ts` | Added `findEarliestSnapshot()` query |

### Key Implementation Details

1. **Sort by `tweet.postedAt`, not `classifiedAt`** — `classifiedAt` is bulk classification time, `postedAt` is when the KOL actually tweeted
2. **Prisma `@default(now())`** only applies when field is omitted — passing a historical date overrides it cleanly, no schema changes needed
3. **`exactOptionalPropertyTypes` gotcha** — use `...(createdAt ? { createdAt } : {})` instead of passing `undefined`
4. **`synthesizeSingleSnapshot()`** is the shared LLM→parse→validate→save pipeline used by both incremental and retroactive paths
5. **Re-fetch `latestSnapshot` after backfill** — the incremental path needs the most recent snapshot, which may have been created by the backfill

### Cost

~$0.03/Haiku call × N non-empty weeks. Mert (16 weeks, 4 non-empty): 4 calls, ~$0.12, ~30 seconds.

### Idempotency

Once backfilled, `oldestTweetDate < earliestSnapshot.createdAt` becomes false — the new retroactive snapshots now cover those dates. The backfill won't re-run on subsequent cron cycles.

### Test Results (Mert, local DB — v1)

| # | Window | Tweets | Thesis |
|---|--------|--------|--------|
| 1 | Nov 10–16, 2025 | 1 | ZEC 50%, USDC 50% |
| 2 | Feb 2–8, 2026 | 1 | ZEC 25%, SOL 25%, HYPE 25%, USDC 25% |
| 3 | Feb 16–22, 2026 | 10 | ZEC 35%, SOL 35%, HYPE 15%, USDC 15% |
| 4 | Feb 23–27, 2026 | 24 | ZEC 38%, SOL 38%, hSOL 12%, HYPE 7%, USDC 5% |
