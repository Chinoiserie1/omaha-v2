# Backtest Improvement: Retroactive Portfolio Snapshots

## Problem

Cold start in `synthesizeThesis()` created a single snapshot from ALL historical tweets, losing temporal granularity. Backtest could only start from the day the KOL was added to the DB, not from their earliest tweet activity.

Example: Mert had tweets since Nov 2025, but snapshots only from Feb 23 2026 (KOL created Feb 22).

## Solution: Weekly Retroactive Snapshots

When a KOL has zero existing snapshots, generate weekly retroactive snapshots from their historical tweet timeline.

### Design Decisions

- **Weekly (Mon–Sun) granularity** balances cost vs resolution. Daily would be too many LLM calls; monthly too coarse for meaningful backtests.
- **Empty windows are skipped** — sparse KOLs don't generate useless snapshots.
- **First window** uses cold start prompt (cumulative tweets), **subsequent windows** use incremental prompt (chaining from previous snapshot).
- **Conviction decay uses `window.endDate`** as reference, not `new Date()`. Otherwise all historical snapshots get decay computed relative to today.

### Files Changed

| File | What |
|------|------|
| `apps/back/src/services/thesis.service.ts` | Extracted `synthesizeSingleSnapshot()`, added `generateWeeklyWindows()` + `generateRetroactiveSnapshots()`, rewired cold start branch |
| `apps/back/src/store/portfolio.repository.ts` | Added optional `createdAt` param to `createSnapshot()` |

### Key Implementation Details

1. **Sort by `tweet.postedAt`, not `classifiedAt`** — `classifiedAt` is bulk classification time, `postedAt` is when the KOL actually tweeted
2. **Prisma `@default(now())`** only applies when field is omitted — passing a historical date overrides it cleanly, no schema changes needed
3. **`exactOptionalPropertyTypes` gotcha** — use `...(createdAt ? { createdAt } : {})` instead of passing `undefined`
4. **`synthesizeSingleSnapshot()`** is the shared LLM→parse→validate→save pipeline used by both incremental and retroactive paths

### Cost

~$0.03/Haiku call × N non-empty weeks. Mert (16 weeks, 4 non-empty): 4 calls, ~$0.12, ~30 seconds.

### Idempotency

`if (!latestSnapshot)` guard means retroactive only runs when zero snapshots exist. If process crashes mid-generation, next cron run takes incremental path with whatever snapshots were created.

### Test Results (Mert, local DB)

| # | Window | Tweets | Thesis |
|---|--------|--------|--------|
| 1 | Nov 10–16, 2025 | 1 | ZEC 50%, USDC 50% |
| 2 | Feb 2–8, 2026 | 1 | ZEC 25%, SOL 25%, HYPE 25%, USDC 25% |
| 3 | Feb 16–22, 2026 | 10 | ZEC 35%, SOL 35%, HYPE 15%, USDC 15% |
| 4 | Feb 23–27, 2026 | 24 | ZEC 38%, SOL 38%, hSOL 12%, HYPE 7%, USDC 5% |
