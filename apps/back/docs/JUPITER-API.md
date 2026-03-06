# Jupiter API Reference

> Official examples & SDK: https://github.com/Jupiter-DevRel
> TypeScript examples (swap, ultra, trigger, recurring): https://github.com/Jupiter-DevRel/typescript-examples

## Authentication

API key is stored in `.env` as `JUPITER_API_KEY`. Always pass it as a header:

```
x-api-key: <JUPITER_API_KEY>
```

## Endpoints

### Swap Quote — `GET https://api.jup.ag/swap/v1/quote`

Used by the rebalancer to get quotes before executing on-chain swaps.

| Param | Required | Description |
|-------|----------|-------------|
| `inputMint` | Yes | Token mint address |
| `outputMint` | Yes | Token mint address |
| `amount` | Yes | Raw amount in smallest unit (lamports / atomic units) |
| `slippageBps` | Yes | Acceptable slippage in basis points (50 = 0.5%) |
| `onlyDirectRoutes` | No | Restrict to single-hop routes |
| `restrictIntermediateTokens` | No | Route only through liquid intermediate tokens |

**Files**: `jupiter-swap.service.ts`, `fund-sol.service.ts`

### Swap Instructions — `POST https://api.jup.ag/swap/v1/swap-instructions`

Builds the on-chain transaction instructions from a quote.

```json
{
  "quoteResponse": { ... },
  "userPublicKey": "<wallet or vault PDA>"
}
```

**File**: `jupiter-swap.service.ts`

### Price API — `GET https://api.jup.ag/price/v3`

Fetches current USD prices for one or more tokens.

```
GET https://api.jup.ag/price/v3?ids=<mint1>,<mint2>,...
```

Returns `usdPrice`, `priceChange24h`, and `stockData` (with real stock price for tokenized stocks).

**File**: `token-price.service.ts`

### Token Lists — `GET https://api.jup.ag/tokens/v2/tag?query=verified`

Returns all Jupiter-verified tokens (~4500+). Useful for checking if a token is listed.

Other endpoints:
- `GET https://api.jup.ag/tokens/v1/all` — all tokens (large response)
- `GET https://api.jup.ag/tokens/v1/search?query=<symbol>` — search by name/symbol

### Jupiter Ultra — `GET https://lite-api.jup.ag/ultra/v1/quote`

Alternative quote endpoint used by the `compare-liquidity.ts` script. Same params as swap quote. Returns `priceImpactPct` and `swapType` (aggregator vs rfq).

See examples: https://github.com/Jupiter-DevRel/typescript-examples/tree/main/ultra

## Token Providers on Solana

### xStocks (Backed Finance)

| Property | Value |
|----------|-------|
| Symbol suffix | `x` (e.g., NVDAx, TSLAx, AAPLx) |
| Decimals | 8 |
| Token program | Token-2022 |
| Jupiter swap | **Works** — AMM pool liquidity |
| Count | ~63 tokens |

### Ondo GM Tokens

| Property | Value |
|----------|-------|
| Symbol suffix | `on` (e.g., PLTRon, JPMon, NVDAon) |
| Decimals | 9 |
| Token program | Token-2022 |
| Jupiter swap | **Does NOT work** — returns `TOKEN_NOT_TRADABLE` |
| Jupiter price | **Works** — tracks real stock price via `stockData` |
| Liquidity source | Ondo mint/redeem mechanism (not AMM pools) |
| Count | ~203 tokens (all in Jupiter verified list) |
| Transfer restrictions | `freezeAuthority` set on all tokens |

### Critical: `TOKEN_NOT_TRADABLE` Does NOT Mean No Liquidity

Ondo tokens return `TOKEN_NOT_TRADABLE` on the Jupiter swap API because they don't have AMM pools. However:
- They **have valid prices** on the Jupiter Price API
- Prices **track real stock prices** accurately (via Ondo's oracle)
- They are **verified** on Jupiter with the tags `["verified", "token-2022"]`
- Liquidity exists via **Ondo's own mint/redeem** mechanism

**Implications for the codebase:**
- **Thesis/backtest**: Ondo tokens work fine (prices available via Price API)
- **Vault rebalancing**: Only xStocks can be swapped via Jupiter. Ondo tokens will fail at swap time.
- **Curated assets**: Both xStocks and Ondo tokens are valid for the curated list, but only xStocks are executable via the rebalancer

## Liquidity Comparison

Script: `src/scripts/compare-liquidity.ts`

```bash
set -a && source .env && set +a && \
  pnpm --filter @repo/back exec tsx src/scripts/compare-liquidity.ts <mint1> <mint2> [mint3...]
```

Uses two data sources:
1. **Birdeye** (`BIRDEYE_API_KEY` required) — 24h volume + TVL
2. **Jupiter Ultra** — price impact at $1K / $10K / $50K

Composite score: `40% volume + 30% TVL + 30% inverse price impact`

**Caveat**: Ondo tokens will score 0 on Jupiter impact (no routes) even if they have Birdeye TVL. Use the Price API to verify they are priced.

## Deprecated / Wrong Endpoints

Do NOT use these:
- `https://api.jup.ag/quote/v1` — old endpoint, different error format
- `https://lite-api.jup.ag/ultra/v1/quote` for tradability checks — returns 404 for Ondo tokens

Always use `https://api.jup.ag/swap/v1/quote` for swap quotes and `https://api.jup.ag/price/v3` for prices.
