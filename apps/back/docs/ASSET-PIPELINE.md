# Asset Pipeline

> Read this document before touching `curated-assets.ts`, `asset-aliases.json`, `sync-asset-aliases.ts`, `classifier.service.ts`, or `thesis.service.ts`.

## The Two-Tier Asset System

There are **two separate data structures** serving **different purposes**. They must stay in sync but are NOT identical.

### Tier 1: Asset Aliases (`src/data/asset-aliases.json`)

**Purpose**: Normalize fuzzy/variant asset names from LLM classification output into canonical symbols.

**Used by**: `classifier.service.ts` → `normalizeAsset()` function.

**When it runs**: During the CRON_RUN_ALGO classification step. The LLM classifies tweets and extracts asset mentions. The classifier normalizes "nvidia" → "NVDAx", "apple stock" → "AAPLx", "bitcoin" → "BTC".

**Contents**: ~500 aliases mapping to ~258 unique canonical symbols. Broad — includes anything a KOL might mention.

**Format**: `{ "lowercase alias": "CANONICAL_SYMBOL" }`

**Example**:
```json
{
  "nvidia": "NVDAx",
  "nvda": "NVDAx",
  "nvdax": "NVDAx",
  "nvdaon": "NVDAon",
  "bitcoin": "BTC",
  "fartcoin": "FARTCOIN"
}
```

**Key rule for stocks**: Every stock has aliases for the bare ticker ("nvda"), the company name ("nvidia"), and each platform-specific suffix ("nvdax", "nvdaon"). The bare ticker and company name always map to the "best" (most liquid) version.

**How it's built**: `sync-asset-aliases.ts` merges three sources with priority:
1. Stock aliases (computed from `STOCK_TICKERS` map) — highest priority
2. Existing manual entries (preserved from previous runs)
3. Extra tokens (`EXTRA_TOKENS` map)
4. Birdeye top 300 by 24h volume (auto-discovered) — lowest priority

### Tier 2: Curated Assets (`src/data/curated-assets.ts`)

**Purpose**: Define the investable universe — the assets the thesis LLM is allowed to allocate capital to.

**Used by**: `thesis.service.ts` → `getCuratedAssetSymbols()` feeds the list into the LLM prompt as available assets.

**When it runs**: During the CRON_RUN_ALGO thesis synthesis step. The LLM sees ONLY these symbols and must allocate percentages among them.

**Contents**: Crypto tokens + tokenized stocks. Each entry has: symbol, name, mint address, decimals, category.

**Critical**: This replaced the old approach of sending ALL 4,425 Jupiter-verified tokens to the prompt, which burned context window and confused the LLM with thousands of irrelevant tokens.

### How They Relate

```
Tweet: "I'm very bullish on NVIDIA long term"
                    │
                    ▼
    ┌─────────────────────────────┐
    │  CLASSIFIER (LLM)           │
    │  Extracts: "NVIDIA"         │
    │  normalizeAsset("nvidia")   │
    │  Looks up asset-aliases.json│
    │  Returns: "NVDAx"           │
    └─────────────────────────────┘
                    │
                    ▼
    ClassifiedTweet { assets: ["NVDAx"], sentiment: "bullish", ... }
                    │
                    ▼
    ┌─────────────────────────────┐
    │  THESIS LLM                 │
    │  Sees classified tweets     │
    │  Available assets from      │
    │  curated-assets.ts          │
    │  Allocates: NVDAx → 15%     │
    └─────────────────────────────┘
                    │
                    ▼
    PortfolioSnapshot { allocations: [{ asset: "NVDAx", percentage: 15, ... }] }
                    │
                    ▼
    ┌─────────────────────────────┐
    │  REBALANCER                 │
    │  Resolves NVDAx → mint addr │
    │  Uses full Jupiter          │
    │  tradeableAssets map        │
    │  Executes swap via GLAM     │
    └─────────────────────────────┘
```

**The alias system must recognize everything the curated list contains**, plus more. If a symbol is in curated-assets but has no alias, the classifier can't normalize it and the thesis LLM won't see relevant tweet data for that asset.

---

## Source of Truth

`curated-assets.ts` is a **DERIVED file**, not an independent source of truth. It is the static materialization of:

1. `asset-aliases.json` targets → defines the symbol universe
2. `TradeableAsset` DB table → provides mint, decimals, name (currently synced from Jupiter verified list)
3. `STOCK_TICKERS` in `sync-asset-aliases.ts` → stock dedup (bestSuffix)
4. `seed-stock-tokens.ts` → stock mint addresses

To regenerate: run the sync prompt or (future) `sync-curated-assets.ts` script.
Do NOT hand-edit `curated-assets.ts` without checking against these sources.

---

## Curated Asset Inclusion Criteria (v1)

> **Principle**: If it's traded enough to show up in the data, it's traded enough to invest in. Don't be subjective about which tokens "deserve" to be in the list.

### Crypto inclusion rules

A crypto token belongs in `curated-assets.ts` if it meets ALL of:

1. **Tradeable on Jupiter**: Must have a valid SPL token mint that Jupiter can route. Jupiter can swap ANY SPL token by mint address — the "verified list" is just what shows up in their default UI. Currently we track verified tokens in the `TradeableAsset` table via `sync-jupiter-tokens.ts`, but unverified tokens can also be traded if we have their mint address (e.g., from Birdeye, which returns addresses during alias sync).
2. **Has a canonical alias**: Must be a target in `asset-aliases.json`. This means it was either in Birdeye top 300 by volume, or was manually added because KOLs discuss it.

That's it. If a token is tradeable on Jupiter AND is an alias target, it should be in the curated list. The Birdeye top 300 filter already excludes truly dead tokens, and manual additions reflect what KOLs actually talk about.

**Do NOT filter based on subjective "quality" judgments.** If a token has enough volume to be in the Birdeye top 300, it's a real trading target regardless of its name or theme.

### Crypto exclusion rules

Remove a crypto token from `curated-assets.ts` only if:

1. **Not tradeable on Jupiter**: No valid mint or Jupiter can't route it.
2. **Duplicate**: A wrapped/bridged version of a token already included AND they're fully fungible. Exception: different issuers with different trust profiles should BOTH be included (e.g., cbBTC and WBTC are both fine).
3. **No longer an alias target**: Dropped out of Birdeye top 300 and not manually curated.

### Stock inclusion rules

A stock belongs in `curated-assets.ts` if:

1. **Exists on xStocks and/or Ondo Global Markets** as a tokenized version on Solana.
2. **Has a `STOCK_TICKERS` entry** in `sync-asset-aliases.ts`.
3. **Only the most liquid version** (see Stock Deduplication below).

### When to re-evaluate

Run `sync-asset-aliases.ts` periodically (monthly or when adding KOLs). After each sync:
1. Check if new alias targets appeared that aren't in curated → look up mint, add them
2. Check if alias targets disappeared that are still in curated → evaluate removal
3. Check if any curated symbols lack aliases → add aliases

---

## Stock Deduplication

Most stocks exist on TWO platforms on Solana:
- **xStocks** (Backed Finance): symbol suffix `x`, 8 decimals. Example: `NVDAx`
- **Ondo Global Markets**: symbol suffix `on`, 9 decimals. Example: `NVDAon`

### The problem

If both exist, we need to pick ONE per ticker. We don't want the thesis LLM seeing both `NVDAx` and `NVDAon` — it would split allocations between what is economically the same position.

### How dedup works

The `STOCK_TICKERS` map in `sync-asset-aliases.ts` is the single source of truth. Each entry records which platforms offer the token and which has better liquidity:

```typescript
NVDA: {
  name: "NVIDIA",
  bestSuffix: "x",      // ← xStock wins (higher Birdeye liquidity)
  hasXstock: true,       // exists on xStocks
  hasOndo: true          // exists on Ondo
}
```

`bestSuffix` was determined by checking Birdeye liquidity data on 2026-03-01.

### Dedup at each tier

**Tier 1 (aliases)** — BOTH versions get aliases, but the bare ticker and company name map to the winner:
```json
{
  "nvda": "NVDAx",      // bare ticker → best version
  "nvidia": "NVDAx",    // company name → best version
  "nvdax": "NVDAx",     // explicit xStock request
  "nvdaon": "NVDAon"    // explicit Ondo request (user can force it)
}
```
This is auto-generated by `buildStockAliases()` in `sync-asset-aliases.ts`.

**Tier 2 (curated)** — ONLY the winner appears:
```typescript
{ symbol: "NVDAx", name: "NVIDIA", mint: "Xsc9qv...", decimals: 8, category: "stock" }
// NVDAon does NOT appear in curated-assets.ts
```

### Current split (77 stocks)

**xStock wins (37)**: AAPL, ABT, AMBR, AMZN, AZN, BRK.B, CMCSA, COIN, CRCL, CSCO, CVX, DFDV, DHR, GLD, GOOGL, HON, HOOD, LIN, LLY, MCD, MDT, META, MRK, MSTR, NVDA, OPEN, ORCL, PEP, PG, PM, QQQ, SPY, TBLL, TMO, TSLA, UNH, WMT

**Ondo wins (40)**: ABBV, ACN, AMD, APP, AVGO, BAC, BA, COST, CRM, CRWD, DIS, GME, GS, HD, IBM, INTC, IWM, JNJ, JPM, KO, MA, MRNA, MRVL, MSFT, NFLX, NKE, NVO, PFE, PLTR, PYPL, SHOP, SLV, SNOW, SPOT, TLT, TQQQ, UBER, V, VTI, XOM

### Re-evaluating the winner

Liquidity can shift over time. To update which version wins:
1. Check both versions on Birdeye for current 24h volume / TVL
2. Update `bestSuffix` in `STOCK_TICKERS`
3. Run `sync-asset-aliases.ts` to regenerate aliases
4. Update the entry in `curated-assets.ts` (swap the symbol and mint)

---

## How to Add an Asset

### Adding a crypto token

1. **Get the mint address**: From Jupiter, Birdeye, or Solscan. **Never guess mint addresses.**
2. **Add to `curated-assets.ts`**: Add a `CuratedAsset` entry with exact mint, decimals, symbol, name from the source.
3. **Add to `asset-aliases.json`**: Add lowercase aliases (symbol, name, common nicknames) → canonical symbol.
4. **Regenerate CSV**: Run the CSV export for audit trail.

### Adding a stock

1. **Check availability**: Does it exist on xStocks, Ondo, or both?
2. **Determine liquidity winner**: Check Birdeye for both versions.
3. **Add to `STOCK_TICKERS`** in `sync-asset-aliases.ts` with correct `bestSuffix`, `hasXstock`, `hasOndo`.
4. **Get the mint address** from `seed-stock-tokens.ts` (XSTOCKS or ONDO_TOKENS arrays).
5. **Add the winning version** to `curated-assets.ts`.
6. **Run `sync-asset-aliases.ts`** to regenerate aliases.

### Removing an asset

Keep the aliases even after removing from curated — the classifier still needs to recognize it in tweets. The rebalancer will sell out of the position as new snapshots exclude it.

---

## Sync State (as of 2026-03-01)

### Curated tokens missing aliases (30)

These are in `curated-assets.ts` but the classifier can't normalize them if a KOL mentions them by name. All need aliases added to `asset-aliases.json`:

21BTC, ai16z, BLZE, BOME, bSOL, cbBTC, CHILLGUY, CLOUD, FIDA, GOAT, GRASS, HONEY, INF, IOT, LST, LUCE, ME, META (MetaDAO), MEW, MOBILE, NEON, NOS, PENGU, POPCAT, PRCL, SAMO, SLERF, VIRTUAL, WBTC, WEN

### Alias targets not yet in curated (63 crypto)

These are recognized by the classifier but the thesis LLM can't allocate to them. Per inclusion criteria: if tradeable on Jupiter, add to `curated-assets.ts` with their mint address.

Note: Some alias targets (RBLX, SQ, NET) are actually stocks and should get `STOCK_TICKERS` entries instead of crypto entries.

---

## Invariants

These must always hold true:

1. Every symbol in `curated-assets.ts` must have at least one alias in `asset-aliases.json`.
2. Every stock in `curated-assets.ts` must be the `bestSuffix` version from `STOCK_TICKERS`.
3. `curated-assets.ts` must NOT contain both `XYZx` and `XYZon` for the same stock ticker.
4. Every mint address in `curated-assets.ts` must be a real, verified Solana token address. Never guess or fabricate.
5. The thesis LLM prompt must use `getCuratedAssetSymbols()`, never the full Jupiter token list.
6. If a token is tradeable on Jupiter AND is an alias target, it should be in `curated-assets.ts` (per inclusion criteria).

---

## Future Improvements

### `sync-curated-assets.ts` script
Automate the sync. Read alias targets, query `TradeableAsset` for mints, apply stock dedup, and regenerate `curated-assets.ts`. Same pattern as `sync-asset-aliases.ts`. This eliminates the manual sync prompt and makes `curated-assets.ts` truly derived.

### Expand mint sources beyond Jupiter verified list
Currently `sync-jupiter-tokens.ts` only imports Jupiter's verified list into `TradeableAsset`. But Jupiter can route ANY SPL token by mint address. The alias sync already fetches Birdeye top 300 which returns mint addresses — store those mints too so tokens that are high-volume on Birdeye but not Jupiter-verified can still be traded.

### Dynamic alias refresh via cron
Run `sync-asset-aliases.ts` on a weekly cron instead of manually. Birdeye top 300 changes as volume shifts — new tokens enter, old ones drop out. Automated sync keeps the alias system and curated list current without manual intervention.

### Liquidity-based stock dedup refresh
The xStock-vs-Ondo liquidity winner was checked once (2026-03-01). Build a script that re-checks Birdeye liquidity for all dual-listed stocks and updates `bestSuffix` in `STOCK_TICKERS` automatically.

### Mint validation on curated-assets.ts
Add a CI check or script that verifies every mint in `curated-assets.ts` actually exists on-chain (RPC `getAccountInfo`). Catches typos or deactivated tokens before they reach production.

### Alias coverage check
Add a script that compares curated symbols vs alias targets and flags desync. Could run as a pre-deploy check to enforce invariant #1 (every curated symbol has an alias).
