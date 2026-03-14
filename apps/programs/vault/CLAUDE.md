# CLAUDE.md — apps/programs/vault

> Omaha's on-chain tokenized vault program built with Pinocchio on Solana.
> Read this FIRST before modifying any Rust code in this directory.

## What This Program Does

A minimal Solana program that manages a tokenized vault. Users deposit base tokens (e.g. USDC), receive share tokens at a configurable price, and can withdraw by burning shares. The vault can execute arbitrary CPI to any Solana program (Jupiter, DeFi protocols, etc.) as a PDA signer — this is the core feature enabling on-chain strategy execution.

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

**Runtime**: `no_std`, no heap allocator beyond Solana's default. Binary ~37KB.

**Dual token model**: Base token operations (Transfer) use legacy SPL Token (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`). Share mint operations (MintTo, Burn, Initialize) use SPL Token 2022 (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`) with MetadataPointer, TokenMetadata, and MintCloseAuthority extensions. `pinocchio-token` hardcodes the legacy program ID, so share token CPI uses raw wrappers in `src/token2022.rs`.

## Critical Rules

1. **Pin pinocchio to 0.9.x** — version 0.10.x has a completely different API (`AccountView`, `Address` instead of `AccountInfo`, `Pubkey`). The helper crates (token, system, pubkey) are pinned to compatible 0.4/0.2 versions.
2. **`Pubkey` is `[u8; 32]`** — a type alias, not a struct. No methods. Use free functions like `pinocchio::pubkey::find_program_address()`.
3. **`no_std` entrypoint** — must use `program_entrypoint!()` + `default_allocator!()` + `nostd_panic_handler!()`. NOT `entrypoint!()` which requires `std`.
4. **`Signer` and `Seed`** live in `pinocchio::instruction`, NOT `pinocchio::cpi`.
5. **State is zero-copy** — cast directly from account data via bytemuck. Never serialize/deserialize.
6. **Replace program ID before mainnet deploy** — current `declare_id!` uses a dev keypair.

## File Layout

```
apps/programs/vault/
├── Cargo.toml              # Crate config, dependency versions
├── CLAUDE.md               # This file
├── src/
│   ├── lib.rs              # Entrypoint + instruction routing (13 discriminators)
│   ├── state.rs            # VaultState (488B) + PendingDeposit (80B) + PendingWithdraw (80B, bytemuck Pod)
│   ├── error.rs            # 14 custom errors (0x100-0x10D)
│   ├── fees.rs             # Pure fee math (entry/exit/management/performance)
│   ├── rent.rs             # Const fn rent exemption calculation
│   ├── token2022.rs        # Raw CPI wrappers for SPL Token 2022 (mint_to, burn, extensions, metadata)
│   └── instructions/
│       ├── mod.rs          # Re-exports all instruction structs
│       ├── initialize.rs   # Create vault PDA + Token 2022 share mint PDA (with metadata extensions)
│       ├── set_share_price.rs  # Admin-only price update
│       ├── execute.rs      # Generic CPI passthrough (key feature)
│       ├── add_owner.rs    # Admin-only: add operator
│       ├── remove_owner.rs # Admin-only: remove operator
│       ├── deposit_with_price.rs  # Admin: set price + deposit atomically (+ entry fee)
│       ├── request_deposit.rs     # User: request async deposit (step 1)
│       ├── fulfill_deposit.rs     # Admin: fulfill pending deposit (step 2, + entry fee)
│       ├── withdraw_with_price.rs # Admin: set price + withdraw atomically (+ exit fee)
│       ├── request_withdraw.rs    # User: request async withdraw (step 1)
│       ├── fulfill_withdraw.rs    # Admin: fulfill pending withdraw (step 2, + exit fee)
│       ├── update_fees.rs         # Admin: set fee BPS values + fee receiver
│       └── collect_fees.rs        # Admin: mint management + performance fee shares
└── tests/
    ├── helpers.rs          # Shared test utilities (mollusk setup, account builders)
    ├── initialize.rs       # Integration tests for Initialize instruction
    ├── set_share_price.rs  # Integration tests for SetSharePrice instruction
    ├── execute.rs          # Integration tests for Execute (CPI passthrough)
    ├── add_owner.rs        # Integration tests for AddOwner instruction
    ├── remove_owner.rs     # Integration tests for RemoveOwner instruction
    ├── deposit_with_price.rs # Integration tests for DepositWithPrice instruction
    ├── request_deposit.rs  # Integration tests for RequestDeposit instruction
    ├── fulfill_deposit.rs  # Integration tests for FulfillDeposit instruction
    ├── withdraw_with_price.rs # Integration tests for WithdrawWithPrice instruction
    ├── request_withdraw.rs # Integration tests for RequestWithdraw instruction
    ├── fulfill_withdraw.rs # Integration tests for FulfillWithdraw instruction
    ├── update_fees.rs      # Integration tests for UpdateFees instruction
    ├── collect_fees.rs     # Integration tests for CollectFees instruction
    ├── routing.rs          # Integration tests for instruction discriminator routing
    └── share_math.rs       # Unit tests for share price math
```

## Instructions

Instruction discriminators use the `0x00–0x0C` range. Account discriminators use a separate `0xA1–0xA3` range to avoid collisions.

| Disc | Instruction | Group | Access | Description |
|------|------------|-------|--------|-------------|
| 0x00 | Initialize | Setup | Admin (signer) | Creates vault PDA, Token 2022 share mint PDA with metadata extensions |
| 0x01 | AddOwner | Setup | Admin only | Adds an operator pubkey (max 10) |
| 0x02 | RemoveOwner | Setup | Admin only | Removes an operator pubkey (swap-remove) |
| 0x03 | SetSharePrice | Admin Ops | Admin only | Updates `share_price` in vault state |
| 0x04 | Execute | Admin Ops | Admin or Owner | Generic CPI — vault PDA signs any instruction to any program |
| 0x05 | UpdateFees | Fee Mgmt | Admin only | Sets fee BPS values (entry/exit/mgmt/perf) + fee receiver pubkey |
| 0x06 | CollectFees | Fee Mgmt | Admin only | Mints management + performance fee shares to fee receiver |
| 0x07 | DepositWithPrice | Deposit | Admin only | Sets share price + deposits atomically (2 signers) |
| 0x08 | RequestDeposit | Deposit | Anyone | Creates PendingDeposit PDA, transfers base tokens to vault |
| 0x09 | FulfillDeposit | Deposit | Admin only | Sets price, mints shares for pending deposit, closes PDA |
| 0x0A | WithdrawWithPrice | Withdraw | Admin only | Sets share price + withdraws atomically (2 signers) |
| 0x0B | RequestWithdraw | Withdraw | Anyone | Burns shares, creates PendingWithdraw PDA |
| 0x0C | FulfillWithdraw | Withdraw | Admin only | Sets price, transfers base tokens, closes PendingWithdraw PDA |

## PDA Seeds

| PDA | Seeds | Authority |
|-----|-------|-----------|
| vault_state | `["vault", admin_pubkey, base_mint]` | Program owns the account |
| share_mint | `["share_mint", vault_state_pubkey]` | vault_state PDA is mint authority |
| pending_deposit | `["pending_deposit", vault_state_pubkey, depositor_pubkey]` | Program owns; closed after fulfill |
| pending_withdraw | `["pending_withdraw", vault_state_pubkey, withdrawer_pubkey]` | Program owns; closed after fulfill |

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
- **Management fee**: Collected via `CollectFees`, minted as new shares
- **Performance fee**: Only charged when share price exceeds high water mark (HWM)
- **CollectFees first call**: Initializes `last_fee_timestamp`, mints no fees

Fee receiver is an optional account in deposit instructions (via `accounts.get(N)`).

## VaultState Layout (488 bytes)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 1 | discriminator | Account type guard (always 0xA1) |
| 1 | 1 | bump | Vault PDA bump seed |
| 2 | 1 | share_decimals | Share token decimal places |
| 3 | 1 | num_owners | Active owner count (0..10) |
| 4 | 2 | entry_fee_bps | Entry fee in basis points |
| 6 | 2 | exit_fee_bps | Exit fee in basis points |
| 8 | 2 | management_fee_bps | Management fee in basis points |
| 10 | 2 | performance_fee_bps | Performance fee in basis points |
| 12 | 4 | _padding | Alignment padding |
| 16 | 32 | admin | Admin pubkey |
| 48 | 32 | share_mint | Share Token 2022 mint (with metadata extensions) |
| 80 | 32 | base_mint | Deposit token mint |
| 112 | 32 | fee_receiver | Fee receiver pubkey (all zeros = none) |
| 144 | 8 | share_price | Price per share (base token smallest units) |
| 152 | 8 | high_water_mark | HWM for performance fee calculation |
| 160 | 8 | last_fee_timestamp | Unix timestamp of last fee collection |
| 168 | 320 | owners | Up to 10 operator pubkeys (32 bytes each) |

## PendingDeposit Layout (80 bytes)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 1 | discriminator | Account type guard (always 0xA2) |
| 1 | 1 | bump | PDA bump seed |
| 2 | 6 | _padding | Alignment padding |
| 8 | 32 | vault_state | Vault this deposit belongs to |
| 40 | 32 | depositor | Who made the deposit |
| 72 | 8 | amount | Base token amount deposited |

## PendingWithdraw Layout (80 bytes)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 1 | discriminator | Account type guard (always 0xA3) |
| 1 | 1 | bump | PDA bump seed |
| 2 | 6 | _padding | Alignment padding |
| 8 | 32 | vault_state | Vault this withdrawal belongs to |
| 40 | 32 | withdrawer | Who initiated the withdrawal |
| 72 | 8 | shares | Number of share tokens burned |

## Access Control

| Role | Initialize | SetSharePrice | Execute | AddOwner | RemoveOwner | DepositWithPrice | RequestDeposit | FulfillDeposit | WithdrawWithPrice | RequestWithdraw | FulfillWithdraw | UpdateFees | CollectFees |
|------|-----------|---------------|---------|----------|-------------|-----------------|----------------|----------------|-------------------|-----------------|-----------------|------------|-------------|
| Admin | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Owner | No | No | Yes | No | No | No | Yes | No | No | Yes | No | No | No |
| Anyone | No | No | No | No | No | No | Yes | No | No | Yes | No | No | No |

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 0x100 | Unauthorized | Signer is not admin (or not admin/owner for Execute) |
| 0x101 | InvalidSharePrice | Share price must be > 0 |
| 0x102 | InvalidAmount | Deposit/withdraw amount must be > 0 |
| 0x103 | OwnersFull | Owner list at capacity (10) |
| 0x104 | OwnerNotFound | Owner not in list (remove) |
| 0x105 | InvalidDiscriminator | Wrong account discriminator (expected 0xA1/0xA2/0xA3) |
| 0x106 | MathOverflow | Arithmetic overflow in share calculation |
| 0x107 | InsufficientFunds | Vault lacks base tokens for withdrawal |
| 0x108 | DuplicateOwner | Owner already exists (add) |
| 0x109 | InvalidPendingDeposit | Pending deposit account invalid |
| 0x10A | InvalidPendingWithdraw | Pending withdraw account invalid |
| 0x10B | FeeExceedsMaximum | Fee BPS exceeds allowed maximum |
| 0x10C | NoFeesToCollect | No fee receiver set or no fees to collect |
| 0x10D | InvalidMetadata | Metadata string exceeds max length (128 bytes) |

## Build & Test

```bash
# From monorepo root:
pnpm program:build    # cargo build-sbf with bpf-entrypoint feature
pnpm program:test     # SBF_OUT_DIR=$PWD/target/deploy cargo test (145 tests total)
```

The test suite has **145 tests**: 53 unit tests (state, fees, share math) and 92 integration tests via `mollusk-svm`.

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
| `mint_to()` | 7 | Mint share tokens (deposit flows, fee collection) |
| `burn()` | 8 | Burn share tokens (withdraw flows) |
| `initialize_mint2()` | 20 | Initialize Token 2022 mint |
| `initialize_mint_close_authority()` | 25 | Set close authority extension |
| `initialize_metadata_pointer()` | 39/0 | Set metadata pointer extension |
| `initialize_token_metadata()` | 8-byte SHA256 | Initialize on-mint metadata |
| `calculate_mint_space()` | — | Calculate final mint account size for rent |

Constants: `TOKEN_2022_PROGRAM_ID`, `INITIAL_MINT_SPACE` (270 bytes), `MAX_METADATA_STRING_LEN` (128).

### Dual Token Program Instructions

Instructions that touch both base tokens and share tokens require two token programs:

| Instruction | Legacy SPL Token (base) | Token 2022 (share) | Account Count |
|-------------|------------------------|-------------------|---------------|
| DepositWithPrice | Transfer base tokens | MintTo shares | 10 (+ optional fee_receiver) |
| WithdrawWithPrice | Transfer base tokens | Burn shares | 9 |
| FulfillDeposit | — | MintTo shares | 9 (+ optional fee_receiver) |
| RequestWithdraw | — | Burn shares | 8 |
| CollectFees | — | MintTo fee shares | 5 |

Instructions that only touch base tokens (RequestDeposit, FulfillWithdraw) use legacy SPL Token only — no changes.

## Execute Instruction (CPI Passthrough)

The `Execute` instruction is the key feature. It allows the vault to interact with any Solana program as a signer:

- Uses `MaybeUninit` stack arrays (no heap) for dynamic `AccountMeta` construction
- Accounts matching the vault PDA address are automatically marked as signers in the CPI
- Capped at 32 forwarded accounts per CPI call
- Uses `cpi::slice_invoke_signed` for dynamic account counts
- Target instruction data is passed verbatim after the discriminator byte
