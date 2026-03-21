# CLAUDE.md — apps/programs/vault

> Omaha's on-chain tokenized vault program built with Pinocchio on Solana.
> Read this FIRST before modifying any Rust code in this directory.

## What This Program Does

A minimal Solana program that manages tokenized vaults under a shared factory. Users deposit base tokens (e.g. USDC), receive share tokens at a configurable price, and can withdraw by burning shares. The vault can execute arbitrary CPI to any Solana program (Jupiter, DeFi protocols, etc.) as a PDA signer — this is the core feature enabling on-chain strategy execution.

The program has **two domains**: a singleton **Factory** (program-level governance) and per-vault **VaultState** accounts. Vault creation is gated by factory admins/owner rather than a raw program authority constant.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Pinocchio | 0.9.x |
| Base token CPI | pinocchio-token | 0.4.x |
| Share token CPI | Raw CPI to Token 2022 | via `src/token2022.rs` |
| System CPI | pinocchio-system | 0.4.x |
| PDA utils | pinocchio-pubkey | 0.2.x |
| Logging | pinocchio-log | 0.4.x |
| Zero-copy | bytemuck | 1.x |

**Runtime**: `no_std`, no heap allocator beyond Solana's default.

**Dual token model**: Base token operations (Transfer) use legacy SPL Token (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`). Share mint operations (MintTo, Burn, Initialize) use SPL Token 2022 (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`) with MetadataPointer, TokenMetadata, and MintCloseAuthority extensions. `pinocchio-token` hardcodes the legacy program ID, so share token CPI uses raw wrappers in `src/token2022.rs`.

## Critical Rules

1. **Pin pinocchio to 0.9.x** — version 0.10.x has a completely different API (`AccountView`, `Address` instead of `AccountInfo`, `Pubkey`). The helper crates (token, system, pubkey) are pinned to compatible 0.4/0.2 versions.
2. **`Pubkey` is `[u8; 32]`** — a type alias, not a struct. No methods. Use free functions like `pinocchio::pubkey::find_program_address()`.
3. **`no_std` entrypoint** — must use `program_entrypoint!()` + `default_allocator!()` + `nostd_panic_handler!()`. NOT `entrypoint!()` which requires `std`.
4. **`Signer` and `Seed`** live in `pinocchio::instruction`, NOT `pinocchio::cpi`.
5. **State is zero-copy** — cast directly from account data via bytemuck. Never serialize/deserialize.
6. **Program IDs** — Mainnet: `2jPr4HDqnzyHdEvwxJxq7NAmt67mEnmHyxhHtV1Cwz8C`. Devnet: `5yY17NisfXbyjanUEBxrdKsSCuRiWcjzEt6LXGZqDiVR`. The code currently has mainnet addresses in `declare_id!` and `PROGRAM_AUTHORITY`. See [VAULT-MAINNET.md](../../../docs/deployment/VAULT-MAINNET.md) for full address inventory.
7. **`PROGRAM_AUTHORITY` constant** — hardcoded pubkey in `lib.rs` used **only** for `InitializeFactory`. After factory creation, vault creation is gated by factory admins/owner instead.
8. **Zero pubkey validation** — `AddOperator` and `AddFactoryAdmin` reject the zero pubkey (`ZeroPubkey` error 0x119).
9. **Clock via sysvar** — `CollectFees` reads the current timestamp from the Clock sysvar (`src/sysvar.rs`), not from caller-supplied data.
10. **Pending expiry** — pending deposits/withdrawals expire after 48 hours (`PENDING_EXPIRY_SECONDS = 172_800`). Users can cancel after expiry; `CancelDeposit`/`CancelWithdraw` enforce the time check.

## File Layout

```
apps/programs/vault/
├── Cargo.toml              # Crate config, dependency versions
├── CLAUDE.md               # This file
├── src/
│   ├── lib.rs              # Entrypoint + instruction routing (26 discriminators)
│   ├── state.rs            # FactoryState (400B) + VaultState (584B) + PendingDeposit (88B) + PendingWithdraw (88B, bytemuck Pod)
│   ├── error.rs            # 29 custom errors (0x100-0x11C)
│   ├── fees.rs             # Pure fee math (entry/exit/management/performance)
│   ├── rent.rs             # Const fn rent exemption calculation
│   ├── sysvar.rs           # Clock sysvar reading (used by CollectFees)
│   ├── token2022.rs        # Raw CPI wrappers for SPL Token 2022 (transfer, mint_to, burn, extensions, metadata)
│   └── instructions/
│       ├── mod.rs                     # Re-exports all 26 instruction structs from subdirectories
│       ├── factory/                   # Factory governance (0x0D–0x13)
│       │   ├── mod.rs
│       │   ├── initialize_factory.rs      # 0x0D: Create singleton factory PDA (requires PROGRAM_AUTHORITY)
│       │   ├── add_factory_admin.rs       # 0x0E: Factory owner: add factory admin
│       │   ├── remove_factory_admin.rs    # 0x0F: Factory owner: remove factory admin
│       │   ├── transfer_factory_ownership.rs  # 0x10: Factory owner: propose new owner (2-step)
│       │   ├── accept_factory_ownership.rs    # 0x11: Pending owner: accept factory ownership
│       │   ├── pause_factory.rs           # 0x12: Factory owner/admin: globally pause all vaults
│       │   └── unpause_factory.rs         # 0x13: Factory owner/admin: unpause factory
│       ├── vault_setup/               # Vault lifecycle & admin (0x00–0x04, 0x14–0x17)
│       │   ├── mod.rs
│       │   ├── initialize.rs              # 0x00: Create vault PDA + Token 2022 share mint
│       │   ├── add_operator.rs            # 0x01: Admin-only: add vault operator
│       │   ├── remove_operator.rs         # 0x02: Admin-only: remove vault operator
│       │   ├── set_share_price.rs         # 0x03: Admin-only price update
│       │   ├── execute.rs                 # 0x04: Generic CPI passthrough (key feature)
│       │   ├── transfer_vault_admin.rs    # 0x14: Propose new vault admin (2-step)
│       │   ├── accept_vault_admin.rs      # 0x15: Accept vault admin role
│       │   ├── pause_vault.rs             # 0x16: Pause individual vault
│       │   └── unpause_vault.rs           # 0x17: Unpause individual vault
│       ├── deposit/                   # Deposit flow (0x07–0x09, 0x18)
│       │   ├── mod.rs
│       │   ├── deposit_with_price.rs      # 0x07: Set price + deposit atomically (+ entry fee)
│       │   ├── request_deposit.rs         # 0x08: Request async deposit (snapshots entry_fee_bps)
│       │   ├── fulfill_deposit.rs         # 0x09: Fulfill pending deposit (uses fee snapshot)
│       │   └── cancel_deposit.rs          # 0x18: Cancel expired pending deposit (refunds base tokens)
│       ├── withdraw/                  # Withdraw flow (0x0A–0x0C, 0x19)
│       │   ├── mod.rs
│       │   ├── withdraw_with_price.rs     # 0x0A: Set price + withdraw atomically (+ exit fee)
│       │   ├── request_withdraw.rs        # 0x0B: Request async withdraw (snapshots exit_fee_bps)
│       │   ├── fulfill_withdraw.rs        # 0x0C: Fulfill pending withdraw (uses fee snapshot)
│       │   └── cancel_withdraw.rs         # 0x19: Cancel expired pending withdraw (refunds shares)
│       └── fees/                      # Fee management (0x05–0x06)
│           ├── mod.rs
│           ├── update_fees.rs             # 0x05: Set fee BPS values + fee receiver
│           └── collect_fees.rs            # 0x06: Mint management + performance fee shares
└── tests/
    ├── helpers.rs              # Shared test utilities (mollusk setup, account builders)
    ├── initialize.rs           # Integration tests for Initialize instruction
    ├── set_share_price.rs      # Integration tests for SetSharePrice instruction
    ├── execute.rs              # Integration tests for Execute (CPI passthrough)
    ├── add_operator.rs         # Integration tests for AddOperator instruction
    ├── remove_operator.rs      # Integration tests for RemoveOperator instruction
    ├── add_owner.rs            # Legacy test file (superseded by add_operator.rs)
    ├── remove_owner.rs         # Legacy test file (superseded by remove_operator.rs)
    ├── deposit_with_price.rs   # Integration tests for DepositWithPrice instruction
    ├── request_deposit.rs      # Integration tests for RequestDeposit instruction
    ├── fulfill_deposit.rs      # Integration tests for FulfillDeposit instruction
    ├── withdraw_with_price.rs  # Integration tests for WithdrawWithPrice instruction
    ├── request_withdraw.rs     # Integration tests for RequestWithdraw instruction
    ├── fulfill_withdraw.rs     # Integration tests for FulfillWithdraw instruction
    ├── update_fees.rs          # Integration tests for UpdateFees instruction
    ├── collect_fees.rs         # Integration tests for CollectFees instruction
    ├── routing.rs              # Integration tests for instruction discriminator routing
    ├── share_math.rs           # Unit tests for share price math
    ├── multi_interaction.rs    # Multi-step deposit integration tests (14 tests: sequential deposits, multi-vault, full cycle, fees, pause, cancel)
    └── multi_interaction_withdraw.rs  # Multi-step withdraw integration tests (13 tests: sequential withdrawals, multi-vault, partial, price changes, fees, pause, cancel, depletion)
```

## Two-Domain Architecture

```
PROGRAM_AUTHORITY (keypair)
        │
        └─ InitializeFactory (0x0D) ──► factory_state PDA ["factory"]
                                              │  owner, admins[10], is_paused, vault_count
                                              │
                          ┌───────────────────┘
                          │ factory admin/owner co-signs
                          ▼
                    Initialize (0x00) ──► vault_state PDA ["vault", name]
                                              │  admin, operators[10], is_paused, factory ref
                                              │
                                              ├──► share_mint PDA ["share_mint", vault_state]
                                              └──► pending_deposit/withdraw PDAs (per user)
```

- **Factory domain** (0x0D–0x13): Governs who can create vaults. Singleton. Only `PROGRAM_AUTHORITY` can initialize it.
- **Vault domain** (0x00–0x0C, 0x14–0x19): Per-vault operations. Vault creation requires factory_state to be passed and checks factory is not paused + caller is factory owner/admin.

## Instructions

Instruction discriminators use the `0x00–0x19` range. Account discriminators use a separate `0xA1–0xA4` range to avoid collisions.

### 0x00–0x0C: Vault Operations (original)

| Disc | Instruction | Group | Access | Description |
|------|------------|-------|--------|-------------|
| 0x00 | Initialize | Setup | Factory owner/admin + Vault admin (signers) | Creates vault PDA (seeds: ["vault", name]), Token 2022 share mint PDA; checks factory not paused |
| 0x01 | AddOperator | Setup | Vault admin only | Adds an operator pubkey (max 10); rejects zero pubkey |
| 0x02 | RemoveOperator | Setup | Vault admin only | Removes an operator pubkey (swap-remove) |
| 0x03 | SetSharePrice | Admin Ops | Vault admin only | Updates `share_price` in vault state |
| 0x04 | Execute | Admin Ops | Admin or Operator | Generic CPI — vault PDA signs any instruction to any program |
| 0x05 | UpdateFees | Fee Mgmt | Vault admin only | Sets fee BPS values (entry/exit/mgmt/perf) + fee receiver pubkey |
| 0x06 | CollectFees | Fee Mgmt | Vault admin only | Mints management + performance fee shares; reads Clock sysvar for timestamp |
| 0x07 | DepositWithPrice | Deposit | Vault admin only | Sets share price + deposits atomically (2 signers) |
| 0x08 | RequestDeposit | Deposit | Anyone | Creates PendingDeposit PDA, transfers base tokens to vault; snapshots entry_fee_bps + created_at |
| 0x09 | FulfillDeposit | Deposit | Vault admin only | Sets price, mints shares using fee snapshot from PendingDeposit, closes PDA |
| 0x0A | WithdrawWithPrice | Withdraw | Vault admin only | Sets share price + withdraws atomically (2 signers); includes USDC balance pre-flight check |
| 0x0B | RequestWithdraw | Withdraw | Anyone | Transfers shares to vault escrow ATA, creates PendingWithdraw PDA; snapshots exit_fee_bps + created_at |
| 0x0C | FulfillWithdraw | Withdraw | Vault admin only | Burns escrowed shares, sets price, transfers base tokens using fee snapshot, closes PendingWithdraw PDA; includes USDC balance pre-flight check |

### 0x0D–0x13: Factory Management (new)

| Disc | Instruction | Access | Description |
|------|------------|--------|-------------|
| 0x0D | InitializeFactory | PROGRAM_AUTHORITY only | Creates singleton factory_state PDA (seeds: ["factory"]); sets owner |
| 0x0E | AddFactoryAdmin | Factory owner only | Adds a factory admin pubkey (max 10); rejects zero pubkey |
| 0x0F | RemoveFactoryAdmin | Factory owner only | Removes a factory admin (swap-remove) |
| 0x10 | TransferFactoryOwnership | Factory owner only | Proposes new factory owner (sets pending_owner, step 1 of 2) |
| 0x11 | AcceptFactoryOwnership | Pending owner only | Accepts factory ownership transfer (step 2 of 2) |
| 0x12 | PauseFactory | Factory owner/admin | Sets factory is_paused = 1; blocks all vault creation |
| 0x13 | UnpauseFactory | Factory owner/admin | Clears factory is_paused |

### 0x14–0x17: Vault Admin Transfer & Pause (new)

| Disc | Instruction | Access | Description |
|------|------------|--------|-------------|
| 0x14 | TransferVaultAdmin | Vault admin only | Proposes new vault admin (sets pending_admin, step 1 of 2) |
| 0x15 | AcceptVaultAdmin | Pending vault admin only | Accepts vault admin transfer (step 2 of 2) |
| 0x16 | PauseVault | Vault admin only | Sets vault is_paused = 1; blocks deposits/withdrawals |
| 0x17 | UnpauseVault | Vault admin only | Clears vault is_paused |

### 0x18–0x19: Cancel Pending (new)

| Disc | Instruction | Access | Description |
|------|------------|--------|-------------|
| 0x18 | CancelDeposit | Depositor only (after expiry) | Cancels expired PendingDeposit; returns base tokens to depositor; closes PDA |
| 0x19 | CancelWithdraw | Withdrawer only (after expiry) | Cancels expired PendingWithdraw; returns escrowed shares to withdrawer; closes PDA |

## PDA Seeds

| PDA | Seeds | Discriminator | Authority |
|-----|-------|---------------|-----------|
| factory_state | `["factory"]` | 0xA4 | Singleton; initialized once by PROGRAM_AUTHORITY |
| vault_state | `["vault", vault_name]` | 0xA1 | Program owns; vault_name is globally unique (e.g. "quant-username") |
| share_mint | `["share_mint", vault_state_pubkey]` | — | vault_state PDA is mint authority |
| pending_deposit | `["pending_deposit", vault_state_pubkey, depositor_pubkey]` | 0xA2 | Program owns; closed after fulfill or cancel |
| pending_withdraw | `["pending_withdraw", vault_state_pubkey, withdrawer_pubkey]` | 0xA3 | Program owns; closed after fulfill or cancel |

## Share Token Math

- **Deposit**: `shares_to_mint = amount * 10^share_decimals / share_price`
- **Withdraw**: `base_to_return = shares_to_burn * share_price / 10^share_decimals`

All arithmetic uses checked math to prevent overflow. Fee math uses `u128` intermediates.

## Fee System

Four fee types, all in basis points (BPS, 10,000 = 100%):

| Fee Type | Max BPS | How It Works |
|----------|---------|--------------|
| Entry | 1,000 (10%) | Deducted from minted shares on deposit; fee shares minted to fee_receiver |
| Exit | 1,000 (10%) | Deducted from base tokens returned on withdraw; stays in vault |
| Management | 1,000 (10%) | Time-based AUM fee; `total_supply * mgmt_bps * elapsed / (BPS * SECONDS_PER_YEAR)` |
| Performance | 5,000 (50%) | HWM-based; `(price - hwm) * total_supply * perf_bps / (price * BPS)` |

- **Entry fee**: Manager earns newly minted share tokens on each deposit
- **Exit fee**: Stays in vault, benefiting remaining shareholders
- **Management fee**: Collected via `CollectFees`, minted as new shares; uses Clock sysvar for elapsed time
- **Performance fee**: Only charged when share price exceeds high water mark (HWM)
- **CollectFees first call**: Initializes `last_fee_timestamp`, mints no fees
- **Fee snapshot**: `entry_fee_bps`/`exit_fee_bps` are snapshotted into PendingDeposit/PendingWithdraw at request time; fulfillment uses the snapshot, not the current vault fee

Fee receiver is an optional account in deposit instructions (via `accounts.get(N)`).

## FactoryState Layout (400 bytes)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 1 | discriminator | Account type guard (always 0xA4) |
| 1 | 1 | bump | Factory PDA bump seed |
| 2 | 1 | is_paused | Global pause flag (0 = active, 1 = paused) |
| 3 | 1 | num_admins | Active factory admin count (0..10) |
| 4 | 4 | _padding | Alignment padding |
| 8 | 32 | owner | Factory owner pubkey (transferable via 2-step) |
| 40 | 32 | pending_owner | Proposed new owner (zero if no transfer in progress) |
| 72 | 8 | vault_count | Total vaults created through this factory |
| 80 | 320 | admins | Up to 10 factory admin pubkeys (32 bytes each) |

## VaultState Layout (584 bytes)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 1 | discriminator | Account type guard (always 0xA1) |
| 1 | 1 | bump | Vault PDA bump seed |
| 2 | 1 | share_decimals | Share token decimal places |
| 3 | 1 | num_operators | Active operator count (0..10) |
| 4 | 2 | entry_fee_bps | Entry fee in basis points |
| 6 | 2 | exit_fee_bps | Exit fee in basis points |
| 8 | 2 | management_fee_bps | Management fee in basis points |
| 10 | 2 | performance_fee_bps | Performance fee in basis points |
| 12 | 1 | vault_name_len | Length of vault name (0..32) |
| 13 | 1 | is_paused | Per-vault pause flag (0 = active, 1 = paused) |
| 14 | 2 | _padding | Alignment padding |
| 16 | 32 | admin | Vault admin pubkey (transferable via 2-step) |
| 48 | 32 | pending_admin | Proposed new admin (zero if no transfer in progress) |
| 80 | 32 | share_mint | Share Token 2022 mint (with metadata extensions) |
| 112 | 32 | base_mint | Deposit token mint |
| 144 | 32 | fee_receiver | Fee receiver pubkey (all zeros = none) |
| 176 | 32 | factory | Back-reference to factory_state that created this vault |
| 208 | 8 | share_price | Price per share (base token smallest units) |
| 216 | 8 | high_water_mark | HWM for performance fee calculation |
| 224 | 8 | last_fee_timestamp | Unix timestamp of last fee collection |
| 232 | 320 | operators | Up to 10 operator pubkeys (32 bytes each) |
| 552 | 32 | vault_name | Vault name bytes (used in PDA seeds) |

## PendingDeposit Layout (88 bytes)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 1 | discriminator | Account type guard (always 0xA2) |
| 1 | 1 | bump | PDA bump seed |
| 2 | 2 | entry_fee_bps | Fee snapshot at request time (protects user from fee changes) |
| 4 | 4 | _padding | Alignment padding |
| 8 | 32 | vault_state | Vault this deposit belongs to |
| 40 | 32 | depositor | Who made the deposit |
| 72 | 8 | amount | Base token amount deposited |
| 80 | 8 | created_at | Unix timestamp of creation (for 48h expiry check) |

## PendingWithdraw Layout (88 bytes)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 1 | discriminator | Account type guard (always 0xA3) |
| 1 | 1 | bump | PDA bump seed |
| 2 | 2 | exit_fee_bps | Fee snapshot at request time (protects user from fee changes) |
| 4 | 4 | _padding | Alignment padding |
| 8 | 32 | vault_state | Vault this withdrawal belongs to |
| 40 | 32 | withdrawer | Who initiated the withdrawal |
| 72 | 8 | shares | Number of share tokens escrowed |
| 80 | 8 | created_at | Unix timestamp of creation (for 48h expiry check) |

## Access Control

| Role | InitFactory | Initialize | AddOperator | RemoveOperator | SetSharePrice | Execute | UpdateFees | CollectFees | DepositWithPrice | RequestDeposit | FulfillDeposit | WithdrawWithPrice | RequestWithdraw | FulfillWithdraw | TransferVaultAdmin | AcceptVaultAdmin | PauseVault | UnpauseVault | CancelDeposit | CancelWithdraw |
|------|------------|-----------|-------------|----------------|---------------|---------|------------|-------------|-----------------|----------------|----------------|------------------|-----------------|-----------------|-------------------|-----------------|------------|--------------|---------------|----------------|
| PROGRAM_AUTHORITY | Yes* | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No |
| Factory owner/admin | No | Yes† | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No |
| Vault Admin | No | No | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No | Yes | Yes | No | No |
| Vault Operator | No | No | No | No | No | Yes | No | No | No | Yes | No | No | Yes | No | No | No | No | No | No | No |
| Pending admin | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | Yes | No | No | No | No |
| Anyone | No | No | No | No | No | No | No | No | No | Yes | No | No | Yes | No | No | No | No | No | No | No |
| Depositor (after expiry) | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | Yes | No |
| Withdrawer (after expiry) | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | No | Yes |

*`InitializeFactory` requires the `PROGRAM_AUTHORITY` constant pubkey as a co-signer. This restricts factory creation to the program operator.

†`Initialize` requires a factory_state account (must have 0xA4 discriminator) and checks that the signer is factory owner or admin, and that the factory is not paused.

Factory management instructions (0x0D–0x13) follow a separate access matrix: `InitializeFactory` → PROGRAM_AUTHORITY; `AddFactoryAdmin`/`RemoveFactoryAdmin`/`TransferFactoryOwnership` → factory owner; `AcceptFactoryOwnership` → pending owner; `PauseFactory`/`UnpauseFactory` → factory owner or any factory admin.

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 0x100 | Unauthorized | Signer is not vault admin (or not admin/operator for Execute) |
| 0x101 | InvalidSharePrice | Share price must be > 0 |
| 0x102 | InvalidAmount | Deposit/withdraw amount must be > 0 |
| 0x103 | OperatorsFull | Operator list at capacity (10) |
| 0x104 | OperatorNotFound | Operator not in list (remove) |
| 0x105 | InvalidDiscriminator | Wrong account discriminator |
| 0x106 | MathOverflow | Arithmetic overflow in share calculation |
| 0x107 | InsufficientFunds | Vault lacks base tokens for withdrawal |
| 0x108 | DuplicateOperator | Operator already exists (add) |
| 0x109 | InvalidPendingDeposit | Pending deposit account invalid |
| 0x10A | InvalidPendingWithdraw | Pending withdraw account invalid |
| 0x10B | FeeExceedsMaximum | Fee BPS exceeds allowed maximum |
| 0x10C | NoFeesToCollect | No fee receiver set or no fees to collect |
| 0x10D | InvalidMetadata | Metadata string exceeds max length (128 bytes) |
| 0x10E | UnauthorizedInitializer | Signer is not the program authority (InitializeFactory) |
| 0x10F | InvalidVaultName | Vault name is empty or exceeds 32 bytes |
| 0x110 | VaultPaused | Vault is paused — operation not allowed |
| 0x111 | FactoryPaused | Factory is paused — vault creation blocked |
| 0x112 | InvalidFactory | Factory account has wrong discriminator or is invalid |
| 0x113 | FactoryAdminsFull | Factory admin list at capacity (10) |
| 0x114 | FactoryAdminNotFound | Factory admin not found (remove) |
| 0x115 | DuplicateFactoryAdmin | Factory admin already exists (add) |
| 0x116 | NoPendingAdmin | No vault admin transfer in progress |
| 0x117 | InvalidPendingAdmin | Signer does not match pending_admin |
| 0x118 | PendingNotExpired | Pending deposit/withdraw has not expired yet (< 48h) |
| 0x119 | ZeroPubkey | Cannot use the zero pubkey as operator or admin |
| 0x11A | NoPendingOwner | No factory ownership transfer in progress |
| 0x11B | InvalidPendingOwner | Signer does not match pending_owner |
| 0x11C | UnauthorizedVaultCreator | Signer is not factory owner or factory admin |

## Build & Test

```bash
# From monorepo root:
pnpm program:build    # cargo build-sbf with bpf-entrypoint feature
pnpm program:test     # SBF_OUT_DIR=$PWD/target/deploy cargo test (201 tests total)
```

The test suite has **201 tests** (60 unit + 141 integration): unit tests (state, fees, share math, error codes) and integration tests via `mollusk-svm`. Includes 27 multi-interaction tests covering sequential deposits/withdrawals, multi-vault flows, full cycles, price change scenarios, fee interactions, pause/unpause flows, cancel+retry, vault depletion, and mixed deposit→withdraw→deposit flows.

Integration tests load the compiled BPF binary from `target/deploy/`. Always run `pnpm program:build` before `pnpm program:test` so mollusk can find the `.so` binary.

### Test Dev-Dependencies

| Crate | Version | Purpose |
|-------|---------|---------|
| mollusk-svm | 0.7 | Lightweight SVM test harness (no validator) |
| mollusk-svm-programs-token | 0.7 | Preloaded SPL Token + Token 2022 programs for mollusk |
| solana-pubkey | 3.0 | Pubkey type for test account construction |
| solana-account | 3.4 | Account data builder |
| solana-instruction | 3.2 | Instruction construction |
| solana-program-error | 3.0 | Error type assertions |
| solana-program-pack | 3.1 | Pack/Unpack trait for SPL state |
| spl-token-interface | 2.0 | SPL Token account / mint state |
| solana-program-option | 3.0 | COption used in SPL mint state |

## Token 2022 Share Mint

The share mint is an SPL Token 2022 mint with three extensions initialized during `Initialize`:

1. **MintCloseAuthority** — vault_state PDA can reclaim rent when vault is wound down
2. **MetadataPointer** — self-referential (metadata stored on the mint account itself)
3. **TokenMetadata** — on-mint name, symbol, and URI (max 128 bytes each)

### token2022.rs Module

Raw CPI wrappers (no `pinocchio-token-2022` crate exists):

| Function | Disc | Purpose |
|----------|------|---------|
| `transfer()` | 3 | Transfer share tokens (escrow in/out for withdraw flows) |
| `mint_to()` | 7 | Mint share tokens (deposit flows, fee collection) |
| `burn()` | 8 | Burn share tokens (fulfill withdraw, atomic withdraw) |
| `initialize_mint2()` | 20 | Initialize Token 2022 mint |
| `initialize_mint_close_authority()` | 25 | Set close authority extension |
| `initialize_metadata_pointer()` | 39/0 | Set metadata pointer extension |
| `initialize_token_metadata()` | 8-byte SHA256 | Initialize on-mint metadata |
| `calculate_mint_space()` | — | Calculate final mint account size for rent |

Constants: `TOKEN_2022_PROGRAM_ID`, `INITIAL_MINT_SPACE` (270 bytes), `MAX_METADATA_STRING_LEN` (128).

### sysvar.rs Module

Reads the Solana Clock sysvar to obtain the current unix timestamp. Used exclusively by `CollectFees` to calculate elapsed time for management fee accrual and by `CancelDeposit`/`CancelWithdraw` to verify expiry. The timestamp is never accepted as caller-supplied instruction data.

### Dual Token Program Instructions

Instructions that touch both base tokens and share tokens require two token programs:

| Instruction | Legacy SPL Token (base) | Token 2022 (share) | Account Count |
|-------------|------------------------|-------------------|---------------|
| DepositWithPrice | Transfer base tokens | MintTo shares | 10 (+ optional fee_receiver) |
| WithdrawWithPrice | Transfer base tokens | Burn shares | 9 |
| FulfillDeposit | — | MintTo shares | 9 (+ optional fee_receiver) |
| RequestWithdraw | — | Transfer shares to escrow | 9 |
| FulfillWithdraw | Transfer base tokens | Burn escrowed shares | 10 |
| CollectFees | — | MintTo fee shares | 6 (includes Clock sysvar) |

Instructions that only touch base tokens (RequestDeposit) use legacy SPL Token only.

## Execute Instruction (CPI Passthrough)

The `Execute` instruction is the key feature. It allows the vault to interact with any Solana program as a signer:

- Uses `MaybeUninit` stack arrays (no heap) for dynamic `AccountMeta` construction
- Accounts matching the vault PDA address are automatically marked as signers in the CPI
- Capped at 32 forwarded accounts per CPI call
- Uses `cpi::slice_invoke_signed` for dynamic account counts
- Target instruction data is passed verbatim after the discriminator byte
