# FORNADAR

## What This Project Does

Autopilot is a KOL (Key Opinion Leader) tracking platform for crypto. It monitors Twitter influencers, analyzes their trading signals, backtests portfolio strategies, and manages tokenized vaults on Solana via GLAM Protocol. Users can view KOL dashboards showing portfolios, significant tweets, and backtest results.

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
- **`algoEnabled` flag** on the `Kol` model allows opting out individual KOLs from the automated pipeline (tweet sync, classification, thesis generation). KOLs with `algoEnabled: false` (e.g. those using a predefined strategy) remain listed but skip all cron-driven processing

## Tech Stack & Why These Choices

| Layer | Tech | Why |
|-------|------|-----|
| Monorepo | Turborepo + pnpm | Fast builds, workspace isolation |
| Web | Next.js 15 (App Router) | SSR, React 19, file-based routing |
| Mobile | Expo SDK 52 / React Native | Cross-platform, Privy auth |
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

**Problem**: API try-it-out buttons on KOL cards/detail pages were `text-xs` with muted `bg-zinc-100 text-zinc-600` — nearly invisible to users.

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

11. **Filter external token lists through a verified source** — Birdeye's top 300 includes scam squatters and low-quality tokens. Cross-referencing mint addresses against Jupiter's verified token list (synced to `TradeableAsset`) filters out 80%+ of noise. Always validate external data against a trusted registry.

12. **Rate-limit API pagination with retry** — Birdeye's free tier rate-limits aggressively (429 on second page with 200ms delay). Use 1.5s delays between pages and exponential backoff retry (2s, 4s, 6s) on 429s.

13. **Aliases must resolve to actual TradeableAsset symbols** — Mapping `"aapl"` → `"AAPL"` is useless if `AAPL` doesn't exist in `TradeableAsset` with a mint address. Aliases should resolve to the actual tradeable token symbol (e.g. `AAPLx` or `AAPLon`).

14. **When multiple tokenized versions exist, pick by liquidity** — For stocks available on both xStocks (Backed Finance) and Ondo GM, check on-chain liquidity via Birdeye to determine which is more tradeable. The split is roughly 50/50 (27 xStock wins vs 26 Ondo wins as of Mar 2026), not one-sided.

15. **Verify token decimals on-chain, never assume** — xStocks use 8 decimals (not the assumed 9). Ondo GM uses 9. Wrong decimals = wrong swap amounts. Always verify via Solana RPC `getAccountInfo` with `jsonParsed` encoding.

10. **Treat tweet threads as atomic units** — When classifying or synthesizing KOL signals, individual thread tweets lack context ("as I said above", "adding more here"). Concatenating the full thread before LLM analysis fixes misclassification and prevents over-weighting. The classifier fetches the full thread (including already-classified tweets) via `findThreadByConversationId` for maximum context, then applies the same classification to all unclassified tweets in the thread. The synthesizer groups by `conversationId` and emits one entry per thread so a multi-tweet thread doesn't inflate signal strength.

## Telegram Health Monitor Bot

The bot sends alerts on cron/API failures and supports an on-demand `/health` command in Telegram.

### What `/health` Actually Checks

| Probe | What a ✅ means | What a ❌ means | Cost |
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
