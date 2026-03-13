# WithdrawWithPrice Instruction

| Property | Value |
|----------|-------|
| Discriminator | `0x0A` |
| Access | Admin only (+ withdrawer signer) |
| Source | [`../src/instructions/withdraw_with_price.rs`](../src/instructions/withdraw_with_price.rs) |

## Purpose

Atomically sets the share price and processes a withdrawal in a single instruction. The admin sets the new share price, shares are burned from the withdrawer, and base tokens are transferred out at that exact price. This guarantees price isolation — no other withdrawal can use the new price before this one completes.

Synchronous counterpart to the async `RequestWithdraw` → `FulfillWithdraw` flow. Inspired by GLAM Protocol's instant redemption model where price feeds are included in the same transaction.

## Flow Diagram

```
Admin + Withdrawer
  │
  ├─ 1. Borrow VaultState mutably
  │       └─ verify admin is vault admin
  │       └─ verify share_mint key matches account[3]
  │
  ├─ 2. Update share_price to new_share_price
  │
  ├─ 3. Calculate base_to_return
  │       └─ shares_to_burn * share_price / 10^share_decimals
  │       └─ error if result == 0 (0x102)
  │
  ├─ 4. Drop data borrow (required before CPI)
  │
  ├─ 5. Burn shares (Token CPI)
  │       from:      withdrawer_share_ata
  │       mint:      share_mint
  │       authority: withdrawer (signer)
  │
  └─ 6. Transfer base tokens (Token CPI, invoke_signed)
          from:      vault_base_ata
          to:        withdrawer_base_ata
          authority: vault_state PDA (signs with bump)
```

## Accounts

| # | Name | Writable | Signer | Description |
|---|------|----------|--------|-------------|
| 0 | `admin` | No | Yes | Must be the vault admin |
| 1 | `withdrawer` | No | Yes | Authorizes share burn (can be same as admin) |
| 2 | `withdrawer_share_ata` | Yes | No | Source ATA holding share tokens to burn |
| 3 | `share_mint` | Yes | No | Share token mint (vault_state is authority) |
| 4 | `vault_base_ata` | Yes | No | Vault's base token custody account (source of payout) |
| 5 | `withdrawer_base_ata` | Yes | No | Withdrawer's base token account (receives payout) |
| 6 | `vault_state` | Yes | No | PDA with vault config — writable for price update |
| 7 | `token_program` | No | No | SPL Token program |

## Instruction Data Layout

```
Byte offset  Size  Type    Description
-----------  ----  ------  ---------------------
0            1     u8      Discriminator (0x0A)
1..9         8     u64 LE  New share price (must be > 0)
9..17        8     u64 LE  Shares to burn (must be > 0)
```

Total: **17 bytes**

## Validation Rules

Checked in `TryFrom`:

| Check | Error |
|-------|-------|
| 8+ accounts provided | `NotEnoughAccountKeys` |
| `admin` is a signer | `MissingRequiredSignature` |
| `withdrawer` is a signer | `MissingRequiredSignature` |
| `vault_state` is writable | `InvalidAccountData` |
| `vault_state` owned by this program | `IllegalOwner` |
| `vault_state` discriminator == 1 | `InvalidDiscriminator` (0x105) |
| `data.len() >= 16` | `InvalidInstructionData` |
| `new_share_price > 0` | `InvalidSharePrice` (0x101) |
| `shares_to_burn > 0` | `InvalidAmount` (0x102) |

Checked in `process()`:

| Check | Error |
|-------|-------|
| `state.is_admin(admin.key())` | `Unauthorized` (0x100) |
| `state.share_mint == share_mint.key()` | `InvalidAccountData` |
| `base_to_return > 0` after calculation | `InvalidAmount` (0x102) |
| No arithmetic overflow | `MathOverflow` (0x106) |

## Design Notes

- The price update is **global** — `vault_state.share_price` is permanently changed. Any subsequent instruction uses the new price.
- Both admin and withdrawer must sign. The backend constructs the transaction and collects both signatures.
- When admin == withdrawer, the same account appears twice in the account list with both `is_signer` flags set.
- Burn happens before the base token transfer. If the transfer fails (e.g. insufficient vault balance), the transaction is atomic and reverts, restoring the burned shares.

## Cross-References

- [README.md](./README.md) — Program overview and full instruction table
- [03-set-share-price.md](./03-set-share-price.md) — Standalone price update
- [0B-request-withdraw.md](./0B-request-withdraw.md) — Async withdraw alternative (step 1)
- [0C-fulfill-withdraw.md](./0C-fulfill-withdraw.md) — Async withdraw alternative (step 2)
