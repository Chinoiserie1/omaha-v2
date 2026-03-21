# Vault Program — Mainnet Deployment

Deployed on **2026-03-21**.

## On-Chain Addresses

| Role | Address |
|------|---------|
| **Program ID** | `2jPr4HDqnzyHdEvwxJxq7NAmt67mEnmHyxhHtV1Cwz8C` |
| **Factory PDA** | `34Eu1r4mQN7E3u5mB5GZ3wrBCLfiAtfFX2hay6n1hS4n` |
| **Factory Owner (Admin)** | `GhRsrhp57iD3SSa3MzjCnxKSLiEUa8UFmMpC4VtwcKU4` |
| **Program Authority** | `FZdLXHrkoFVyLcsmQ88TS3w9XKqkku1jFhpMaLkrNCqw` |
| **Upgrade Authority** | `FZdLXHrkoFVyLcsmQ88TS3w9XKqkku1jFhpMaLkrNCqw` (same as program authority) |
| **RPC Provider** | Helius |

## Keypair Inventory

### 1. Program Authority / Upgrade Authority (COLD STORAGE)

| Property | Value |
|----------|-------|
| **Purpose** | Deployed the program. Co-signed `InitializeFactory`. Can upgrade program binary. |
| **Public Key** | `FZdLXHrkoFVyLcsmQ88TS3w9XKqkku1jFhpMaLkrNCqw` |
| **File** | `apps/programs/vault/program-authority-mainnet-keypair.json` |
| **Env Var** | `PROGRAM_AUTHORITY_PRIVATE_KEY` (removed from `.env` after factory init) |
| **Status** | **Cold storage** — only needed for program upgrades via `solana program deploy` |

**Where it's hardcoded:**

| File | Usage |
|------|-------|
| `apps/programs/vault/src/lib.rs:11` | `declare_id!` (program ID derived from this keypair's deploy) |
| `apps/programs/vault/src/lib.rs:16-21` | `PROGRAM_AUTHORITY` constant (hex bytes) |
| `packages/omaha-programs-sdk/src/constants.ts:4-14` | `VAULT_PROGRAM_ID` + `PROGRAM_AUTHORITY` |
| `apps/programs/vault/tests/helpers.rs:27-38` | `program_id()` + `program_authority()` |

### 2. Admin Keypair (OPERATIONAL — lives in .env)

| Property | Value |
|----------|-------|
| **Purpose** | Factory owner, vault admin, backend operations |
| **Public Key** | `GhRsrhp57iD3SSa3MzjCnxKSLiEUa8UFmMpC4VtwcKU4` |
| **File** | `admin-program-mainnet-keypair.json` (repo root, gitignored) |
| **Env Var** | `ADMIN_PROGRAM_KEYPAIR` (stays in `.env` permanently) |
| **Status** | **Active** — used by backend at runtime |

**What it can do:**
- Factory: add/remove admins, transfer ownership, pause/unpause
- Vaults: create, set prices, execute trades, manage operators, collect fees
- Signs all backend transactions (rebalance cron, deposit fulfillment, etc.)

### 3. Program Keypair (BACKUP ONLY)

| Property | Value |
|----------|-------|
| **Purpose** | Derived the program ID at deploy time |
| **Public Key** | `2jPr4HDqnzyHdEvwxJxq7NAmt67mEnmHyxhHtV1Cwz8C` |
| **File** | `target/deploy/omaha_vault_mainnet-keypair.json` |
| **Status** | **Backed up** — only needed if re-deploying to the same address |

## Vaults

| Name | Symbol | Vault State PDA | Share Mint PDA |
|------|--------|-----------------|----------------|
| mert | oMERT | `GCpt7MoHjjgF13X8ekKw79rEvo1EhKPzBtQ6nXXQbp4N` | `HGtLrjgTMmeFAnm1oD3BgoccvzKGbTo4g9AujvVnvsyJ` |

## Deployment Transactions

| Step | Signature |
|------|-----------|
| **Program Deploy** | `2K2PwM2qaoTcEp9FqwhvzwhZPRqFbmTs2yByXmnGkoBypMrr7S3taPRZ94wXFjxyN4xPj3xmReMLEoXWBkey94gZ` |
| **Initialize Factory** | `twqoUCikS4T7jQr2HJPim4SCxm4pRpkB31mCBwq5FQgc1mqi1VQ7PRxq4h1fHma3RSKw1BDMLaqgsukmWpEJLnB` |
| **Create Vault "mert"** | `1KSYvB8ChBXPHnFXbosqdEvs8PPmVJqdAroRhvyrYM5M8fUaLqvYV7MWrTzERki2VF3a42AxgfDMPjujuXQjcdr` |

## Verification Commands

```bash
# Verify program
solana program show 2jPr4HDqnzyHdEvwxJxq7NAmt67mEnmHyxhHtV1Cwz8C \
  --url "https://mainnet.helius-rpc.com/?api-key=<KEY>"

# Verify factory PDA exists
solana account 34Eu1r4mQN7E3u5mB5GZ3wrBCLfiAtfFX2hay6n1hS4n \
  --url "https://mainnet.helius-rpc.com/?api-key=<KEY>"
```

## Backend .env (Production)

```env
SOLANA_NETWORK=mainnet
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<KEY>
USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
ADMIN_PROGRAM_KEYPAIR='<base58 from admin-program-mainnet-keypair.json>'
# PROGRAM_AUTHORITY_PRIVATE_KEY removed — cold storage
```

## Creating a Vault

```bash
pnpm create-vault-onchain -- \
  --name "vault-name" \
  --base-mint EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
  --chain mainnet \
  --dry-run

# Remove --dry-run to execute
```

## Upgrading the Program

Bring the program authority keypair out of cold storage:

```bash
solana program deploy target/deploy/omaha_vault.so \
  --program-id target/deploy/omaha_vault_mainnet-keypair.json \
  --keypair apps/programs/vault/program-authority-mainnet-keypair.json \
  --url "https://mainnet.helius-rpc.com/?api-key=<KEY>"
```

## Making the Program Immutable (IRREVERSIBLE)

```bash
solana program set-upgrade-authority 2jPr4HDqnzyHdEvwxJxq7NAmt67mEnmHyxhHtV1Cwz8C \
  --final \
  --keypair apps/programs/vault/program-authority-mainnet-keypair.json \
  --url "https://mainnet.helius-rpc.com/?api-key=<KEY>"
```

**This is irreversible.** The program can never be upgraded again.

## Security Notes

- Program authority keypair is in cold storage — not in `.env`, not on any server
- Admin keypair (`ADMIN_PROGRAM_KEYPAIR`) is the only key on the backend server
- All keypair files are gitignored (`*-keypair.json`)
- RPC API keys should be rotated periodically
- Consider transferring upgrade authority to a multisig for additional security
