# State of RWA (Real World Assets) on Solana

> Last updated: March 5, 2026

## Overview

Tokenized stocks on Solana come from three providers: **xStocks (Backed Finance)**, **Ondo GM Tokens**, and **Remora rStocks**. Only some xStocks are fully tradeable via Jupiter's swap API, making them the primary option for automated vault rebalancing. One Ondo token (SLVon) is also tradeable via Meteora DLMM.

## Providers

### xStocks (Backed Finance)

| Property | Value |
|----------|-------|
| Symbol suffix | `x` (e.g., NVDAx, TSLAx, AAPLx) |
| Decimals | 8 |
| Token program | Token-2022 |
| Jupiter swap | **Works for most** — AMM pool liquidity |
| Jupiter price | **Works** |
| Count | ~63 tokens minted, but not all have swap routes |
| Liquidity | Good for majors (NVDAx: ~$2.5M TVL, ~$733K daily volume) |
| `freezeAuthority` | Set (same as Ondo) |

**Status**: Primary provider for thesis + rebalancing pipeline. ~33 xStocks in curated list.

**Important nuance**: Not all xStocks have Jupiter swap routes. For example, PLTRx exists (11 holders) but returns `NO_ROUTES_FOUND` on Jupiter swap API. Only xStocks with established AMM pools work.

### Ondo GM Tokens

| Property | Value |
|----------|-------|
| Symbol suffix | `on` (e.g., PLTRon, JPMon, NVDAon) |
| Decimals | 9 |
| Token program | Token-2022 |
| Jupiter swap | **39/40 return `TOKEN_NOT_TRADABLE`** — only SLVon works |
| Jupiter price | **Works for some** — tracks real stock prices via `stockData` |
| Count | ~203 tokens (all Jupiter-verified) |
| Liquidity | Varies: some have pools (PLTRon: $61K TVL) but Jupiter won't route through them |
| `freezeAuthority` | Set on all tokens |

**Status**: All commented out from `curated-assets.ts` except **SLVon** (Silver ETF), which has an active Meteora DLMM pool that Jupiter routes through.

### Remora rStocks

Discovered during PLTRon research. Example: `PPLTr` (Platinum rStock).

| Property | Value |
|----------|-------|
| Symbol suffix | `r` (e.g., PPLTr) |
| Decimals | 9 |
| Token program | Token-2022 |
| Liquidity | PPLTr: $15.7K TVL, 291 holders |

**Status**: Not investigated further. Not in curated list.

## Detailed Tradeability Audit (March 5, 2026)

All 40 Ondo tokens in `curated-assets.ts` were tested against `https://api.jup.ag/swap/v1/quote` (USDC input, $1 amount, 50bps slippage):

### Tradeable (1/40)

| Token | Route | Pool |
|-------|-------|------|
| **SLVon** (Silver ETF) | Meteora DLMM | `AgFQsqiS5QCRgvFyAaBefTMcy8DxwZeAnbiUJARGW5kY` |

### Not Tradeable — `TOKEN_NOT_TRADABLE` (38/40)

ABBVon, ACNon, AMDon, APPon, AVGOon, BACon, BAon, COSTon, CRMon, CRWDon, DISon, GSon, HDon, IBMon, INTCon, JNJon, JPMon, KOon, MAon, MRNAon, MRVLon, MSFTon, NFLXon, NKEon, NVOon, PFEon, PLTRon, PYPLon, SHOPon, SNOWon, SPOTon, TLTon, TQQQon, UBERon, Von, VTIon, XOMon, IWMon

### Not Tradeable — `NO_ROUTES_FOUND` (1/40)

GMEon

## The Pool Paradox: Pools Exist But Jupiter Won't Route

This is the most confusing finding. Some Ondo tokens **have on-chain pools with real TVL**, yet Jupiter's swap API still returns `TOKEN_NOT_TRADABLE`.

### PLTRon Case Study

Data from Birdeye (March 5, 2026):

| Property | Value |
|----------|-------|
| Price | $153.73 |
| Market cap | $1.87M |
| TVL | **$61K** |
| 24h buy volume | $261 |
| Holders | 26 |
| First pool created | 2025-12-31 |
| Pool address | `HfsnTS5qtdStwec9DfBrunRqnAMYMMz1kjv9Hu9ondo` |
| Jupiter verified | Yes (`["verified", "token-2022"]`) |
| Stock price tracking | Yes ($154.52 real price) |
| Jupiter swap result | **`TOKEN_NOT_TRADABLE`** |

So PLTRon has a pool, TVL, holders, volume, accurate pricing — but Jupiter refuses to route through it.

### Why Jupiter Won't Route

Likely reasons (not confirmed by Jupiter team):
1. **`freezeAuthority` is set** — Jupiter may blacklist tokens where the issuer can freeze transfers, since a swap could fail mid-execution
2. **Token-2022 transfer hooks** — Some Token-2022 tokens have transfer hooks that can reject transactions; Jupiter may not support the specific hook configuration
3. **Pool not whitelisted** — Jupiter's aggregator may require pools to meet minimum criteria (TVL, age, volume) that these pools don't meet
4. **Explicit token blocklist** — Jupiter may maintain a blocklist for tokens with restrictive transfer policies

### SLVon Exception

SLVon works despite also being an Ondo token with `freezeAuthority`. Its Meteora DLMM pool (`AgFQsqiS5QCRgvFyAaBefTMcy8DxwZeAnbiUJARGW5kY`) is whitelisted by Jupiter. This suggests the issue is pool-specific whitelisting rather than a blanket Ondo ban.

### PLTRx (xStocks) Also Has No Route

PLTRx exists with 11 holders, but also returns `NO_ROUTES_FOUND`. This confirms the issue isn't Ondo-specific — any stock token without an established Jupiter-whitelisted pool is non-tradeable via the rebalancer.

## Why Ondo Tokens Can't Be Minted on Solana

The Ondo app (app.ondo.finance) only offers minting on:
- Ethereum
- BNB Chain

**Solana is NOT available** as a minting chain (verified March 5, 2026).

The Ondo tokens that exist on Solana likely arrived via:
- Wormhole or other cross-chain bridges from Ethereum/BNB
- Ondo's institutional distribution channels
- Direct transfers from Ondo's treasury

This means you cannot get new Ondo tokens onto Solana without first minting on ETH/BNB and bridging — adding gas costs and bridge fees.

## On-Chain Liquidity Data (March 5, 2026)

### Ondo Tokens (Birdeye)

| Token | 24h Volume | TVL | Price | Holders | Pools |
|-------|-----------|-----|-------|---------|-------|
| PLTRon | $261 (buy) | $61K | $153.73 | 26 | 1 |
| PYPLon | $4.0K | $12.6K | $47.82 | — | — |
| MAon | $508 | $10.2K | $522.94 | — | — |
| JPMon | $1.3K | $110 | $297.35 | — | — |
| BACon | $0 | $124 | $51.97 | — | — |
| WFCon | $0 | $0 | $0 | — | — |

### xStocks (Birdeye, from earlier compare-liquidity runs)

| Token | 24h Volume | TVL |
|-------|-----------|-----|
| NVDAx | ~$733K | ~$2.5M |
| TSLAx | ~$200K+ | ~$500K+ |

xStocks have orders of magnitude more liquidity than Ondo tokens.

## Impact on the Pipeline

| Pipeline Stage | xStocks | Ondo |
|---------------|---------|------|
| Classification (alias matching) | Works | Works |
| Thesis generation (LLM allocation) | Works (in curated list) | Blocked (removed from curated list, except SLVon) |
| Backtest (price history) | Works | Would work (prices available) but excluded |
| Rebalancing (Jupiter swap) | Works (for tokens with routes) | Blocked (`TOKEN_NOT_TRADABLE`) except SLVon |
| GLAM vault holdings | Works | Unknown (Token-2022 + freezeAuthority may cause issues) |

## Stocks Not Available on Either Provider

Some stocks mentioned by KOLs have no tradeable tokenized version on Solana:

| Stock | Ticker | xStocks | Ondo | Status |
|-------|--------|---------|------|--------|
| Fannie Mae | FNMA | No | No | No proxy available |
| Freddie Mac | FMCC | No | No | No proxy available |
| Shift4 Payments | FOUR | No | No | No proxy available |
| Palantir | PLTR | PLTRx (no route) | PLTRon (not tradeable) | Both exist but neither is swappable |

For these, there is currently no tradeable proxy on Solana. The closest approach would be sector-based proxies (e.g., financial sector xStocks like BRK.Bx for FNMA), but correlation would be imperfect.

## Recommendations

1. **Use xStocks exclusively** for the trading pipeline — they're the only tokens that reliably work end-to-end
2. **Keep SLVon** — the only Ondo token with a working Jupiter swap route
3. **Monitor Ondo's Solana support** — if they add Solana minting or Jupiter adds routes, re-enable Ondo tokens
4. **Track Ondo prices for informational purposes** — Jupiter Price API works for some, useful for dashboards
5. **Request new tickers from Backed Finance** — if specific stocks are needed (e.g., PLTR), Backed (xStocks) is more likely to get Jupiter routing since they already have it for ~33 tokens
6. **Consider direct DEX swaps** — for tokens like PLTRon that have pools but no Jupiter route, a direct swap through the pool's DEX (bypassing Jupiter) could work, but the rebalancer would need significant changes

## Liquidity Comparison Tool

Use the built-in script to compare on-chain liquidity between tokens:

```bash
set -a && source .env && set +a && \
  pnpm --filter @repo/back exec tsx src/scripts/compare-liquidity.ts <mint1> <mint2> [mint3...]
```

Requires `BIRDEYE_API_KEY` and optionally `JUPITER_API_KEY` in `.env`.

Composite score: 40% volume + 30% TVL + 30% inverse price impact.

**Caveat**: Ondo tokens score 0 on Jupiter impact (no routes) even if Birdeye shows TVL. The script uses Jupiter Ultra (`lite-api.jup.ag/ultra/v1/quote`) which returns 404 for non-tradeable tokens.

## Testing Tradeability

To check if a specific token is tradeable via Jupiter:

```bash
set -a && source .env && set +a && \
  curl -s -H "x-api-key: $JUPITER_API_KEY" \
  "https://api.jup.ag/swap/v1/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=<MINT>&amount=1000000&slippageBps=50"
```

- No `error` field = tradeable
- `TOKEN_NOT_TRADABLE` = Jupiter won't route (pool may exist but isn't whitelisted)
- `NO_ROUTES_FOUND` = no known route at all
