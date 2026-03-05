# State of RWA (Real World Assets) on Solana

> Last updated: March 2026

## Overview

Tokenized stocks on Solana come from two providers: **xStocks (Backed Finance)** and **Ondo GM Tokens**. Only xStocks are fully tradeable via Jupiter's swap API, making them the only viable option for automated vault rebalancing.

## Providers

### xStocks (Backed Finance)

| Property | Value |
|----------|-------|
| Symbol suffix | `x` (e.g., NVDAx, TSLAx, AAPLx) |
| Decimals | 8 |
| Token program | Token-2022 |
| Jupiter swap | **Works** — AMM pool liquidity |
| Jupiter price | **Works** |
| Count | ~63 tokens |
| Liquidity | Good (NVDAx: ~$2.5M TVL, ~$733K daily volume) |

**Status**: Fully operational for thesis + rebalancing pipeline.

### Ondo GM Tokens

| Property | Value |
|----------|-------|
| Symbol suffix | `on` (e.g., PLTRon, JPMon, NVDAon) |
| Decimals | 9 |
| Token program | Token-2022 |
| Jupiter swap | **Does NOT work** — returns `TOKEN_NOT_TRADABLE` |
| Jupiter price | **Works** — tracks real stock prices via `stockData` |
| Count | ~203 tokens (all Jupiter-verified) |
| Liquidity | Very low on Solana (JPMon: ~$110 TVL; PLTRon: ~$61K TVL) |
| Transfer restrictions | `freezeAuthority` set on all tokens |

**Status**: Commented out from `curated-assets.ts` — cannot be used for vault rebalancing.

## Why Ondo Tokens Don't Work on Solana

### 1. Not Tradeable via Jupiter Swap API

Jupiter's swap API returns `TOKEN_NOT_TRADABLE` for all Ondo tokens. This is because Ondo tokens don't have AMM pools on Solana — their liquidity comes from Ondo's own mint/redeem mechanism, which only operates on **Ethereum** and **BNB Chain**.

### 2. Cannot Mint on Solana

The Ondo app (app.ondo.finance) only offers minting on:
- Ethereum
- BNB Chain

Solana is **not available** as a minting chain. The Ondo tokens that exist on Solana likely arrived via:
- Wormhole bridging from Ethereum/BNB
- Ondo's institutional distribution channels

### 3. Near-Zero On-Chain Liquidity

Birdeye data shows extremely low liquidity for Ondo tokens on Solana:

| Token | 24h Volume | TVL |
|-------|-----------|-----|
| JPMon | $1.3K | $110 |
| PLTRon | $542 | $61K |
| BACon | $0 | $124 |
| WFCon | $0 | $0 |

Most tokens have no trading activity at all.

### 4. `TOKEN_NOT_TRADABLE` Does NOT Mean No Liquidity

Important distinction: Ondo tokens return `TOKEN_NOT_TRADABLE` on Jupiter swap because they lack AMM pools, but they:
- **Have valid prices** on Jupiter Price API (`api.jup.ag/price/v3`)
- **Track real stock prices** accurately via Ondo's oracle
- **Are verified** on Jupiter with tags `["verified", "token-2022"]`

This means they work for **price tracking** and **backtesting** but NOT for **actual trading**.

## Impact on the Pipeline

| Pipeline Stage | xStocks | Ondo |
|---------------|---------|------|
| Classification (alias matching) | Works | Works |
| Thesis generation (LLM allocation) | Works (in curated list) | Blocked (removed from curated list) |
| Backtest (price history) | Works | Would work (prices available) but excluded |
| Rebalancing (Jupiter swap) | Works | Blocked (`TOKEN_NOT_TRADABLE`) |
| GLAM vault holdings | Works | Unknown (Token-2022 + freezeAuthority may cause issues) |

## Stocks Not Available on Either Provider

Some stocks mentioned by KOLs have no tokenized version on Solana:
- **FNMA** (Fannie Mae) — not on xStocks or Ondo
- **FOUR** (Shift4 Payments) — not on xStocks or Ondo
- **FMCC** (Freddie Mac) — not on xStocks or Ondo

For these, there is currently no tradeable proxy on Solana. The closest approach would be sector-based proxies (e.g., financial sector xStocks like BRK.Bx for FNMA), but correlation would be imperfect.

## Recommendations

1. **Use xStocks exclusively** for the trading pipeline — they're the only tokens that work end-to-end
2. **Monitor Ondo's Solana support** — if they add Solana minting or Jupiter adds routes, re-enable Ondo tokens
3. **Track Ondo prices for informational purposes** — Jupiter Price API works, useful for dashboards
4. **Request new tickers from Backed Finance** — if specific stocks are needed, Backed (xStocks) is more likely to support them on Solana

## Liquidity Comparison Tool

Use the built-in script to compare on-chain liquidity between tokens:

```bash
set -a && source .env && set +a && \
  pnpm --filter @repo/back exec tsx src/scripts/compare-liquidity.ts <mint1> <mint2> [mint3...]
```

Requires `BIRDEYE_API_KEY` and optionally `JUPITER_API_KEY` in `.env`.

Composite score: 40% volume + 30% TVL + 30% inverse price impact.

**Caveat**: Ondo tokens score 0 on Jupiter impact (no routes) even if Birdeye shows some TVL.
