# State of RWA (Real World Assets) on Solana

> Last updated: March 5, 2026

## Overview

Tokenized stocks on Solana come from two providers relevant to Omaha: **xStocks (Backed Finance)** and **Ondo GM Tokens**. Of 63 xStocks, **40 are tradeable** via Jupiter swap/v1 (v6 aggregator) through AMM pools — these are GLAM-compatible and form the curated stock list. Ondo tokens route exclusively via **JupiterZ RFQ** (Ultra API), which GLAM does not yet support.

**Exception**: SLVon (Silver ETF, Ondo) is tradeable via Meteora DLMM on swap/v1.

## Jupiter API Landscape

| API | Endpoint | Program | GLAM compatible |
|-----|----------|---------|-----------------|
| Swap v1 (v6 aggregator) | `api.jup.ag/swap/v1/quote` | `JUP6LkbF...` | **Yes** |
| Ultra API (RFQ) | `api.jup.ag/ultra/v1/order` | `61DFfeTKM7trxYcPQCM78bJ794ddZprZpAwAnLiwTpYH` (JupiterZ) | **No** |
| Price API | `api.jup.ag/price/v3` | N/A | N/A |

GLAM's `jupiter_swap` CPI hardcodes Jupiter v6 program as the target. JupiterZ uses a different program (`61DFfeTKM7...`), so Ultra API routes cannot execute through GLAM vaults. Message sent to GLAM team requesting JupiterZ support.

## xStocks (Backed Finance)

| Property | Value |
|----------|-------|
| Symbol suffix | `x` (e.g., NVDAx, TSLAx, AAPLx) |
| Decimals | 8 |
| Token program | Token-2022 |
| Total minted | ~63 |
| Tradeable on swap/v1 | **40** (AMM pool liquidity) |
| Illiquid (TOKEN_NOT_TRADABLE) | 19 |
| Illiquid (NO_ROUTES_FOUND) | 4 |

### 40 Tradeable xStocks (in curated-assets.ts)

AAPLx, ABTx, ACNx, AMBRx, AMZNx, AVGOx, AZNx, BRK.Bx, CMCSAx, COINx, CRCLx, CSCOx, CVXx, DFDVx, GMEx, GOOGLx, HOODx, JNJx, JPMx, LLYx, MAx, MCDx, METAx, MRKx, MSFTx, MSTRx, NFLXx, NVDAx, ORCLx, PEPx, PGx, TSLAx, UNHx, Vx, WMTx, XOMx + QQQx, SPYx, TQQQx (index) + GLDx (commodity)

### 23 Illiquid xStocks (commented out)

TOKEN_NOT_TRADABLE: ABBVx, APPx, BACx, CRMx, CRWDx, DHRx, GSx, HDx, HONx, IBMx, INTCx, KOx, LINx, MDTx, MRVLx, NVOx, OPENx, PFEx, PMx, PLTRx, TMOx, TBLLx
NO_ROUTES_FOUND: 4 additional (no established AMM pools)

## Ondo GM Tokens

| Property | Value |
|----------|-------|
| Symbol suffix | `on` (e.g., PLTRon, JPMon, NVDAon) |
| Decimals | 9 |
| Token program | Token-2022 |
| Jupiter swap/v1 | **All return TOKEN_NOT_TRADABLE** (except SLVon) |
| Jupiter Ultra API | **Works** — routes via JupiterZ RFQ |
| Ultra swapType | `rfq` |
| Ultra router | `jupiterz` |
| Ultra program | `61DFfeTKM7trxYcPQCM78bJ794ddZprZpAwAnLiwTpYH` |
| Jupiter Price API | Works for all |
| Count | ~203 tokens (all Jupiter-verified) |

### Why Ondo is Blocked

1. **swap/v1**: Returns `TOKEN_NOT_TRADABLE` — no AMM pool routing
2. **Ultra API**: Routes via JupiterZ RFQ — works on Jupiter UI but...
3. **GLAM CPI**: Hardcodes Jupiter v6 program — cannot execute JupiterZ transactions
4. **Result**: Ondo swaps are impossible through GLAM vaults until GLAM adds JupiterZ support

### SLVon Exception

SLVon (Silver ETF) has a Meteora DLMM pool (`AgFQsqiS5QCRgvFyAaBefTMcy8DxwZeAnbiUJARGW5kY`) that Jupiter swap/v1 routes through. This is the only Ondo token tradeable via the v6 aggregator.

## Impact on Pipeline

| Stage | xStocks (40) | Ondo | SLVon |
|-------|-------------|------|-------|
| Alias matching | Works | Works (aliases exist) | Works |
| Thesis (curated list) | **Active** | Commented out | **Active** |
| Backtest (prices) | Works | Would work but excluded | Works |
| Rebalancing (swap) | **Works** (swap/v1) | **Blocked** (no GLAM JupiterZ) | **Works** (swap/v1) |

## When to Re-enable Ondo

Re-enable Ondo tokens when **either**:
1. GLAM adds JupiterZ CPI support (most likely path)
2. Ondo tokens get AMM pools that Jupiter swap/v1 routes through

Monitor: GLAM SDK changelog, Jupiter aggregator updates.

## Testing Tradeability

```bash
# Test swap/v1 (GLAM-compatible)
curl -s -H "x-api-key: $JUPITER_API_KEY" \
  "https://api.jup.ag/swap/v1/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=<MINT>&amount=1000000&slippageBps=50"

# Test Ultra API (JupiterZ RFQ — NOT GLAM-compatible)
curl -s -H "x-api-key: $JUPITER_API_KEY" \
  "https://api.jup.ag/ultra/v1/order?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=<MINT>&amount=1000000"
```

- No `error` = tradeable
- `TOKEN_NOT_TRADABLE` = no AMM route on swap/v1
- `NO_ROUTES_FOUND` = no route at all
