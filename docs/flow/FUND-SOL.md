# Fund SOL Flow

> USDC → SOL swap so users can pay Solana transaction fees.

Users on Omaha hold USDC in their Privy embedded wallet. Solana requires SOL to pay transaction fees (subscribing to vaults, withdrawing, etc.). This flow lets users convert a small amount of USDC to SOL directly from the profile screen.

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  MOBILE APP                                                  │
│                                                              │
│  Profile screen → "Fund SOL" button                          │
│  ↓                                                           │
│  FundSolSheet                                                │
│  ├── AmountPicker ($1 / $2 / $5 / $10)                      │
│  ├── 2% platform fee warning                                 │
│  └── "Swap $X USDC to SOL" button                            │
│       ↓                                                      │
│  useFundSol() mutation fires                                 │
└──────────────┬───────────────────────────────────────────────┘
               │
               │  POST /api/swap/fund-sol
               │  { amountUsd, signerPublicKey }
               │  (Privy auth required)
               ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND                                                     │
│                                                              │
│  1. Validate request (Zod: $1–$10 integer)                   │
│  2. Check user SOL balance (reject if ≥ 0.05 SOL)           │
│  3. buildFundSolPlan()                                       │
│     ├── Calculate platform fee (amount × 2%)                 │
│     ├── Calculate swap amount (amount − fee)                 │
│     ├── Jupiter quote: USDC → SOL (1% slippage)             │
│     ├── Validate price impact (< 100 bps)                    │
│     └── Get Jupiter swap instructions                        │
│  4. buildFundSolTransaction()                                │
│     ├── Compute budget (400k CU, 100k µLamports)            │
│     ├── USDC transfer: user ATA → fee payer ATA (2% fee)    │
│     ├── Jupiter setup / swap / cleanup instructions          │
│     ├── Fee payer = platform keypair (pays Solana tx fee)    │
│     └── Partial sign with fee payer keypair                  │
│  5. Return { transaction (base64), quote }                   │
└──────────────┬───────────────────────────────────────────────┘
               │
               │  Partially-signed transaction (base64)
               ▼
┌──────────────────────────────────────────────────────────────┐
│  MOBILE APP                                                  │
│                                                              │
│  1. Deserialize transaction from base64                      │
│  2. Privy wallet signs (adds user signature)                 │
│  3. Send to Solana RPC (skipPreflight: true)                 │
│  4. Wait for on-chain confirmation                           │
│  5. Show success screen with tx signature                    │
│  6. Invalidate portfolio query (refresh balances)            │
└──────────────────────────────────────────────────────────────┘
```

## Transaction Structure

A single Solana transaction containing these instructions in order:

| #   | Instruction                              | Purpose                           |
| --- | ---------------------------------------- | --------------------------------- |
| 1   | `setComputeUnitLimit(400k)`              | Reserve compute units             |
| 2   | `setComputeUnitPrice(100k µLamports)`    | Priority fee for inclusion        |
| 3   | `createAssociatedTokenAccountIdempotent` | Ensure fee payer USDC ATA exists  |
| 4   | `transferChecked` (USDC)                 | Platform fee: user → fee payer    |
| 5   | Jupiter setup instructions               | ATA creation, wSOL wrapping, etc. |
| 6   | Jupiter swap instruction                 | USDC → SOL via Jupiter aggregator |
| 7   | Jupiter cleanup instruction              | Close temp accounts (if any)      |

**Signers:**

- Fee payer keypair (partial sign on backend — pays Solana tx fee)
- User wallet (signs on device via Privy — authorizes USDC spend)

## Constraints

| Constraint       | Value        | Rationale                               |
| ---------------- | ------------ | --------------------------------------- |
| Min amount       | $1           | Minimum useful gas top-up               |
| Max amount       | $10          | Prevent accidental large swaps          |
| Max SOL balance  | 0.05 SOL     | Reject if user already has enough       |
| Platform fee     | 2%           | Configurable via `FUND_SOL_FEE_PCT`     |
| Slippage         | 1% (100 bps) | Higher tolerance for small amounts      |
| Max price impact | 1% (100 bps) | Configurable via `MAX_PRICE_IMPACT_BPS` |

## Environment Variables

| Variable                | Required | Default | Description                                                                               |
| ----------------------- | -------- | ------- | ----------------------------------------------------------------------------------------- |
| `FEE_PAYER_PRIVATE_KEY` | Yes      | —       | Keypair that pays Solana tx fees. Supports base58 (Phantom), base64, or JSON array format |
| `FUND_SOL_FEE_PCT`      | No       | `2`     | Platform fee percentage deducted from swap                                                |
| `SOLANA_RPC_URL`        | Yes      | —       | Solana RPC endpoint                                                                       |
| `JUPITER_API_KEY`       | Yes      | —       | Jupiter aggregator API key                                                                |
| `MAX_PRICE_IMPACT_BPS`  | No       | `100`   | Max acceptable price impact in basis points                                               |

These must be listed in `turbo.json` `globalEnv` for Turborepo to forward them.

## Source Files

### Backend

| File                                                 | Responsibility                                       |
| ---------------------------------------------------- | ---------------------------------------------------- |
| `apps/back/src/routes/swap/index.ts`                 | Route registration (auth middleware)                 |
| `apps/back/src/routes/swap/handlers/fund-sol.ts`     | Request validation, balance check, orchestration     |
| `apps/back/src/services/fund-sol.service.ts`         | Jupiter quote, fee calculation, instruction fetching |
| `apps/back/src/services/fund-sol-tx.builder.ts`      | Transaction assembly, fee payer partial signing      |
| `apps/back/src/services/jupiter-instruction.util.ts` | Jupiter instruction deserialization                  |
| `apps/back/src/services/jupiter-swap.service.ts`     | Jupiter quote API, price impact validation           |
| `apps/back/src/solana/config.ts`                     | Fee payer keypair loading, Solana constants          |

### Shared

| File                                             | Responsibility                               |
| ------------------------------------------------ | -------------------------------------------- |
| `packages/shared/src/types/fund-sol.ts`          | `FundSolQuote`, `FundSolResponse` interfaces |
| `packages/shared/src/schemas/fund-sol.schema.ts` | `fundSolRequestSchema` (Zod validation)      |

### Mobile

| File                                                         | Responsibility                               |
| ------------------------------------------------------------ | -------------------------------------------- |
| `apps/native/app/(app)/(tabs)/(profile)/fund-sol.tsx`        | Screen entry point                           |
| `apps/native/components/profile/fund-sol/FundSolSheet.tsx`   | Amount picker, swap button, warning notice   |
| `apps/native/components/profile/fund-sol/AmountPicker.tsx`   | $1/$2/$5/$10 selection chips                 |
| `apps/native/components/profile/fund-sol/FundSolSuccess.tsx` | Success screen with tx signature             |
| `apps/native/hooks/mutations/use-fund-sol.ts`                | React Query mutation (sign + send + confirm) |

## Key Design Decisions

1. **Platform pays Solana tx fee** — The fee payer keypair covers the ~0.000005 SOL transaction fee so users with zero SOL can still execute the swap. Without this, users would need SOL to get SOL (chicken-and-egg problem).

2. **Partial signing** — Backend signs with the fee payer keypair, serializes the transaction, and sends it to the client. The client adds the user's signature via Privy and submits to the network. This keeps the fee payer private key server-side.

3. **Balance gate at 0.05 SOL** — Prevents users from accumulating excessive SOL. This is a gas fund feature, not a trading feature.

4. **skipPreflight on client** — The Privy embedded wallet may use a different RPC than the backend. Preflight simulation on a mismatched RPC can fail even for valid transactions.
