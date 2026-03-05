# FORNADAR

## What This Project Does

Autopilot (Omaha) is a Quant strategy platform for crypto, stocks, and commodities on Solana. It monitors Twitter influencers (Quants), analyzes their trading signals via AI, backtests portfolio strategies, and manages tokenized vaults on Solana via GLAM Protocol. Users can browse Quant dashboards showing portfolios, significant tweets, and backtest results. Users can also become Quant creators and manage their own vaults.

## Technical Architecture & How Parts Connect

```
[Web App]  ──HTTP──>  [Backend API]  ──Prisma──>  [PostgreSQL]
(Next.js 15)          (Fastify 5)                 (Railway)
(Vercel)              (Railway)

[Mobile App]  ──HTTP──>  [Backend API]
(Expo/RN)

[Backend Crons]  ──>  Twitter RapidAPI (tweet fetching)
                 ──>  Anthropic API (signal analysis)
                 ──>  Solana RPC (vault rebalancing)
```

- **Web app** (`apps/web`) calls backend REST API via `NEXT_PUBLIC_API_URL`
- **Backend** (`apps/back`) fetches tweets, runs AI analysis, manages vaults
  - Classification and synthesis pipelines are **thread-aware**: tweets sharing a `conversationId` are grouped and concatenated into a single `[THREAD]` text block before being sent to the LLM, so a 5-tweet thread counts as one cohesive signal rather than 5 independent entries
- **Shared package** (`packages/shared`) provides Zod schemas, DTOs, and types used by all apps
- **Database package** (`packages/database`) wraps Prisma client and schema
- **`algoEnabled` flag** on the `Quant` model allows opting out individual Quants from the automated pipeline (tweet sync, classification, thesis generation). Quants with `algoEnabled: false` (e.g. those using a predefined strategy) remain listed but skip all cron-driven processing

### Entity Model (March 2026)

```
User (1) ──── (0..1) Quant (1) ──── (0..1) Vault
                       │                      │
                       ├── Tweet[]            ├── RebalanceEvent[]
                       ├── PortfolioSnapshot[]├── HoldingsSnapshot[]
                       └── TweetImpact[]      ├── WithdrawalRequest[]
                                              └── VaultFavorite[]
```

- **User** — Identity anchor (REAL via Privy auth, or PLACEHOLDER for Quants not yet signed up)
- **Quant** — Strategy profile linked 1:1 to User, owns tweets/portfolios/vault
- **Vault** — Tokenized on-chain vault (GLAM Protocol) owned by a Quant

## Tech Stack & Why These Choices

| Layer | Tech | Why |
|-------|------|-----|
| Monorepo | Turborepo + pnpm | Fast builds, workspace isolation |
| Web | Next.js 15 (App Router) | SSR, React 19, file-based routing |
| Mobile | Expo SDK 54 / React Native | Cross-platform, Privy auth |
| Backend | Fastify 5 | High perf, schema validation |
| Database | PostgreSQL + Prisma 6 | Type-safe queries, migrations |
| Styling | Tailwind CSS v4 | Utility-first, fast iteration |
| Validation | Zod 3 | Runtime + static type safety |
| Blockchain | Solana (GLAM Protocol) | Tokenized vault management |

## Bugs Encountered & How They Were Fixed

### Vercel Deployment — React 18/19 Conflict (Feb 2026)

**Problem**: Root `package.json` has `react@18.3.1` (required by Expo/React Native). Web app uses React 19 (Next.js 15). With `node-linker=hoisted` in `.npmrc`, React 18 hoists to root `node_modules/react`. During Next.js build, prerender workers resolve React from root, get v18, crash with `TypeError: Cannot read properties of null (reading 'useRef')` and `useOptimistic` errors.

**Failed approaches**:
- Webpack `resolve.alias` for react — only affects bundling, not prerender runtime
- `NODE_PATH` override — doesn't propagate to child worker processes
- `output: "standalone"` — doesn't change prerender resolution
- Moving react@19 to root devDependencies — react-native at root then resolves to v19, breaks mobile

**Fix**: Avoid build-time prerendering entirely:
- `export const dynamic = "force-dynamic"` on all pages (they fetch from API anyway)
- Custom `pages/_error.tsx` with zero hooks (replaces default Next.js error pages that use React 19 hooks)
- Custom `app/not-found.tsx`
- Root dependencies left completely untouched

### Vercel Output Directory Path (Feb 2026)

**Problem**: `vercel.json` had `outputDirectory: "apps/web/.next"` but Vercel Root Directory was set to `apps/web`, causing it to look at `apps/web/apps/web/.next`.

**Fix**: Changed to `outputDirectory: ".next"` (relative to Root Directory).

### Tailwind CSS v4 Missing Dependencies (Feb 2026)

**Problem**: `postcss.config.mjs` used `@tailwindcss/postcss` (v4 plugin) but `tailwindcss` and `@tailwindcss/postcss` weren't in `apps/web/package.json`. Worked locally via hoisting but failed on Vercel.

**Fix**: Added both `tailwindcss@^4.2.1` and `@tailwindcss/postcss@^4.2.1` to web app devDependencies.

### twitter241 RapidAPI Breaking Change (Feb 2026)

**Problem**: `/tweet-detail` endpoint removed, renamed to `/tweet`. Response structure changed from `data.result.timeline.instructions` to `data.data.threaded_conversation_with_injections_v2.instructions`.

**Fix**: Updated endpoint and response parsing in `apps/back/src/services/twitter.service.ts`.

### Backtest Cumulative Value Staleness (Feb 2026)

**Problem**: In `runBacktest`, when iterating over stored `SnapshotPerformance` periods, the code did `cumulativeValue = stored.cumulativeValue` — directly using the DB value as the running accumulator. If an earlier period's prices were corrected (e.g. Birdeye data update), the stored `cumulativeValue` for that period would update, but all subsequent periods' stored values remained stale. The API response would show inconsistent cumulative values that didn't chain correctly.

**Fix**: Always recompute cumulative from the running product: `cumulativeValue = cumulativeValue * (1 + stored.periodReturn)`. The `periodReturn` is the source of truth; the stored `cumulativeValue` is only a cache. Also added warning logs for missing prices (was silently treated as 0% return) and allocation weights that don't sum to 100%.

### LLM JSON Parser Broken by Markdown Fences (Feb 2026)

**Problem**: Both `thesis.service.ts` and `classifier.service.ts` used an inline regex to strip markdown code fences from LLM responses before `JSON.parse`. The regex used the `m` (multiline) flag, making `$` match end-of-line instead of end-of-string. When the LLM returned trailing text after the closing fence (e.g. `**ANALYSIS:** commentary...`), the trailing content wasn't stripped and `JSON.parse` failed.

**Fix**: Extracted a shared `extractJson` utility (`apps/back/src/utils/extract-json.ts`) that uses a capture group to grab only the content *between* fences (`/```(?:json)?\s*\n([\s\S]*?)\n```/`), ignoring everything before and after. Falls back to raw string if no fences found. Both services now call `extractJson(rawResponse)` instead of inline regex+parse.

### Asset Extraction Missing Trading Pair Tokens (Mar 2026)

**Problem**: A tweet mentioning "ZEC/BTC + SOL/HYPE" only extracted ZEC. The LLM classification prompt had no rules for slash-separated trading pairs, so only the first token was picked up. Additionally, `asset-aliases.json` only had 24 entries — many well-known tokens (HYPE, ZEC, DOGE, AVAX, etc.) were unknown.

**Fix**:
- Added 3 rules to `CLASSIFICATION_SYSTEM_PROMPT` in `packages/shared/src/schemas/classification.schema.ts`: slash-separated pairs extract BOTH sides, `+`/`&`/comma-separated groups extract all tokens, and explicit instruction to extract ALL assets
- Expanded `apps/back/src/data/asset-aliases.json` from 24 to 86 entries covering BTC ecosystem (ZEC, LTC, DOGE, XMR, BCH), ETH ecosystem (AAVE, UNI, LINK, MKR, LDO, ARB, OP), SOL ecosystem (ORCA, DRIFT, TNSR, KMNO), L1s (AVAX, SUI, APT, SEI, TIA, INJ, NEAR, ATOM, DOT, ADA), DeFi (HYPE, PENDLE, GMX, DYDX, CRV), and memes (PEPE, SHIB, FLOKI)

### Try-It-Out Buttons Invisible (Mar 2026)

**Problem**: API try-it-out buttons on Quant cards/detail pages were `text-xs` with muted `bg-zinc-100 text-zinc-600` — nearly invisible to users.

**Fix**: Changed to `text-sm`, `px-4 py-2`, `bg-indigo-600 text-white`, `hover:bg-indigo-700`, `rounded-md`. Added "Try:" prefix to labels for clarity.

### Asset Aliases + Tokenized Stocks (xStocks & Ondo GM) (Mar 2026)

**Problem**: `asset-aliases.json` had only 89 entries mapping text to bare ticker symbols (e.g. `"aapl"` → `"AAPL"`). But `"AAPL"` didn't exist as a `TradeableAsset` — no Solana mint address, so the thesis service couldn't create tradeable allocations. The system could tag tweets but not act on stock mentions.

**Fix** (3 scripts):

1. **`seed-stock-tokens.ts`** — Seeds 63 xStock tokens (Backed Finance, decimals=8) and 203 Ondo GM tokens (decimals=9) into `TradeableAsset` with verified Solana mint addresses.

2. **`sync-asset-aliases.ts`** — Updated to resolve aliases to actual tokenized symbols:
   - For 53 overlapping tickers (both xStock and Ondo exist), Birdeye liquidity was checked for each pair. The bare ticker maps to whichever is more liquid. Result: 27 xStock wins, 26 Ondo wins.
   - Explicit suffixed aliases route to their platform: `"aaplx"` → `AAPLx`, `"aaplon"` → `AAPLon`
   - Example: `"aapl"` / `"apple"` → `AAPLx` (xStock, $163k liq), `"msft"` / `"microsoft"` → `MSFTon` (Ondo, $53k liq)
   - Also fetches top 300 Solana tokens from Birdeye, filters via Jupiter verified mints

3. **`sync-jupiter-tokens.ts`** — Existing script, populates `TradeableAsset` with Jupiter verified crypto tokens.

Result: 89 → 493 aliases. 265 stock tokens seeded. Run with `pnpm seed-stocks && pnpm sync-aliases`.

**Decimals**: xStocks = 8 (verified on-chain for AAPLx, TSLAx), Ondo = 9 (from Jupiter API). Do NOT assume — always verify on-chain.

### Backtest Price Gaps & Same-Day Noise (Mar 2026)

**Problem**: Backtest showed -4.71% on the first period then 0% for all subsequent periods. Verified on Mert's data (5 snapshots, 4 stored periods — only 1 had real returns).

Three interrelated bugs:

1. **Price cache check too coarse** (`price.service.ts`): `ensurePricesForSymbols()` checked `countPricesInRange(symbol, from, to) > 0` to decide "already cached". If ANY price existed in the range, it skipped fetching — even if the end of the range had no data. Example: ZEC prices existed for Feb 23-28, but when the range extended to Mar 2, the count check found Feb data and skipped, leaving Mar 1 unfetched.

2. **Same-day snapshots produce 0% periods** (`backtest.service.ts`): Thesis cron runs every 30 min and creates a new snapshot whenever new tweets exist. Two snapshots on the same calendar day (e.g. Feb 28 11:10 and 14:07) always compute 0% return because prices are daily granularity — both sides resolve to the same close price.

3. **Near-date fallback masks missing data** (`price.service.ts`): `getPriceOnDate()` falls back to ±3 days when exact date is missing. When both `priceFrom` (Feb 28) and `priceTo` (Mar 1 → fallback to Feb 28) resolve to the same stale price, the return is silently 0%. System treats "no data" as "flat market" with no warning.

**Fix**:
1. Replaced `countPricesInRange > 0` with `findPriceOnDate(symbol, endDate)` — only skip if the end date specifically has a price. Crypto trades 24/7/365, so every date should have data. Re-fetching overlapping dates is safe (`upsertDailyPrice` deduplicates via `@@unique([symbol, date])`).

2. Added `deduplicateByDay()` helper in `runBacktest()` — keeps only the last snapshot per calendar day before iterating periods. Added same-day guard in `computeLatestPeriod()` to skip computation when the two latest snapshots share a calendar day. Snapshots themselves are still created (they represent real thesis updates).

3. Changed `getPriceOnDate` return type from `number | null` to `PriceResult { price, date, isFallback }`. `computePeriod` now detects when both from/to prices resolved to the same date and logs a warning. Only caller is `computePeriod`, so blast radius is contained.

### Kol → Quant Database Refactor (Mar 2026)

**Problem**: The original data model used a single `Kol` table that mixed identity data (username, avatarUrl, bio) with pipeline config (isActive, algoEnabled). This prevented regular users from becoming Quants (they'd need a separate Kol record), and Quant creators who hadn't signed up had no User record to link to.

**Fix**: Split into a proper three-tier model:
1. **User** — Identity anchor with `userType: REAL | PLACEHOLDER`. Real users auth via Privy, placeholder users are created for Quants not yet signed up. `privyId` made optional.
2. **Quant** — Strategy profile linked 1:1 to User via `userId` FK. Owns pipeline config and data (tweets, portfolios, impacts).
3. **Vault** (renamed from `KolVault`) — Owned by Quant via `quantId` FK.

**Migration strategy** (5 sequential migrations):
1. Add User fields (`twitterFollowerCount`, `bio`, `hasTwitter`, `userType` enum, make `privyId` optional)
2. Create Quant table
3. Migrate Kol data → create placeholder Users + Quants with same IDs
4. Rename FK columns (`kolId` → `quantId`, `kolVaultId` → `vaultId`, `KolVault` → `Vault`)
5. Drop Kol table

**Scope of rename**:
- Database: All FK columns, indexes, unique constraints
- Backend: All repositories, services, cron jobs, route handlers, scripts
- Shared types: All interfaces (`KolVault` → `Vault`, `kolId` → `quantId`, etc.)
- Shared schemas: `kolQuerySchema` → `quantQuerySchema`, `ingestContentSchema` fields
- Native app: Local type definitions, component props (`kolUsername` → `quantUsername`)
- DTOs: `KolQueryDto` → `QuantQueryDto`

## Lessons Learned & Best Practices

1. **Never touch root mobile dependencies** — `expo`, `react@18.3.1`, `react-native` in root `package.json` are sacred. Changing them breaks the mobile app.

2. **`node-linker=hoisted` causes version conflicts** — In monorepos with React 18 (mobile) and React 19 (web), the hoisted version wins for all packages at root level. Next.js prerender workers use Node.js resolution, not webpack — aliases don't help.

3. **Vercel paths are relative to Root Directory** — If Root Directory is `apps/web`, then `outputDirectory` in `vercel.json` is relative to that, not the monorepo root.

4. **Always add PostCSS/Tailwind deps explicitly** — Don't rely on hoisting for build tools. They must be in the app's own `package.json`.

5. **`force-dynamic` is the pragmatic fix** — When you can't control module resolution in a monorepo, skip static prerendering. Pages that fetch from an API should be dynamic anyway.

6. **Test builds locally before pushing** — `pnpm --filter @repo/web build` catches issues before Vercel.

7. **Don't use `m` flag when matching end-of-string** — In regex, `$` with the `m` flag matches end-of-line, not end-of-string. When stripping markdown fences from LLM output, use a capture group to extract content between fences rather than trying to strip them away.

8. **LLM prompts need explicit rules for structured text** — The LLM won't infer that "ZEC/BTC" means two assets unless you spell it out. When the input domain has conventions (trading pairs, ticker formats), add examples to the prompt. Don't assume the model knows crypto notation.

9. **Keep alias/lookup tables comprehensive** — A 14-token alias file silently drops most assets. Expand proactively to cover major ecosystems rather than waiting for each miss. Use automated sync scripts (Birdeye + Jupiter verified filter) to stay current rather than manually curating.

10. **Treat tweet threads as atomic units** — When classifying or synthesizing Quant signals, individual thread tweets lack context ("as I said above", "adding more here"). Concatenating the full thread before LLM analysis fixes misclassification and prevents over-weighting. The classifier fetches the full thread (including already-classified tweets) via `findThreadByConversationId` for maximum context, then applies the same classification to all unclassified tweets in the thread. The synthesizer groups by `conversationId` and emits one entry per thread so a multi-tweet thread doesn't inflate signal strength.

11. **Filter external token lists through a verified source** — Birdeye's top 300 includes scam squatters and low-quality tokens. Cross-referencing mint addresses against Jupiter's verified token list (synced to `TradeableAsset`) filters out 80%+ of noise. Always validate external data against a trusted registry.

12. **Rate-limit API pagination with retry** — Birdeye's free tier rate-limits aggressively (429 on second page with 200ms delay). Use 1.5s delays between pages and exponential backoff retry (2s, 4s, 6s) on 429s.

13. **Aliases must resolve to actual TradeableAsset symbols** — Mapping `"aapl"` → `"AAPL"` is useless if `AAPL` doesn't exist in `TradeableAsset` with a mint address. Aliases should resolve to the actual tradeable token symbol (e.g. `AAPLx` or `AAPLon`).

14. **When multiple tokenized versions exist, pick by liquidity** — For stocks available on both xStocks (Backed Finance) and Ondo GM, check on-chain liquidity via Birdeye to determine which is more tradeable. The split is roughly 50/50 (27 xStock wins vs 26 Ondo wins as of Mar 2026), not one-sided.

15. **Verify token decimals on-chain, never assume** — xStocks use 8 decimals (not the assumed 9). Ondo GM uses 9. Wrong decimals = wrong swap amounts. Always verify via Solana RPC `getAccountInfo` with `jsonParsed` encoding.

16. **Crypto markets are 24/7/365** — Never assume weekend/holiday gaps in price data. Every calendar date should have a token price. If it's missing, it's genuinely missing, not a market closure. Don't build weekend-handling logic that doesn't apply.

17. **Cache checks must match the query granularity** — Checking "any data exists in range" is not the same as "data exists for the dates I need". When caching time-series data, validate coverage at the resolution you'll query (daily prices → check the specific date), not just the existence of any data in the window.

18. **Fallback mechanisms can hide bugs** — The ±3 day price fallback was designed for legitimate gaps (weekends for SPX). In crypto, it masked the fact that prices stopped being fetched. When both sides of a comparison fall back to the same value, the result (0%) looks plausible but is wrong. Add observability (return metadata, log fallback usage) so silent failures become visible.

19. **Database renames need end-to-end sweep** — When renaming a model (Kol → Quant), the blast radius includes: Prisma schema, migrations, all repositories, all services, all route handlers, all scripts, shared type interfaces, shared Zod schemas, DTOs, native app local types, native app component props, and documentation. A grep for the old name across the entire monorepo is essential to catch stragglers.

## Telegram Health Monitor Bot

The bot sends alerts on cron/API failures and supports an on-demand `/health` command in Telegram.

### What `/health` Actually Checks

| Probe | What a means | What a means | Cost |
|-------|----------------|----------------|------|
| **Twitter (RapidAPI)** | API key valid, credits not exhausted, API up | Credits exhausted (429), key invalid, or API down | 1 credit per call |
| **Anthropic** | API key valid, service up (calls `/v1/models`, no tokens used) | Key invalid/revoked, or service outage | Free |
| **Jupiter** | API key valid, quote engine working (0.001 SOL→USDC quote) | Key invalid, or Jupiter down/degraded | Free |
| **Birdeye** | API key valid, price data available | Key invalid/exhausted, or Birdeye down | 1 credit per call |
| **Solana RPC** | RPC node healthy and responding | Node down or unreachable | Free |
| **Database** | PostgreSQL connected and responding | Connection lost or DB down | Free |

### Env Vars (Railway)

```
TELEGRAM_BOT_TOKEN=<from @BotFather>
TELEGRAM_CHAT_ID=<group chat ID, negative number>
CRON_HEALTH_CHECK=0 */6 * * *    # default: every 6 hours
```

### How It Works

- **`/health` command**: Type in Telegram group → bot runs all probes → replies with results
- **Automatic cron alerts**: Every cron job failure sends a formatted alert (rate limit, API error, or generic) with 15-minute dedup to avoid spam
- **Graceful no-op**: If TG env vars are missing, everything silently skips — no crashes

### Asset Aliases ↔ Curated Assets Sync (Mar 2026)

**Problem**: The two-tier asset system was out of sync:
- 30 curated symbols had no aliases → classifier couldn't normalize Quant mentions
- 33 alias targets were tradeable on Jupiter but missing from curated → thesis LLM couldn't allocate
- 10 alias targets had case mismatches with curated symbols (e.g. `BONK` vs `Bonk`)
- `"fartcoin "` (trailing space) was a broken alias key

**Fix**:
1. Added 51 new alias entries for 30 curated tokens missing aliases (Phase 1)
2. Fixed alias target casing for 10 tokens to match curated symbols exactly (e.g. `BONK` → `Bonk`, `ZBTC` → `zBTC`)
3. Removed broken `"fartcoin "` alias (trailing space on key and value)
4. Added 33 verified crypto tokens to `curated-assets.ts` with mints from `tradeable-assets.csv` (Phase 2)
5. Skipped 67 non-winning stock suffixes, 14 bare stock redirects, 6 non-tokenized stocks (ARKK, DIA, VOO, NET, RBLX, SQ), BTC (have wrapped variants), WETH (same as ETH)
6. 24 major L1/DeFi tokens (LINK, DOGE, ONDO, etc.) remain as alias targets but are NOT in curated — not in TradeableAsset DB and mints need external verification

**Result**: 543 alias entries → 287 unique targets. 187 curated assets (110 crypto + 77 stocks). All invariants pass: every curated symbol has ≥1 alias, no duplicate stock tickers.

### Retroactive Portfolio Snapshots on Cold Start (Mar 2026)

**Problem**: When a Quant was first added to the DB, the cold start path in `synthesizeThesis()` took ALL historical tweets and created a **single** snapshot. This meant the backtest had no temporal granularity — it could only start from the day the Quant was added, even if their tweets went back months (e.g. Mert: tweets since Nov 2025, but snapshots only from Feb 23 2026).

**Fix**: Replaced the single-snapshot cold start with `generateRetroactiveSnapshots()`:
1. Sorts all relevant tweets by `tweet.postedAt` (not `classifiedAt`)
2. Generates weekly time windows (Mon–Sun) via `generateWeeklyWindows()`
3. For each non-empty window: calls `synthesizeSingleSnapshot()` with `createdAt = window.endDate`
4. First window uses cold start prompt (cumulative tweets), subsequent windows use incremental prompt (previous thesis state + new window tweets)
5. Conviction decay uses `window.endDate` as reference (not `now()`)

Also extracted the LLM call → parse → validate → save logic into `synthesizeSingleSnapshot()` for reuse by both retroactive and incremental paths.

**Cost**: ~N Haiku calls per Quant cold start where N = number of non-empty weeks. For a Quant with 17 weeks of sparse tweets: ~5-8 calls (~$0.20).

**Files changed**: `thesis.service.ts` (refactored), `portfolio.repository.ts` (added optional `createdAt` param)

### Asset Category Expansion & BTC/Gold Dedup (Mar 2026)

**Problem**: `CuratedAsset.category` only supported `"crypto" | "stock"`, but several assets were miscategorized — ETFs like QQQx/SPYx are indices, GLDx/SLVon are commodities, TBLLx/TLTon are fixed income. Additionally, 4 wrapped BTC tokens (21BTC, cbBTC, WBTC, zBTC) diluted Bitcoin exposure across the portfolio, and "bitcoin"/"btc" aliases mapped to non-existent "BTC" symbol (bug).

**Changes**:

1. **Category type expansion**: Added `"index" | "commodity" | "fixed_income"` to `CuratedAsset.category`. This field is metadata-only (not used in any runtime logic), making it a zero-risk change.

2. **Recategorized 9 assets**:
   - Index ETFs: QQQx, SPYx, IWMon, VTIon, TQQQon
   - Commodities: GLDx (gold), SLVon (silver)
   - Fixed Income: TBLLx (T-bills), TLTon (20+ year treasury)

3. **BTC dedup (4 → 1)**: Jupiter liquidity comparison (swap/v1 quote, 10 SOL input):
   - cbBTC: 0.01260841 BTC, 0% impact, 2 hops — **WINNER**
   - zBTC: 0.01263943 BTC, 0% impact, 3 hops
   - WBTC: 0.01262833 BTC, 0% impact, 3 hops
   - 21BTC: 0.01272174 BTC, 0.006% impact, 3 hops
   - cbBTC selected for: zero impact, fewest hops, Coinbase institutional backing
   - Removed 21BTC, WBTC, zBTC from curated. All BTC-related aliases (bitcoin, btc, wbtc, zbtc, 21btc, wrapped btc) now → cbBTC

4. **Gold evaluation**: GLDx (xStock gold ETF) vs $GOLD (Oro Finance) vs GLDon (Ondo):
   - GLDon: not tradable on Jupiter (no route)
   - $GOLD: microcap crypto token (~$0.00034/token), not gold-backed
   - GLDx: real SPDR Gold Shares ETF — kept as winner
   - Added `"gold"` alias → GLDx (previously only had `"gold etf"`)

5. **Fixed "bitcoin"/"btc" alias bug**: These mapped to `"BTC"` which didn't exist in curated assets. Now correctly map to `"cbBTC"`.

**Result**: 184 curated assets (107 crypto, 68 stock, 5 index, 2 commodity, 2 fixed_income). All invariants pass.

### Backtest Chart Endpoint (Mar 2026)

**Added**: `GET /api/quants/:quantId/backtest/chart` — transforms existing backtest periods into chart-consumable `{ timestamp, value }` points. Reuses `runBacktest()` from `backtest.service.ts` without duplicating any computation logic. Response includes `points`, `totalReturn`, `percentChange`, `startValue`, `currentValue`, and the raw `periods` array. Empty backtest returns `points: []` with zero-value defaults.

**Files**: `apps/back/src/routes/backtest/handlers/get-backtest-chart.ts` (new handler), `apps/back/src/routes/backtest/index.ts` (route registration).

### Token Icon Sync from Jupiter (Mar 2026)

**Problem**: No token icon/image URLs anywhere in the system. The native app showed colored letter badges and the web app showed plain text symbols for portfolio allocations and vault holdings.

**Solution**: Added `logoUri String?` to the `Token` Prisma model. Created `sync-token-icons.ts` script that bulk-fetches all verified tokens from Jupiter V2 (`/tokens/v2/tag?query=verified`) and upserts the `icon` URL into the Token table for every curated asset.

**Coverage**: 183/186 curated assets have icon URLs:
- Crypto tokens: GitHub raw, static.jup.ag, arweave, project CDNs (28-68KB PNGs, 512x512)
- xStock tokens: `xstocks-metadata.backed.fi` CDN
- Ondo tokens: `cdn.ondo.finance` CDN (160x160 PNGs)
- 3 missing (not on Jupiter at all): `OPENx`, `ABBVon`, `TBLLx`

**Run**: `pnpm sync-icons`

**Files**: `packages/database/prisma/schema.prisma` (migration), `apps/back/src/scripts/sync-token-icons.ts` (new script), `turbo.json` + `package.json` (script registration)

### Direct Allocation Override (Mar 2026)

**Problem**: Some quants share their exact portfolio breakdown (e.g. "jitoSOL 68%, pbUSDC 12%, USDC 10%, BTC 8%, JUP 2%"). Running this through the LLM thesis pipeline would only risk distortion — we already know the exact allocation.

**Fix**: Added a direct allocation path that bypasses all LLM logic:

1. **Schema** (`packages/shared/src/schemas/kol-knowledge.schema.ts`): Added `useDirectAllocations` (boolean toggle), `directAllocations` (array of `{ asset, percentage }`, validated to sum ~100%), and `directAllocationsSetAt` (auto-timestamped on PATCH).

2. **Thesis service** (`apps/back/src/services/thesis.service.ts`): New `buildDirectAllocationSnapshot()` function normalizes symbols, merges asset groups, resolves mints, and saves a snapshot with all-high conviction. Early return in `synthesizeThesis()` when toggle is active — skips classification, LLM calls, retroactive backfill, and conviction decay entirely.

3. **PATCH handler** (`apps/back/src/routes/kols/handlers/update-knowledge.ts`): Auto-sets `directAllocationsSetAt` when `directAllocations` is provided.

**Behavior**: Toggle-driven — `useDirectAllocations: false` (or absent) reverts to normal LLM path even if allocation data exists. Every cron run creates a new snapshot for chart continuity.

### Twitter API: profile-conversation Author Investigation (Mar 2026)

**Investigation**: Analyzed `profile-conversation` entries from `user-tweets` API to understand tweet authorship. Found that `legacy.screen_name` is **null** in this API — screen name lives at `core.user_results.result.core.screen_name`, which `TweetResultSchema` does not parse. Only `legacy.user_id_str` is available for author identification.

**Finding**: On Mert's page 1, 2 out of 23 extracted tweets belong to other users (parent tweets in reply conversations). These are kept intentionally — they provide context needed for accurate classification of the Quant's replies.

**Pagination limit**: RapidAPI degrades after ~43 pages (~1 tweet/page). This causes the 70-day gap in Mert's backfill.

**Documented in**: `apps/back/docs/TWITTER-API.md`
