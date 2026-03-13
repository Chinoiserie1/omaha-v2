# CLAUDE.md — apps/programs/vault

> Omaha's on-chain tokenized vault program built with Pinocchio on Solana.
> Read this FIRST before modifying any Rust code in this directory.

## What This Program Does

A minimal Solana program that manages a tokenized vault. Users deposit base tokens (e.g. USDC), receive share tokens at a configurable price, and can withdraw by burning shares. The vault can execute arbitrary CPI to any Solana program (Jupiter, DeFi protocols, etc.) as a PDA signer — this is the core feature enabling on-chain strategy execution.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Pinocchio | 0.9.x |
| Token CPI | pinocchio-token | 0.4.x |
| System CPI | pinocchio-system | 0.4.x |
| PDA utils | pinocchio-pubkey | 0.2.x |
| Logging | pinocchio-log | 0.4.x |
| Zero-copy | bytemuck | 1.x |

**Runtime**: `no_std`, no heap allocator beyond Solana's default. Binary ~37KB.

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
└── src/
    ├── lib.rs              # Entrypoint + instruction routing (7 discriminators)
    ├── state.rs            # VaultState (464 bytes, bytemuck Pod)
    ├── error.rs            # 9 custom errors (0x100-0x108)
    ├── rent.rs             # Const fn rent exemption calculation
    └── instructions/
        ├── mod.rs          # Re-exports all instruction structs
        ├── initialize.rs   # Create vault PDA + share mint PDA
        ├── deposit.rs      # Transfer base tokens in, mint shares
        ├── withdraw.rs     # Burn shares, transfer base tokens out
        ├── set_share_price.rs  # Admin-only price update
        ├── execute.rs      # Generic CPI passthrough (key feature)
        ├── add_owner.rs    # Admin-only: add operator
        └── remove_owner.rs # Admin-only: remove operator
```

## Instructions

| Disc | Instruction | Access | Description |
|------|------------|--------|-------------|
| 0x00 | Initialize | Admin (signer) | Creates vault PDA, share mint PDA, writes initial state |
| 0x01 | Deposit | Anyone | Transfers base tokens to vault, mints shares to depositor |
| 0x02 | Withdraw | Anyone | Burns shares from withdrawer, transfers base tokens out |
| 0x03 | SetSharePrice | Admin only | Updates `share_price` in vault state |
| 0x04 | Execute | Admin or Owner | Generic CPI — vault PDA signs any instruction to any program |
| 0x05 | AddOwner | Admin only | Adds an operator pubkey (max 10) |
| 0x06 | RemoveOwner | Admin only | Removes an operator pubkey (swap-remove) |

## PDA Seeds

| PDA | Seeds | Authority |
|-----|-------|-----------|
| vault_state | `["vault", admin_pubkey, base_mint]` | Program owns the account |
| share_mint | `["share_mint", vault_state_pubkey]` | vault_state PDA is mint authority |

## Share Token Math

- **Deposit**: `shares_to_mint = amount * 10^share_decimals / share_price`
- **Withdraw**: `base_to_return = shares_to_burn * share_price / 10^share_decimals`

All arithmetic uses checked math to prevent overflow.

## VaultState Layout (464 bytes)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| 0 | 1 | discriminator | Account type guard (always 1) |
| 1 | 1 | bump | Vault PDA bump seed |
| 2 | 1 | share_decimals | Share token decimal places |
| 3 | 1 | num_owners | Active owner count (0..10) |
| 4 | 4 | _padding | Alignment padding |
| 8 | 32 | admin | Admin pubkey |
| 40 | 32 | share_mint | Share SPL token mint |
| 72 | 32 | base_mint | Deposit token mint |
| 104 | 8 | share_price | Price per share (base token smallest units) |
| 112 | 320 | owners | Up to 10 operator pubkeys (32 bytes each) |

## Access Control

| Role | Initialize | Deposit | Withdraw | SetSharePrice | Execute | AddOwner | RemoveOwner |
|------|-----------|---------|----------|---------------|---------|----------|-------------|
| Admin | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Owner | No | Yes | Yes | No | Yes | No | No |
| Anyone | No | Yes | Yes | No | No | No | No |

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 0x100 | Unauthorized | Signer is not admin (or not admin/owner for Execute) |
| 0x101 | InvalidSharePrice | Share price must be > 0 |
| 0x102 | InvalidAmount | Deposit/withdraw amount must be > 0 |
| 0x103 | OwnersFull | Owner list at capacity (10) |
| 0x104 | OwnerNotFound | Owner not in list (remove) |
| 0x105 | InvalidDiscriminator | Wrong account discriminator |
| 0x106 | MathOverflow | Arithmetic overflow in share calculation |
| 0x107 | InsufficientFunds | Vault lacks base tokens for withdrawal |
| 0x108 | DuplicateOwner | Owner already exists (add) |

## Build & Test

```bash
# From monorepo root:
pnpm program:build    # cargo build-sbf with bpf-entrypoint feature
pnpm program:test     # cargo test (unit tests, no BPF)
```

## Execute Instruction (CPI Passthrough)

The `Execute` instruction is the key feature. It allows the vault to interact with any Solana program as a signer:

- Uses `MaybeUninit` stack arrays (no heap) for dynamic `AccountMeta` construction
- Accounts matching the vault PDA address are automatically marked as signers in the CPI
- Capped at 32 forwarded accounts per CPI call
- Uses `cpi::slice_invoke_signed` for dynamic account counts
- Target instruction data is passed verbatim after the discriminator byte
