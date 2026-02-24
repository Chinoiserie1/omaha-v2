# Plan: Logs Refactoring — Fix Levels, Reduce Noise, Add Context

## Context

Railway logs are a mess. Analysis of the exported logs (173 entries) reveals:
- **All 16 KOL syncs fail** with HTTP 429 (rate limit) — but the final log says "All KOLs synced" (misleading)
- **Errors logged at wrong levels** — `logger.error(...)` in code outputs as `"level":"info"` in Railway because Fastify's built-in logger and the standalone pino logger are two separate instances
- **Prisma query logs leaking** — `prisma:query SELECT...` appears 31 times (18% of log volume)
- **Fragmented log entries** — context (username, error) split across multiple JSON lines

Pretty logs (pino-pretty) are fine to keep.

---

## Step 1: Unify Loggers — Single Pino Instance

**Problem**: Two separate loggers — Fastify's built-in and the standalone `pino` in `utils/logger.ts`. Different configs cause level inconsistencies in Railway.

**File:** `apps/back/src/app.ts`

**Change**: Use `loggerInstance` so `app.log` and `logger` are the same:
```typescript
import { logger } from "./utils/logger.js";
const app = Fastify({ loggerInstance: logger });
```

---

## Step 2: Log NODE_ENV on Startup

**Problem**: Prisma query logging may be active because NODE_ENV isn't set correctly on Railway.

**File:** `apps/back/src/index.ts`

**Change**: Replace `console.info` with logger, include NODE_ENV:
```typescript
logger.info({ port: PORT, host: HOST, nodeEnv: process.env["NODE_ENV"] }, "Server started");
```

---

## Step 3: Add Summary Stats to `syncAllKols()`

**Problem**: Logs "All KOLs synced" even when all 16 failed.

**File:** `apps/back/src/services/kol.service.ts`

**Change**: Track synced/failed/skipped counts, replace misleading final message:
```typescript
logger.info({ total: kols.length, synced, failed, skipped }, "KOL sync complete");
```

---

## Step 4: Fix `synthesizeAllKols()` Skipped Counter

**Problem**: hasTwitter skip doesn't increment the existing `skipped` counter.

**File:** `apps/back/src/services/thesis.service.ts`

**Change**: Add `skipped++` in the `!kol.hasTwitter` block.

---

## Step 5: Improve Error Context in Twitter Service

**Problem**: Errors only include `error.message`, losing the HTTP status code.

**File:** `apps/back/src/services/twitter.service.ts`

**Change**: Log Axios errors with status code in all 3 catch blocks (`fetchUserDetails`, `fetchUserTweets`, `fetchTweetDetail`).

---

## Files Summary

| # | File | Action |
|---|------|--------|
| 1 | `apps/back/src/app.ts` | Pass shared logger via `loggerInstance` |
| 2 | `apps/back/src/index.ts` | Log NODE_ENV on startup, use logger |
| 3 | `apps/back/src/services/kol.service.ts` | Add synced/failed/skipped counters |
| 4 | `apps/back/src/services/thesis.service.ts` | Increment skipped counter |
| 5 | `apps/back/src/services/twitter.service.ts` | Richer error context with status code |

## Verification

```bash
pnpm --filter @repo/back build
```
