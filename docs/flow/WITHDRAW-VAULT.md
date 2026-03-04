# Withdraw from Vault Flow

> Redeem vault shares → fulfill batch → claim USDC back to wallet.

Users invest USDC into KOL vaults (GLAM Protocol tokenized vaults on Solana). When they want to exit a position, this multi-step withdrawal flow redeems their vault shares and returns USDC to their Privy embedded wallet. The process uses GLAM's queued redemption model with asynchronous batch fulfillment.

## Status Lifecycle

```
REQUESTED → PROCESSING → CLAIMABLE → CLAIMED
                │              │
              FAILED         FAILED
                │
              REMOVED (soft-delete for retry)
```

| Status | Meaning |
| --- | --- |
| `REQUESTED` | User submitted unsigned redeem tx, DB record created |
| `PROCESSING` | User signed & submitted redeem tx on-chain, backend confirmed |
| `CLAIMABLE` | Backend fulfilled the batch (vault manager signed), ready to claim |
| `CLAIMED` | User claimed tokens, withdrawal complete |
| `FAILED` | Error during processing or fulfillment, user can retry |
| `REMOVED` | Soft-deleted (idempotency key reassigned), allows immediate retry |

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  MOBILE APP                                                  │
│                                                              │
│  Vault detail screen → "Withdraw" button                     │
│  ↓                                                           │
│  WithdrawScreen                                              │
│  ├── Amount input (with MAX button, balance display)         │
│  ├── Timeline cards showing current status                   │
│  └── "Withdraw" button                                       │
│       ↓                                                      │
│  useRequestWithdrawal() mutation fires                       │
└──────────────┬───────────────────────────────────────────────┘
               │
               │  STEP 1: REQUEST (Redeem)
               │  POST /api/withdrawals/{vaultId}/request
               │  { amount, signerPublicKey }
               │  (Privy auth required)
               ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND                                                     │
│                                                              │
│  1. Validate request (Zod: positive amount, valid pubkey)    │
│  2. Check idempotency (same user + vault + batch window)     │
│  3. Create WithdrawalRequest record (status: REQUESTED)      │
│  4. Build unsigned redeem transaction:                        │
│     ├── ComputeBudgetProgram.setComputeUnitLimit(400k)       │
│     ├── ComputeBudgetProgram.setComputeUnitPrice(50k µL)     │
│     └── glamClient.invest.txBuilder.queuedRedeemIx()         │
│  5. Return { transaction (base64), withdrawalId }            │
└──────────────┬───────────────────────────────────────────────┘
               │
               │  Unsigned transaction (base64)
               ▼
┌──────────────────────────────────────────────────────────────┐
│  MOBILE APP                                                  │
│                                                              │
│  1. Deserialize transaction from base64                      │
│  2. Privy wallet signs (user signature)                      │
│  3. Send to Solana RPC (skipPreflight: true)                 │
│  4. Wait for on-chain confirmation                           │
│  5. POST /api/withdrawals/{withdrawalId}/confirm-redeem      │
│     { txSignature }                                          │
└──────────────┬───────────────────────────────────────────────┘
               │
               │  STEP 2: CONFIRM REDEEM → PROCESSING
               ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND                                                     │
│                                                              │
│  1. Verify redeem tx landed on-chain                         │
│  2. Update status: REQUESTED → PROCESSING                   │
│  3. Enqueue fulfill job via BullMQ                           │
│  4. Broadcast WS event: withdrawal:status → PROCESSING      │
└──────────────┬───────────────────────────────────────────────┘
               │
               │  STEP 3: FULFILL BATCH (async, backend-only)
               ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND (BullMQ Worker)                                     │
│                                                              │
│  processFulfillBatch():                                      │
│  1. Get all PROCESSING withdrawals for this vault            │
│  2. glamClient.price.priceVaultIxs() (required before fill)  │
│  3. glamClient.invest.txBuilder.fulfillIx()                  │
│  4. Sign with keeper keypair (vault manager)                 │
│  5. Send tx to Solana, confirm on-chain                      │
│  6. Update status: PROCESSING → CLAIMABLE                   │
│  7. Broadcast WS event: withdrawal:status → CLAIMABLE       │
│                                                              │
│  Retries: 3 attempts, exponential backoff (5s base)          │
│  Concurrency: 1 per vault (sequential processing)            │
└──────────────┬───────────────────────────────────────────────┘
               │
               │  WS notification → user sees "Claim" card
               ▼
┌──────────────────────────────────────────────────────────────┐
│  MOBILE APP                                                  │
│                                                              │
│  WithdrawalClaimCard appears                                 │
│  ├── "Claim Funds" button                                    │
│  └── useClaimWithdrawal() mutation fires                     │
│       ↓                                                      │
│  STEP 4a: GET unsigned claim tx                              │
│  GET /api/withdrawals/{withdrawalId}/claim                   │
│  { signerPublicKey }                                         │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND                                                     │
│                                                              │
│  buildClaimTransaction():                                    │
│  1. Verify status = CLAIMABLE and user owns withdrawal       │
│  2. Build unsigned claim transaction:                        │
│     ├── ComputeBudgetProgram.setComputeUnitLimit(400k)       │
│     ├── ComputeBudgetProgram.setComputeUnitPrice(50k µL)     │
│     └── glamClient.invest.txBuilder.claimIx()                │
│  3. Return { transaction (base64), withdrawalId }            │
└──────────────┬───────────────────────────────────────────────┘
               │
               │  Unsigned transaction (base64)
               ▼
┌──────────────────────────────────────────────────────────────┐
│  MOBILE APP                                                  │
│                                                              │
│  STEP 4b: SIGN & CONFIRM CLAIM                              │
│  1. Deserialize transaction from base64                      │
│  2. Privy wallet signs (user signature)                      │
│  3. Send to Solana RPC (skipPreflight: true)                 │
│  4. Wait for on-chain confirmation                           │
│  5. POST /api/withdrawals/{withdrawalId}/confirm-claim       │
│     { txSignature }                                          │
│  6. Show success toast                                       │
│  7. Invalidate portfolio query (refresh balances)            │
└──────────────────────────────────────────────────────────────┘
```

## Transaction Structure

Three separate Solana transactions across the flow:

### 1. Redeem Transaction (user signs)

| # | Instruction | Purpose |
| --- | --- | --- |
| 1 | `setComputeUnitLimit(400k)` | Reserve compute units |
| 2 | `setComputeUnitPrice(50k µLamports)` | Priority fee for inclusion |
| 3 | `glamClient.invest.queuedRedeemIx()` | Queue share redemption in GLAM vault |

**Signers:** User wallet only (signs on device via Privy)
**Fee payer:** User's wallet

### 2. Fulfill Transaction (backend signs)

| # | Instruction | Purpose |
| --- | --- | --- |
| 1 | `glamClient.price.priceVaultIxs()` | Update vault NAV before fulfillment |
| 2 | `glamClient.invest.fulfillIx()` | Process batch redemption |

**Signers:** Keeper keypair only (vault manager, signs on backend)
**Fee payer:** Keeper (platform pays)

### 3. Claim Transaction (user signs)

| # | Instruction | Purpose |
| --- | --- | --- |
| 1 | `setComputeUnitLimit(400k)` | Reserve compute units |
| 2 | `setComputeUnitPrice(50k µLamports)` | Priority fee for inclusion |
| 3 | `glamClient.invest.claimIx()` | Claim redeemed USDC to user wallet |

**Signers:** User wallet only (signs on device via Privy)
**Fee payer:** User's wallet

## API Endpoints

| Method | Endpoint | Purpose | Request Body | Response |
| --- | --- | --- | --- | --- |
| POST | `/api/withdrawals/{vaultId}/request` | Start withdrawal | `{ amount, signerPublicKey }` | `{ transaction, withdrawalId }` |
| POST | `/api/withdrawals/{id}/confirm-redeem` | Confirm redeem tx | `{ txSignature }` | `{ withdrawalId, status }` |
| GET | `/api/withdrawals/{id}/claim` | Get claim tx | `{ signerPublicKey }` | `{ transaction, withdrawalId }` |
| POST | `/api/withdrawals/{id}/confirm-claim` | Confirm claim tx | `{ txSignature }` | `{ withdrawalId, status }` |
| GET | `/api/withdrawals/{id}/status` | Poll status | — | `WithdrawalRequest` |
| GET | `/api/withdrawals` | List user withdrawals | — | `WithdrawalRequest[]` |
| POST | `/api/withdrawals/{vaultId}/reconcile` | Fix DB/chain drift | `{ walletAddress }` | `WithdrawalRequest` |
| POST | `/api/withdrawals/{id}/retry` | Retry failed | — | `WithdrawalRequest` |

## WebSocket Events

| Connection | `ws://{host}/ws/withdrawals?token={privyToken}` |
| --- | --- |
| Auth | Privy JWT in query param |
| Event name | `withdrawal:status` |
| Payload | `{ withdrawalId, status, ...fields }` |
| Heartbeat | Server pings every 30s |

Events fire on transitions: `PROCESSING`, `CLAIMABLE`, `CLAIMED`, `FAILED`.

## Recovery Mechanisms

### Cron Recovery Job

Runs periodically to catch stuck withdrawals:

| Stuck State | Timeout | Action |
| --- | --- | --- |
| `REQUESTED` | 30 minutes | Auto-fail (user never signed) |
| `PROCESSING` | 15 minutes | Re-enqueue fulfill job |

### Reconciliation Endpoint

Handles DB/on-chain divergence — if a redeem tx landed on-chain but no DB record exists:

1. User calls `POST /api/withdrawals/{vaultId}/reconcile`
2. Backend checks on-chain state for the user's wallet
3. Creates missing `PROCESSING` record with deterministic idempotency key
4. Enqueues fulfill job

### Retry Endpoint

For `FAILED` withdrawals:

1. User calls `POST /api/withdrawals/{id}/retry`
2. Backend resets status and re-enqueues
3. Max retry count tracked via `errorCount` field

## Constraints

| Constraint | Value | Rationale |
| --- | --- | --- |
| Batch window | 5 minutes | Merge duplicate requests within window |
| Share token decimals | 6 (×1,000,000) | GLAM vault share token precision |
| Compute budget | 400,000 CU | Sufficient for GLAM instructions |
| Priority fee | 50,000 µLamports | Configurable, ensures inclusion |
| Fulfill concurrency | 1 per vault | Prevents race conditions |
| Fulfill retries | 3 attempts | Exponential backoff (5s base) |
| REQUESTED timeout | 30 minutes | Auto-fail unsigned requests |
| PROCESSING timeout | 15 minutes | Re-enqueue stuck fulfillments |

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `FEE_PAYER_PRIVATE_KEY` | Yes | — | Keeper keypair for vault manager signing (fulfill step) |
| `SOLANA_RPC_URL` | Yes | — | Solana RPC endpoint |
| `REDIS_URL` | Yes | — | Redis connection for BullMQ job queue |
| `WITHDRAWAL_BATCH_WINDOW_MS` | No | `300000` | Idempotency batch window (5 min) |

These must be listed in `turbo.json` `globalEnv` for Turborepo to forward them.

## Source Files

### Backend

| File | Responsibility |
| --- | --- |
| `apps/back/src/routes/withdrawals/index.ts` | Route registration (auth middleware) |
| `apps/back/src/routes/withdrawals/handlers/request.ts` | Build unsigned redeem tx, create DB record |
| `apps/back/src/routes/withdrawals/handlers/confirm-redeem.ts` | Verify redeem on-chain, enqueue fulfill |
| `apps/back/src/routes/withdrawals/handlers/claim.ts` | Build unsigned claim tx |
| `apps/back/src/routes/withdrawals/handlers/confirm-claim.ts` | Verify claim on-chain, finalize |
| `apps/back/src/routes/withdrawals/handlers/reconcile.ts` | Fix DB/chain divergence |
| `apps/back/src/routes/withdrawals/handlers/retry.ts` | Retry failed withdrawals |
| `apps/back/src/routes/withdrawals/handlers/status.ts` | Fetch withdrawal status |
| `apps/back/src/routes/withdrawals/handlers/list.ts` | List user withdrawals |
| `apps/back/src/services/withdrawal.service.ts` | Batch fulfillment logic (GLAM fulfill) |
| `apps/back/src/services/withdrawal-claim.service.ts` | Claim tx builder + confirm |
| `apps/back/src/store/withdrawal.repository.ts` | Data access layer (Prisma queries) |
| `apps/back/src/queue/withdrawal-queue.ts` | BullMQ job queue definition |
| `apps/back/src/queue/withdrawal-worker.ts` | Worker: process fulfill batch |
| `apps/back/src/cron/recovery-withdrawals.ts` | Recovery cron for stuck withdrawals |
| `apps/back/src/infra/websocket.ts` | WebSocket server for real-time updates |
| `apps/back/src/solana/config.ts` | Keeper keypair loading, Solana constants |

### Shared

| File | Responsibility |
| --- | --- |
| `packages/shared/src/types/withdrawal.ts` | `WithdrawalStatus`, `WithdrawalRequest` types |
| `packages/shared/src/schemas/withdrawal.schema.ts` | Zod schemas for all withdrawal endpoints |

### Mobile

| File | Responsibility |
| --- | --- |
| `apps/native/components/vault/WithdrawScreen.tsx` | Withdrawal form, timeline, status cards |
| `apps/native/components/vault/WithdrawalClaimCard.tsx` | "Claim Funds" action card |
| `apps/native/components/vault/WithdrawalFailedCard.tsx` | Error display + retry button |
| `apps/native/hooks/mutations/use-request-withdrawal.ts` | Request + sign + confirm-redeem mutation |
| `apps/native/hooks/mutations/use-claim-withdrawal.ts` | Claim + sign + confirm-claim mutation |
| `apps/native/hooks/mutations/use-retry-withdrawal.ts` | Retry failed withdrawal mutation |
| `apps/native/hooks/mutations/use-reconcile-withdrawal.ts` | Reconcile DB/chain mutation |
| `apps/native/hooks/queries/use-withdrawals.ts` | List + status polling queries |
| `apps/native/hooks/use-withdrawal-ws.ts` | WebSocket real-time status updates |

## Key Design Decisions

1. **Three separate transactions** — Unlike Fund SOL (single tx with partial signing), withdrawals use three independent transactions because GLAM's queued redemption model requires the vault manager (keeper) to fulfill between the user's redeem and claim. This makes the flow asynchronous but safer — no single tx holds all authority.

2. **Batch window with idempotency** — Within a 5-minute window, duplicate requests from the same user for the same vault are merged via `md5(userId, vaultId, batchId)`. This prevents accidental double-redemptions from network retries or UI re-taps.

3. **Async fulfillment via BullMQ** — The fulfill step runs as a background job rather than inline because it requires the keeper's signature and may need retries. BullMQ provides reliable delivery, exponential backoff, and dead-letter handling.

4. **WebSocket + polling hybrid** — The mobile app listens to WebSocket events for instant status transitions (PROCESSING → CLAIMABLE) but also polls every 10-30s as a fallback. This handles cases where WS connections drop on mobile networks.

5. **Soft-delete for retry-ability** — Failed withdrawals are marked `REMOVED` (not hard-deleted) with the idempotency key reassigned. This lets users retry immediately within the same batch window without hitting uniqueness constraints.

6. **Reconciliation endpoint** — If the mobile app crashes after the user signs the redeem tx but before calling `confirm-redeem`, the on-chain state and DB diverge. The reconcile endpoint detects this by checking on-chain state and creates the missing DB record, ensuring no funds are stuck.
