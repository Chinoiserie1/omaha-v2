# Vault Program — Devnet Deployment Guide

This document covers deploying the Omaha Vault program (`omaha-vault`) to Solana devnet, including keypair management, step-by-step commands, and troubleshooting.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Keypair Inventory](#keypair-inventory)
- [Step-by-Step Deployment](#step-by-step-deployment)
- [Upgrading an Existing Deployment](#upgrading-an-existing-deployment)
- [Updating the Program ID](#updating-the-program-id)
- [Post-Deploy Verification](#post-deploy-verification)
- [Environment Setup for Backend](#environment-setup-for-backend)
- [Troubleshooting](#troubleshooting)
- [Security Notes](#security-notes)

---

## Prerequisites

| Tool               | Minimum Version | Check Command            |
| ------------------ | --------------- | ------------------------ |
| Solana CLI         | 2.0+            | `solana --version`       |
| Rust toolchain     | 1.79+           | `rustc --version`        |
| `cargo-build-sbf`  | (bundled)       | `cargo build-sbf --help` |
| pnpm               | 9.x             | `pnpm --version`         |
| Node.js            | 20+             | `node --version`         |

Install Solana CLI: https://docs.solanalabs.com/cli/install

---

## Keypair Inventory

The vault program uses **4 distinct keypairs**, each with a different role. Confusing them is the most common deployment mistake.

### 1. Deploy Wallet (Upgrade Authority)

| Property    | Value                                                        |
| ----------- | ------------------------------------------------------------ |
| **Purpose** | Pays SOL for deployment transactions. Becomes the **upgrade authority** — the only wallet that can upgrade the program binary after initial deployment. |
| **Location**| `~/.config/solana/id.json` (Solana CLI default wallet)       |
| **Public Key** | `GXQcRCwsCrJpueQ6cB6PSkHGXSwLydKhnWbqFmY3fT33` (current) |
| **Funded on** | Devnet (via `solana airdrop`)                              |
| **Git tracked** | No (lives outside the repo)                              |

**What it does:**
- Signs the `solana program deploy` transaction
- Pays rent (~0.5 SOL for a 66KB program account)
- Becomes the upgrade authority stored on-chain in the program's ProgramData account
- Required again for any future `solana program deploy` (upgrade) or `solana program set-upgrade-authority` call

**How to check:**
```bash
solana address                    # Shows this wallet's public key
solana balance --url devnet       # Shows available SOL
solana program show <PROGRAM_ID> --url devnet  # "Authority" field = this wallet
```

**How to create (if missing):**
```bash
solana-keygen new -o ~/.config/solana/id.json
```

---

### 2. Program Keypair (Program Address)

| Property    | Value                                                         |
| ----------- | ------------------------------------------------------------- |
| **Purpose** | Derives the program's on-chain address (Program ID). The program binary is deployed to this address. |
| **Location**| `target/deploy/omaha_vault-keypair.json`                      |
| **Public Key** | `5yY17NisfXbyjanUEBxrdKsSCuRiWcjzEt6LXGZqDiVR`           |
| **Git tracked** | No (`.gitignore` excludes `*-keypair.json` and `target/`) |

**What it does:**
- The public key derived from this keypair IS the program ID
- Used once during initial deployment to prove ownership of the address
- Referenced in `declare_id!()` in the Rust code — the program checks its own ID at runtime
- Used for PDA derivation (all vault state PDAs are derived from this program ID)

**Where it's referenced in code:**

| File | Line | Usage |
|------|------|-------|
| `apps/programs/vault/src/lib.rs` | 12 | `declare_id!("5yY17...")` |
| `packages/omaha-programs-sdk/src/constants.ts` | 4-7 | `VAULT_PROGRAM_ID` |
| `apps/programs/vault/tests/helpers.rs` | 20-25 | `program_id()` test helper |

**How to check:**
```bash
solana-keygen pubkey target/deploy/omaha_vault-keypair.json
```

**How to generate (if lost):**
```bash
solana-keygen new -o target/deploy/omaha_vault-keypair.json --no-bip39-passphrase
# IMPORTANT: This creates a NEW program ID — you must update all 3 files above
```

> **WARNING:** If you lose this keypair and generate a new one, the program ID changes. You must update `declare_id!`, `VAULT_PROGRAM_ID`, and the test helper, then rebuild and redeploy. See [Updating the Program ID](#updating-the-program-id).

---

### 3. Program Authority Keypair (Factory Creation Gate)

| Property    | Value                                                           |
| ----------- | --------------------------------------------------------------- |
| **Purpose** | Must co-sign `InitializeFactory` (one-time setup). After the factory is created, vault creation is gated by factory admins/owner instead. |
| **Location**| `apps/programs/vault/program-authority-keypair.json`             |
| **Public Key** | `9hLNRfyFw32aU6xyKZHSUSJt3N2QC9oen8HDqPyJ3Ryf`             |
| **Git tracked** | No (`.gitignore` excludes `*-keypair.json`)                 |

**What it does:**
- Its public key is hardcoded as a 32-byte constant (`PROGRAM_AUTHORITY`) in the Rust program
- The `InitializeFactory` instruction (0x0D) checks that account[0] is a signer AND matches this constant
- If the signer doesn't match, the program returns `UnauthorizedInitializer` error (0x10E)
- This is used **once** to create the singleton factory PDA. After that, vault creation (`Initialize` 0x00) is gated by the factory's owner/admin list, not this keypair
- The factory owner and admins are managed on-chain via `AddFactoryAdmin`/`RemoveFactoryAdmin`/`TransferFactoryOwnership`

**Where it's referenced in code:**

| File | Line | Usage |
|------|------|-------|
| `apps/programs/vault/src/lib.rs` | 17-22 | `PROGRAM_AUTHORITY` constant (hex bytes) |
| `apps/programs/vault/src/instructions/initialize_factory.rs` | — | Validation check in `InitializeFactory` |
| `packages/omaha-programs-sdk/src/constants.ts` | 9-14 | `PROGRAM_AUTHORITY` export (SDK not yet updated) |
| `apps/programs/vault/tests/helpers.rs` | 33-37 | `program_authority()` test helper |

**How to check:**
```bash
solana-keygen pubkey apps/programs/vault/program-authority-keypair.json
```

**Relationship to Deploy Wallet:**
- These are completely independent keypairs
- The deploy wallet controls program upgrades (binary deployment)
- The program authority controls factory creation (one-time setup)
- After factory creation, vault creation is controlled by factory admins/owner (on-chain state)
- Changing the program authority requires modifying the Rust source and redeploying

---

### 4. Backend Operational Keypairs (Runtime)

These keypairs are loaded from environment variables at backend startup. They are NOT involved in program deployment but are used at runtime for on-chain operations.

#### 4a. Admin Keypair

| Property    | Value                                                        |
| ----------- | ------------------------------------------------------------ |
| **Purpose** | Vault operator that signs rebalancing, fee collection, and other vault management transactions. |
| **Env Var** | `ADMIN_PROGRAM_PRIVATE_KEY`                                         |
| **Required**| Yes (backend crashes if missing)                             |
| **Location**| `.env` file (never committed)                                |

**What it does:**
- Signs vault operation transactions (rebalance, fee collection)
- Acts as the operational keypair for automated vault management
- Backend refuses to start without it

#### 4b. Fee Payer Keypair

| Property    | Value                                                        |
| ----------- | ------------------------------------------------------------ |
| **Purpose** | Pays Solana transaction fees for the Fund SOL flow (USDC → SOL swap for gas). |
| **Env Var** | `FEE_PAYER_PRIVATE_KEY`                                      |
| **Required**| No (Fund SOL feature is disabled if missing)                 |
| **Location**| `.env` file (never committed)                                |

**What it does:**
- Partially signs transactions on the backend before sending to the client for user signature
- Covers gas fees so users don't need SOL to perform USDC → SOL swaps
- If not set, the Fund SOL feature is gracefully disabled with a log warning

**Supported formats for both env var keypairs:**
```bash
# JSON array (most common)
ADMIN_PROGRAM_PRIVATE_KEY='[90,152,180,127,...64 bytes total]'

# Base58 (Phantom wallet export format)
ADMIN_PROGRAM_PRIVATE_KEY='5K1gR...'

# Base64
ADMIN_PROGRAM_PRIVATE_KEY='WpiYf...'
```

---

### Keypair Relationship Diagram

```
┌──────────────────────────────────────────────────────┐
│                  DEPLOYMENT TIME                      │
│                                                       │
│  Deploy Wallet ──────► solana program deploy           │
│  (upgrade authority)   │                              │
│                        ▼                              │
│  Program Keypair ────► Program ID on-chain            │
│  (address derivation)  (5yY17...)                     │
│                                                       │
├──────────────────────────────────────────────────────┤
│                    RUNTIME                            │
│                                                       │
│  Program Authority ──► co-signs InitializeFactory tx   │
│  (factory creation)    (one-time, hardcoded in binary) │
│                                                       │
│  Admin ──────────────► signs vault operations           │
│  (operator)            (rebalance, fees)              │
│                                                       │
│  Fee Payer ──────────► pays gas for Fund SOL flow     │
│  (optional)            (USDC → SOL swaps)             │
└──────────────────────────────────────────────────────┘
```

---

## Step-by-Step Deployment

### Step 1: Configure Solana CLI for Devnet

```bash
solana config set --url devnet
solana config get
```

Expected output:
```
RPC URL: https://api.devnet.solana.com
Keypair Path: /Users/<you>/.config/solana/id.json
```

### Step 2: Fund the Deploy Wallet

The deploy wallet needs SOL to pay for program account rent. A ~66KB program needs ~0.5 SOL.

```bash
# Check current balance
solana balance --url devnet

# Airdrop SOL (max ~5 SOL per request on devnet)
solana airdrop 5 --url devnet

# If rate-limited, use the web faucet:
# https://faucet.solana.com
```

### Step 3: Build the Program

```bash
# From the monorepo root
pnpm program:build
```

Verify the output:
```bash
ls -la target/deploy/omaha_vault.so
# Should be ~37KB ELF binary

file target/deploy/omaha_vault.so
# Should show: ELF 64-bit LSB shared object
```

### Step 4: Run Tests

```bash
pnpm program:test
```

All 201 tests should pass. Never deploy untested code. Includes 27 multi-interaction tests covering real user flows (sequential deposits/withdrawals, multi-vault, full cycles, fees, pause, cancel, depletion).

### Step 5: Deploy to Devnet

```bash
pnpm program:deploy
```

Or equivalently:
```bash
solana program deploy target/deploy/omaha_vault.so \
  --program-id target/deploy/omaha_vault-keypair.json \
  --url devnet
```

Expected output:
```
Program Id: 5yY17NisfXbyjanUEBxrdKsSCuRiWcjzEt6LXGZqDiVR
Signature: <transaction-signature>
```

### Step 6: Verify the Deployment

```bash
solana program show 5yY17NisfXbyjanUEBxrdKsSCuRiWcjzEt6LXGZqDiVR --url devnet
```

Expected output:
```
Program Id: 5yY17NisfXbyjanUEBxrdKsSCuRiWcjzEt6LXGZqDiVR
Owner: BPFLoaderUpgradeab1e11111111111111111111111
ProgramData Address: <data-account>
Authority: <your-deploy-wallet-pubkey>
Last Deployed In Slot: <slot>
Data Length: 66400 (0x10360) bytes
Balance: 0.46334808 SOL
```

Confirm:
- `Authority` matches your deploy wallet public key
- `Owner` is `BPFLoaderUpgradeab1e11111111111111111111111`
- Program is marked as executable

---

## Upgrading an Existing Deployment

To upgrade the program binary (e.g., after fixing a bug or adding a feature):

```bash
# 1. Make code changes
# 2. Rebuild
pnpm program:build

# 3. Run tests
pnpm program:test

# 4. Deploy (same command — Solana CLI detects it's an upgrade)
pnpm program:deploy
```

The same deploy wallet (upgrade authority) must sign the upgrade transaction. If the authority has changed or been revoked, the program is immutable and cannot be upgraded.

---

## Updating the Program ID

If the program keypair is regenerated (e.g., lost or intentionally rotated), update these 3 files:

### 1. Rust Program (`apps/programs/vault/src/lib.rs`, line 12)

```rust
// Replace with the new program ID
declare_id!("<NEW_PROGRAM_ID>");
```

### 2. TypeScript SDK (`packages/omaha-programs-sdk/src/constants.ts`, lines 4-7)

```typescript
export const VAULT_PROGRAM_ID = new PublicKey(
  "<NEW_PROGRAM_ID>",
);
```

### 3. Test Helpers (`apps/programs/vault/tests/helpers.rs`, lines 20-25)

```rust
pub fn program_id() -> Pubkey {
    "<NEW_PROGRAM_ID>"
        .parse()
        .unwrap()
}
```

After updating all 3 files:

```bash
# Rebuild the program (embeds new declare_id)
pnpm program:build

# Run tests to verify consistency
pnpm program:test

# Rebuild the SDK
pnpm --filter @repo/omaha-programs-sdk build

# Run SDK tests
pnpm --filter @repo/omaha-programs-sdk test

# Deploy with the new keypair
pnpm program:deploy
```

---

## Post-Deploy Verification

### Check Program is Executable

```bash
solana program show 5yY17NisfXbyjanUEBxrdKsSCuRiWcjzEt6LXGZqDiVR --url devnet
```

### Check Upgrade Authority

The `Authority` field must match your deploy wallet. If it shows `None`, the program is immutable.

```bash
# Your deploy wallet
solana address

# Program's authority (should match)
solana program show 5yY17NisfXbyjanUEBxrdKsSCuRiWcjzEt6LXGZqDiVR --url devnet | grep Authority
```

### Smoke Test (Initialize a Vault)

Use the `create-vault-onchain` CLI script to verify the program processes instructions correctly:

```bash
# Dry run (preview PDAs and parameters without sending)
pnpm create-vault-onchain --name "test-vault" --dry-run

# Create a vault with defaults (USDC base, $1.00 share price, 6 decimals)
pnpm create-vault-onchain --name "test-vault"

# Full example with all optional parameters
pnpm create-vault-onchain \
  --name "alpha-fund" \
  --symbol "ALPHA" \
  --uri "https://arweave.net/metadata.json" \
  --base-mint 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU \
  --share-decimals 6 \
  --share-price 1000000 \
  --entry-fee-bps 100 \
  --exit-fee-bps 50 \
  --management-fee-bps 200 \
  --performance-fee-bps 2000 \
  --fee-receiver <pubkey> \
  --operator <pubkey1> \
  --operator <pubkey2>
```

The script defaults to devnet RPC. It performs pre-flight checks (factory exists, not paused, vault name not taken) and bundles Initialize + UpdateFees + AddOperator into a single atomic transaction.

See `apps/back/src/scripts/create-vault-onchain.ts` for the full parameter reference.

---

## Environment Setup for Backend

When running the backend against devnet, set these environment variables in `.env`:

```env
# Point RPC at devnet
SOLANA_RPC_URL=https://api.devnet.solana.com

# Required: vault operator keypair (JSON array, base58, or base64)
ADMIN_PROGRAM_PRIVATE_KEY='[90,152,...]'

# Optional: fee payer for Fund SOL flow
FEE_PAYER_PRIVATE_KEY='[131,197,...]'
```

---

## Troubleshooting

### Insufficient SOL for Deployment

```
Error: Account GXQc... has insufficient funds for spend
```

**Fix:** Airdrop more SOL:
```bash
solana airdrop 5 --url devnet
# If rate-limited, wait 30 seconds and retry, or use https://faucet.solana.com
```

### Keypair Mismatch (Program Already Exists)

```
Error: Program 5yY17... is not upgradeable
```

**Cause:** A different wallet deployed the program, or upgrade authority was revoked.

**Fix:** Generate a new program keypair and follow [Updating the Program ID](#updating-the-program-id):
```bash
solana-keygen new -o target/deploy/omaha_vault-keypair.json --no-bip39-passphrase --force
```

### Airdrop Rate Limiting

```
Error: airdrop request failed. This can happen when the rate limit is reached.
```

**Fix:** Wait 30-60 seconds and retry, or use the web faucet at https://faucet.solana.com.

### `edition2024` Build Errors

```
error: the `edition2024` feature is not available
```

**Fix:** Pin dependencies that require edition 2024:
```bash
cargo update base64ct --precise 1.6.0
cargo update constant_time_eq --precise 0.4.1
cargo update blake3 --precise 1.5.5
```

### Program Authority Mismatch on InitializeFactory

```
Error: custom program error: 0x10e (UnauthorizedInitializer)
```

**Cause:** The signer for account[0] of `InitializeFactory` doesn't match the `PROGRAM_AUTHORITY` constant hardcoded in the program.

**Fix:** Ensure you're signing with the keypair at `apps/programs/vault/program-authority-keypair.json`. Verify the public key matches:
```bash
solana-keygen pubkey apps/programs/vault/program-authority-keypair.json
# Must output: 9hLNRfyFw32aU6xyKZHSUSJt3N2QC9oen8HDqPyJ3Ryf
```

### Unauthorized Vault Creator on Initialize

```
Error: custom program error: 0x11c (UnauthorizedVaultCreator)
```

**Cause:** The signer is not a factory owner or factory admin. After the factory is created, vault creation is gated by the factory's admin list, not the `PROGRAM_AUTHORITY`.

**Fix:** Ensure the signer is either the factory owner or has been added as a factory admin via `AddFactoryAdmin` (0x0E).

---

## Security Notes

1. **Never commit keypair files.** The `.gitignore` rule `*-keypair.json` prevents this, but always verify before pushing.

2. **Backup the program keypair.** If `target/deploy/omaha_vault-keypair.json` is lost (e.g., after `cargo clean`), you cannot upgrade the program at the same address. Back it up securely outside the repo.

3. **Backup the program authority keypair.** If `apps/programs/vault/program-authority-keypair.json` is lost, no new vaults can be initialized. The only recovery is deploying a new program version with a new authority constant.

4. **Use separate keypairs for mainnet.** The devnet keypairs should NOT be reused for mainnet. Generate fresh keypairs for production deployment.

5. **Consider revoking upgrade authority for mainnet.** Once the program is battle-tested, you may want to make it immutable:
   ```bash
   solana program set-upgrade-authority <PROGRAM_ID> --final --url mainnet-beta
   ```
   This is irreversible — the program can never be upgraded again.

6. **Environment variable keypairs** (`ADMIN_PROGRAM_PRIVATE_KEY`, `FEE_PAYER_PRIVATE_KEY`) must only live in `.env` files that are gitignored. Never log or expose these values.

---

## Current Devnet Deployment

| Property          | Value                                              |
| ----------------- | -------------------------------------------------- |
| Program ID        | `5yY17NisfXbyjanUEBxrdKsSCuRiWcjzEt6LXGZqDiVR`   |
| Upgrade Authority | `GXQcRCwsCrJpueQ6cB6PSkHGXSwLydKhnWbqFmY3fT33`   |
| Program Authority | `9hLNRfyFw32aU6xyKZHSUSJt3N2QC9oen8HDqPyJ3Ryf`   |
| Data Length        | ~97KB                                              |
| Cluster           | Devnet (`https://api.devnet.solana.com`)           |
| Last Upgrade      | 2026-03-16                                         |
| Features          | 201 tests (incl. 27 multi-interaction), USDC balance pre-flight checks (WithdrawWithPrice, FulfillWithdraw), instant vs queued withdrawal decision logic |
