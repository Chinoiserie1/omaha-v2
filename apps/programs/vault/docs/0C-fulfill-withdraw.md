# FulfillWithdraw Instruction

| Property | Value |
|----------|-------|
| Discriminator | `0x0C` |
| Access | Admin only |
| Source | [`../src/instructions/fulfill_withdraw.rs`](../src/instructions/fulfill_withdraw.rs) |

## Purpose

Step 2 of the async Request → Fulfill withdraw flow. The admin sets the share price, calculates the base token payout from the pending withdraw shares, transfers base tokens to the withdrawer, and closes the `PendingWithdraw` PDA (refunding rent to the withdrawer).

If exit fees are configured (via `UpdateFees`), the fee amount is deducted from the base tokens returned. The fee stays in the vault, benefiting remaining shareholders.

Inspired by Lagoon Finance's curator-settles pattern where the valuation oracle proposes a price off-chain and the curator accepts it, processing pending withdrawals at that price.

## Flow Diagram

```
Admin
  │
  ├─ 1. Read PendingWithdraw state
  │       └─ get shares, withdrawer pubkey, vault_state pubkey
  │
  ├─ 2. Verify withdrawer account matches PendingWithdraw.withdrawer
  │
  ├─ 3. Verify PendingWithdraw.vault_state matches passed vault_state
  │
  ├─ 4. Borrow VaultState mutably
  │       └─ verify admin is vault admin
  │       └─ update share_price to new_share_price
  │       └─ read share_decimals, bump, admin, base_mint
  │
  ├─ 5. Calculate gross_base
  │       └─ shares * new_share_price / 10^share_decimals
  │       └─ error if result == 0 (0x102)
  │
  ├─ 6. Apply exit fee (if configured)
  │       └─ (base_to_return, fee) = apply_fee(gross_base, exit_fee_bps)
  │       └─ fee stays in vault (not transferred)
  │
  ├─ 7. Transfer base tokens (Token CPI, invoke_signed)
  │       from:      vault_base_ata
  │       to:        withdrawer_base_ata
  │       authority: vault_state PDA (signs with bump)
  │
  └─ 7. Close PendingWithdraw PDA
          └─ transfer rent lamports to withdrawer
          └─ zero account data via close()
```

## Accounts

| # | Name | Writable | Signer | Description |
|---|------|----------|--------|-------------|
| 0 | `admin` | No | Yes | Must be the vault admin |
| 1 | `vault_state` | Yes | No | PDA — writable for price update |
| 2 | `pending_withdraw` | Yes | No | PDA to read and close |
| 3 | `vault_base_ata` | Yes | No | Vault's base token custody account (source of payout) |
| 4 | `withdrawer_base_ata` | Yes | No | Withdrawer's base token account (receives payout) |
| 5 | `withdrawer` | Yes | No | Receives rent refund — NOT a signer |
| 6 | `token_program` | No | No | SPL Token program |

## Instruction Data Layout

```
Byte offset  Size  Type    Description
-----------  ----  ------  ---------------------
0            1     u8      Discriminator (0x0C)
1..9         8     u64 LE  New share price (must be > 0)
```

Total: **9 bytes**

## Validation Rules

Checked in `TryFrom`:

| Check | Error |
|-------|-------|
| 7+ accounts provided | `NotEnoughAccountKeys` |
| `admin` is a signer | `MissingRequiredSignature` |
| `vault_state` is writable | `InvalidAccountData` |
| `vault_state` owned by this program | `IllegalOwner` |
| `vault_state` discriminator == 1 | `InvalidDiscriminator` (0x105) |
| `pending_withdraw` is writable | `InvalidAccountData` |
| `pending_withdraw` owned by this program | `IllegalOwner` |
| `pending_withdraw` discriminator == 3 | `InvalidPendingWithdraw` (0x10A) |
| `withdrawer` is writable | `InvalidAccountData` |
| `data.len() >= 8` | `InvalidInstructionData` |
| `new_share_price > 0` | `InvalidSharePrice` (0x101) |

Checked in `process()`:

| Check | Error |
|-------|-------|
| `withdrawer.key() == PendingWithdraw.withdrawer` | `InvalidAccountData` |
| `vault_state.key() == PendingWithdraw.vault_state` | `InvalidAccountData` |
| `state.is_admin(admin.key())` | `Unauthorized` (0x100) |
| `base_to_return > 0` after calculation | `InvalidAmount` (0x102) |
| No arithmetic overflow | `MathOverflow` (0x106) |

## Account Closing

The `PendingWithdraw` PDA is closed after fulfillment:

1. Rent lamports are transferred from `pending_withdraw` to `withdrawer` via `try_borrow_mut_lamports()`
2. `pending_withdraw.close()` zeroes the account's lamports, data length, and owner fields

The withdrawer receives ~1,447,680 lamports back (the rent they paid during `RequestWithdraw`).

## Design Notes

- **Withdrawer does NOT sign** — the admin fulfills on the withdrawer's behalf. The withdrawer already committed their shares during `RequestWithdraw`.
- **Price update is global** — same as `WithdrawWithPrice`, the `vault_state.share_price` is permanently updated.
- **Shares were already burned** — during `RequestWithdraw`, so `FulfillWithdraw` only transfers base tokens. No burn CPI is needed.
- **Batch-friendly** — the admin can fulfill multiple pending withdrawals in the same transaction by including multiple `FulfillWithdraw` instructions, each with a different `pending_withdraw` PDA.

## Cross-References

- [README.md](./README.md) — Program overview and full instruction table
- [0B-request-withdraw.md](./0B-request-withdraw.md) — Step 1: user requests withdrawal
- [0A-withdraw-with-price.md](./0A-withdraw-with-price.md) — Synchronous alternative (atomic price + withdraw)
- [03-set-share-price.md](./03-set-share-price.md) — Standalone price update
- [0D-update-fees.md](./0D-update-fees.md) — Configure exit fee BPS
