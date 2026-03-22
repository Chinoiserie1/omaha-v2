# Withdraw from Vault Flow

> Redeem vault shares → (instant or queued fulfill) → tokens returned to wallet.

Users invest USDC into Quant vaults (Omaha Vault program tokenized vaults on Solana). When they want to exit a position, the withdrawal flow redeems their vault shares and returns USDC to their Privy embedded wallet. The backend checks the vault's USDC balance and chooses between **instant** (`WithdrawWithPrice`) or **queued** (`RequestWithdraw → FulfillWithdraw`) modes. Instant fulfillment executes immediately if sufficient balance exists; queued uses asynchronous batch fulfillment for efficiency.

## Status Lifecycle

**Instant Mode** (`WithdrawWithPrice` — sufficient USDC balance):
```
REQUESTED → CLAIMED (single atomic tx)
```

**Queued Mode** (`RequestWithdraw → FulfillWithdraw` — insufficient balance):
```
REQUESTED → PROCESSING → CLAIMED
                │
              FAILED
                │
              REMOVED (soft-delete for retry)
```

| Status | Meaning | Mode |
| --- | --- | --- |
| `REQUESTED` | User submitted unsigned redeem tx, DB record created | Both |
| `PROCESSING` | User signed & submitted redeem tx on-chain, backend confirmed; awaiting batch fulfillment | Queued only |
| `CLAIMED` | Fulfillment complete (instant or batch), base tokens transferred to user wallet | Both |
| `FAILED` | Error during processing or fulfillment, user can retry | Both |
| `REMOVED` | Soft-deleted (idempotency key reassigned), allows immediate retry | Queued only |

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
│  3. Detect withdrawal mode:                                  │
│     ├── Check vault USDC balance via RPC                     │
│     ├── If balance >= amount → INSTANT mode                  │
│     └── If balance < amount → QUEUED mode                    │
│  4. Create WithdrawalRequest record (status: REQUESTED)      │
│  5. Build unsigned transaction based on mode:                │
│                                                              │
│     [INSTANT MODE]                                           │
│     ├── ComputeBudgetProgram.setComputeUnitLimit(400k)       │
│     ├── ComputeBudgetProgram.setComputeUnitPrice(50k µL)     │
│     ├── createAssociatedTokenAccountIdempotent() (if needed) │
│     └── createWithdrawWithPriceInstruction()                 │
│         └── Atomic: set price + burn shares + transfer USDC  │
│                                                              │
│     [QUEUED MODE]                                            │
│     ├── ComputeBudgetProgram.setComputeUnitLimit(400k)       │
│     ├── ComputeBudgetProgram.setComputeUnitPrice(50k µL)     │
│     ├── createAssociatedTokenAccountIdempotent() (if needed) │
│     │   └── Creates vault share escrow ATA (first time only) │
│     └── createRequestWithdrawInstruction()                   │
│         └── Transfers shares to vault escrow (not burned)    │
│                                                              │
│  6. Return { transaction (base64), withdrawalId, mode }      │
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
               │  STEP 2: CONFIRM REDEEM
               ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND                                                     │
│                                                              │
│  1. Verify redeem tx landed on-chain                         │
│  2. Update status based on mode:                             │
│                                                              │
│     [INSTANT MODE]                                           │
│     ├── Verify WithdrawWithPrice tx succeeded                │
│     ├── Update status: REQUESTED → CLAIMED                   │
│     ├── Record tx signature in DB                            │
│     └── Broadcast WS event: withdrawal:status → CLAIMED      │
│                                                              │
│     [QUEUED MODE]                                            │
│     ├── Verify RequestWithdraw tx succeeded                  │
│     ├── Update status: REQUESTED → PROCESSING                │
│     ├── Enqueue fulfill job via BullMQ (deterministic, dedup)│
│     └── Broadcast WS event: withdrawal:status → PROCESSING   │
└──────────────┬───────────────────────────────────────────────┘
               │
               │  STEP 3: FULFILL BATCH (queued mode only; async, delayed via Redis/BullMQ)
               │  [SKIPPED for instant mode]
               ▼
┌──────────────────────────────────────────────────────────────┐
│  REDIS (BullMQ Queue — delayed job)                          │
│                                                              │
│  enqueueFulfillJob(vaultId):                                 │
│  1. Compute batch window slot:                               │
│     batchId = "{vaultId}-{floor(now / BATCH_WINDOW_MS)}"     │
│  2. Compute remaining delay:                                 │
│     delay = BATCH_WINDOW_MS - (now % BATCH_WINDOW_MS)        │
│  3. Add job with deterministic jobId = "fulfill-{batchId}"   │
│  4. BullMQ deduplicates: same jobId → skip (already queued)  │
│                                                              │
│  Result: ONE delayed job per vault per batch window.          │
│  All redeem confirmations within the window share it.         │
│                                                              │
│  Example (10-min window):                                    │
│  ┌──────────────────────────────────────────┐                │
│  │ 00:00  User A confirms redeem            │                │
│  │        → job queued, delay=10min          │                │
│  │ 03:00  User B confirms redeem (same vlt) │                │
│  │        → same jobId exists, skip (dedup) │                │
│  │ 07:00  User C confirms redeem (same vlt) │                │
│  │        → same jobId exists, skip (dedup) │                │
│  │ 10:00  Window closes → job fires          │                │
│  │        → fulfill ALL 3 in one tx          │                │
│  └──────────────────────────────────────────┘                │
└──────────────┬───────────────────────────────────────────────┘
               │
               │  Delayed job fires when batch window closes
               ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKEND (BullMQ Worker)                                     │
│                                                              │
│  processFulfillBatch(vaultId):                                │
│  1. Get ALL PROCESSING withdrawals for this vault            │
│  2. createFulfillWithdrawInstruction()                       │
│  3. Sign with admin keypair (vault manager)                  │
│  4. Send tx to Solana, confirm on-chain                      │
│  5. Base tokens transferred directly to each user wallet     │
│  6. Update ALL statuses: PROCESSING → CLAIMED               │
│  7. Broadcast WS event per user: withdrawal:status → CLAIMED │
│                                                              │
│  Retries: 3 attempts, exponential backoff (5s base)          │
│  Concurrency: 1 per vault (sequential processing)            │
└──────────────┬───────────────────────────────────────────────┘
               │
               │  WS notification → user sees "Claimed" status
               ▼
┌──────────────────────────────────────────────────────────────┐
│  MOBILE APP                                                  │
│                                                              │
│  Withdrawal complete — tokens in user wallet                 │
│  Invalidate portfolio query (refresh balances)               │
└──────────────────────────────────────────────────────────────┘
```

## Transaction Structure

Two separate Solana transactions across the flow:

### 1. Redeem Transaction (user signs)

| # | Instruction | Purpose |
| --- | --- | --- |
| 1 | `setComputeUnitLimit(400k)` | Reserve compute units |
| 2 | `setComputeUnitPrice(50k µLamports)` | Priority fee for inclusion |
| 3 | `createAssociatedTokenAccountIdempotent()` | Create vault share escrow ATA (if not exists) |
| 4 | `createRequestWithdrawInstruction()` | Transfer shares to escrow, create PendingWithdraw PDA |

**Signers:** User wallet only (signs on device via Privy)
**Fee payer:** User's wallet

### 2. Fulfill Transaction (backend signs)

| # | Instruction | Purpose |
| --- | --- | --- |
| 1 | `createFulfillWithdrawInstruction()` | Burn escrowed shares, transfer base tokens to user wallets |

**Signers:** Admin keypair only (vault manager, signs on backend)
**Fee payer:** Admin (platform pays)

## Batch Window & Delayed Fulfillment (Deep Dive)

The batch window is the mechanism that groups multiple withdrawal requests into a single on-chain fulfill transaction. It involves three layers: **time slotting**, **job deduplication**, and **DB-level collection**.

### How time slots work

Time is divided into fixed-size windows (default 10 minutes = `600_000 ms`). The window slot number is computed by integer-dividing the current Unix timestamp by the window size:

```
windowSlot = floor(now / WITHDRAWAL_BATCH_WINDOW_MS)
```

All timestamps within the same 10-minute slot produce the same slot number. For example with a 10-min window:

```
Timeline (UTC)
──────────────────────────────────────────────────────
│  Window 4939219            │  Window 4939220        │
│  00:00 ─────────── 10:00  │  10:00 ──────── 20:00 │
──────────────────────────────────────────────────────
     ▲         ▲        ▲
   User A    User B   User C
   (02:00)   (05:30)  (08:45)

All three → windowSlot = 4939219
         → batchId = "{vaultId}-4939219"
         → jobId  = "fulfill-{vaultId}-4939219"
```

### How deduplication works

When `enqueueFulfillJob(vaultId)` is called, it:

1. Computes `batchId = "{vaultId}-{windowSlot}"` — deterministic per vault per window
2. Computes `delay = BATCH_WINDOW_MS - (now % BATCH_WINDOW_MS)` — time remaining until window closes
3. Creates a BullMQ job with `jobId = "fulfill-{batchId}"` and `delay`

BullMQ rejects any job whose `jobId` already exists in the queue. So:

```
User A confirms redeem at 02:00 → jobId "fulfill-vaultX-4939219" created, delay=8min
User B confirms redeem at 05:30 → same jobId already exists → BullMQ silently skips
User C confirms redeem at 08:45 → same jobId already exists → BullMQ silently skips
```

Result: **one delayed job** waiting in Redis, scheduled to fire at 10:00.

### How multiple requests get fulfilled in one tx

The fulfill job payload contains only `{ vaultId }` — it does NOT carry individual withdrawal IDs. When the delayed job fires, the worker calls `processFulfillBatch(vaultId)`, which:

1. **Queries the DB** for ALL records with `status = "PROCESSING"` and `vaultId = vaultId`
2. Calls `createFulfillWithdrawInstruction()` — a single on-chain instruction that processes the vault's entire redemption queue and transfers base tokens directly to each user's wallet
3. Updates ALL matched records to `CLAIMED` in one batch DB update
4. Sends a WebSocket notification to each user individually

```
                    Redis (BullMQ)                         PostgreSQL
                    ──────────────                         ──────────
User A redeem  ──→  job: fulfill-vaultX-4939219            row A: PROCESSING
                    delay: 8 min
User B redeem  ──→  (dedup, skip)                          row B: PROCESSING
User C redeem  ──→  (dedup, skip)                          row C: PROCESSING

         ... 10:00 window closes, job fires ...

Worker picks up job
  → processFulfillBatch("vaultX")
  → SELECT * FROM withdrawal WHERE vault = "vaultX" AND status = "PROCESSING"
  → finds rows A, B, C
  → ONE createFulfillWithdrawInstruction() on-chain tx
  → UPDATE rows A, B, C → CLAIMED
  → WS notify User A, User B, User C
```

### Why this works

- **`createFulfillWithdrawInstruction()`** operates per-PendingWithdraw PDA. It burns the escrowed shares from the vault's share ATA and transfers base tokens directly to the user. Multiple instructions can be batched in a single transaction for efficiency.
- **The DB is the source of truth** for which requests to transition. The BullMQ job is just a trigger — it says "go process vault X now" and the worker collects everything at execution time.
- **Late arrivals still get caught.** If User D confirms a redeem at 09:59 (just before the window closes), their DB row is `PROCESSING` when the job fires at 10:00, so they're included in the same batch.

### Recovery bypass

The recovery cron (`recovery-withdrawals.ts`) handles stuck `PROCESSING` records older than 15 minutes. These are already past the batch window, so it passes `{ delayMs: 0 }` to execute the fulfill immediately:

```ts
await enqueueFulfillJob(req.vaultId, { delayMs: 0 });
```

### Source files

| File | Role in batching |
| --- | --- |
| `queue/batch-utils.ts` | `computeBatchId()` — deterministic slot ID; `remainingBatchWindowMs()` — delay calc |
| `queue/withdrawal-queue.ts` | `enqueueFulfillJob()` — enqueue with delay + dedup via jobId |
| `queue/withdrawal-worker.ts` | Picks up delayed job, calls `processFulfillBatch()` |
| `services/withdrawal.service.ts` | `processFulfillBatch()` — queries ALL PROCESSING rows, one `createFulfillWithdrawInstruction`, batch update |
| `store/withdrawal.repository.ts` | `findPendingFulfill()` — `WHERE vault = X AND status = PROCESSING` |
| `cron/recovery-withdrawals.ts` | Re-enqueues stuck records with `delayMs: 0` |

## API Endpoints

| Method | Endpoint | Purpose | Request Body | Response |
| --- | --- | --- | --- | --- |
| POST | `/api/withdrawals/{vaultId}/request` | Start withdrawal | `{ amount, signerPublicKey }` | `{ transaction, withdrawalId, mode: "instant" \| "queued" }` |
| POST | `/api/withdrawals/{id}/confirm-redeem` | Confirm redeem tx | `{ txSignature }` | `{ withdrawalId, status, mode }` |
| GET | `/api/withdrawals/{id}/status` | Poll status | — | `WithdrawalRequest` (includes `mode` field) |
| GET | `/api/withdrawals` | List user withdrawals | — | `WithdrawalRequest[]` (each includes `mode`) |
| POST | `/api/withdrawals/{vaultId}/reconcile` | Fix DB/chain drift | `{ walletAddress }` | `WithdrawalRequest` |
| POST | `/api/withdrawals/{id}/retry` | Retry failed | — | `WithdrawalRequest` |

## WebSocket Events

| Connection | `ws://{host}/ws/withdrawals?token={privyToken}` |
| --- | --- |
| Auth | Privy JWT in query param |
| Event name | `withdrawal:status` |
| Payload | `{ withdrawalId, status, ...fields }` |
| Heartbeat | Server pings every 30s |

Events fire on transitions: `PROCESSING`, `CLAIMED`, `FAILED`.

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
| Batch window | 10 minutes (default) | Delay fulfill to batch multiple redeems into one tx |
| Share token decimals | 6 (×1,000,000) | Omaha Vault share token precision |
| Compute budget | 400,000 CU | Sufficient for vault instructions |
| Priority fee | 50,000 µLamports | Configurable, ensures inclusion |
| Fulfill concurrency | 1 per vault | Prevents race conditions |
| Fulfill retries | 3 attempts | Exponential backoff (5s base) |
| REQUESTED timeout | 30 minutes | Auto-fail unsigned requests |
| PROCESSING timeout | 15 minutes | Re-enqueue stuck fulfillments |

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `FEE_PAYER_PRIVATE_KEY` | Yes | — | Admin keypair for vault manager signing (fulfill step) |
| `SOLANA_RPC_URL` | Yes | — | Solana RPC endpoint |
| `REDIS_URL` | Yes | — | Redis connection for BullMQ job queue |
| `WITHDRAWAL_BATCH_WINDOW_MS` | No | `600000` | Batch window for grouping fulfill jobs (10 min) |

These must be listed in `turbo.json` `globalEnv` for Turborepo to forward them.

## Source Files

### Backend

| File | Responsibility |
| --- | --- |
| `apps/back/src/routes/withdrawals/index.ts` | Route registration (auth middleware) |
| `apps/back/src/routes/withdrawals/handlers/request.ts` | Validate request, detect mode (instant/queued), build unsigned tx |
| `apps/back/src/routes/withdrawals/handlers/detect-withdraw-mode.ts` | Check vault USDC balance, decide instant vs queued |
| `apps/back/src/routes/withdrawals/handlers/build-instant-tx.ts` | Build WithdrawWithPrice atomic transaction |
| `apps/back/src/routes/withdrawals/handlers/build-queued-tx.ts` | Build RequestWithdraw transaction |
| `apps/back/src/routes/withdrawals/handlers/confirm-redeem.ts` | Verify tx on-chain, transition status (mode-dependent), enqueue fulfill (if queued) |
| `apps/back/src/routes/withdrawals/handlers/reconcile.ts` | Fix DB/chain divergence |
| `apps/back/src/routes/withdrawals/handlers/retry.ts` | Retry failed withdrawals |
| `apps/back/src/routes/withdrawals/handlers/status.ts` | Fetch withdrawal status and mode |
| `apps/back/src/routes/withdrawals/handlers/list.ts` | List user withdrawals |
| `apps/back/src/services/withdrawal.service.ts` | Queued batch fulfillment logic (FulfillWithdraw, BullMQ worker) |
| `apps/back/src/services/withdrawal-claim.service.ts` | Claim management for batch-fulfilled withdrawals |
| `apps/back/src/services/vault-balance.service.ts` | Check vault USDC balance on-chain for mode detection |
| `apps/back/src/store/withdrawal.repository.ts` | Data access layer (Prisma queries) |
| `apps/back/src/queue/withdrawal-queue.ts` | BullMQ job queue + delayed enqueue with dedup (queued mode only) |
| `apps/back/src/queue/withdrawal-worker.ts` | Worker: process queued fulfill batch |
| `apps/back/src/queue/batch-utils.ts` | Batch ID, idempotency key, remaining window calc |
| `apps/back/src/cron/recovery-withdrawals.ts` | Recovery cron for stuck withdrawals (queued mode) |
| `apps/back/src/infra/websocket.ts` | WebSocket server for real-time updates |
| `apps/back/src/solana/config.ts` | Admin keypair loading, Solana constants |

### Shared

| File | Responsibility |
| --- | --- |
| `packages/shared/src/types/withdrawal.ts` | `WithdrawalStatus`, `WithdrawalRequest` types |
| `packages/shared/src/schemas/withdrawal.schema.ts` | Zod schemas for all withdrawal endpoints |

### Mobile

| File | Responsibility |
| --- | --- |
| `apps/native/components/vault/WithdrawScreen.tsx` | Withdrawal form, timeline, status cards |
| `apps/native/components/vault/WithdrawalFailedCard.tsx` | Error display + retry button |
| `apps/native/hooks/mutations/use-request-withdrawal.ts` | Request + sign + confirm-redeem mutation |
| `apps/native/hooks/mutations/use-retry-withdrawal.ts` | Retry failed withdrawal mutation |
| `apps/native/hooks/mutations/use-reconcile-withdrawal.ts` | Reconcile DB/chain mutation |
| `apps/native/hooks/queries/use-withdrawals.ts` | List + status polling queries |
| `apps/native/hooks/use-withdrawal-ws.ts` | WebSocket real-time status updates |

## Key Design Decisions

1. **Instant vs queued withdrawal modes** — At request time, the backend checks the vault's USDC balance via RPC. If balance ≥ withdrawal amount, use `WithdrawWithPrice` (instant atomic tx: set price → burn shares → transfer USDC). If balance < amount, use `RequestWithdraw → FulfillWithdraw` (queued batch mode). This is transparent to the client — they receive the mode in the response and can surface different UX (instant claim vs batch queue). Instant mode completes in a single on-chain tx; queued mode batches multiple requests in a single fulfillment for gas efficiency.

2. **Escrow pattern with deferred burn** — In queued mode, `RequestWithdraw` transfers shares to a vault-controlled escrow ATA (not burned). `FulfillWithdraw` burns escrowed shares and transfers base tokens. This ensures shares remain locked during the batch window and are only destroyed when USDC is actually disbursed. If the request expires (48h), `CancelWithdraw` returns shares from escrow to the user.

3. **Batch window with idempotency (queued mode only)** — Within a 10-minute window (configurable via `WITHDRAWAL_BATCH_WINDOW_MS`), duplicate requests from the same user for the same vault are merged via `sha256(userId, vaultId, batchId)`. This prevents accidental double-redemptions from network retries or UI re-taps.

4. **Delayed fulfillment via Redis/BullMQ (queued mode only)** — The queued fulfill step runs as a delayed background job. When a redeem is confirmed in queued mode, `enqueueFulfillJob()` schedules a job with `delay = remainingBatchWindowMs(now)` — the time left until the current batch window closes. The job ID is deterministic (`fulfill-{vaultId}-{windowSlot}`), so BullMQ auto-deduplicates: if a second user confirms a redeem for the same vault within the same window, no new job is created. When the window closes, the single delayed job fires, the worker calls `processFulfillBatch(vaultId)` which collects ALL `PROCESSING` records for that vault and fulfills them in one on-chain transaction. This saves gas and reduces vault rebalance operations. Recovery jobs (stuck `PROCESSING` records) bypass the delay with `delayMs: 0` since they're already past the window.

5. **WebSocket + polling hybrid** — The mobile app listens to WebSocket events for instant status transitions (`CLAIMED` for instant mode, `PROCESSING` → `CLAIMED` for queued) but also polls every 10-30s as a fallback. This handles cases where WS connections drop on mobile networks.

6. **Soft-delete for retry-ability (queued mode)** — Failed withdrawals in queued mode are marked `REMOVED` (not hard-deleted) with the idempotency key reassigned. This lets users retry immediately within the same batch window without hitting uniqueness constraints.

7. **Pre-flight balance check on-chain** — Both `WithdrawWithPrice` (instant) and `FulfillWithdraw` (queued) instructions include an on-chain pre-flight check to verify vault USDC balance before processing. This prevents partial withdrawals and ensures consistency between backend decision logic and actual fulfillment.

8. **Reconciliation endpoint** — If the mobile app crashes after the user signs the redeem tx but before calling `confirm-redeem`, the on-chain state and DB diverge. The reconcile endpoint detects this by checking on-chain state and creates the missing DB record, ensuring no funds are stuck.
