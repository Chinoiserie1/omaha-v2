# FulfillDeposit Instruction

| Property | Value |
|----------|-------|
| Discriminator | `0x09` |
| Access | Admin only |
| Source | [`../src/instructions/fulfill_deposit.rs`](../src/instructions/fulfill_deposit.rs) |

## Purpose

Step 2 of the async Request → Fulfill deposit flow. The admin sets the share price, calculates shares from the pending deposit amount, mints shares to the depositor, and closes the `PendingDeposit` PDA (refunding rent to the depositor).

If entry fees are configured (via `UpdateFees`), fee shares are deducted from the gross mint and sent to the fee receiver's token account. The depositor receives `gross_shares - fee_shares`.

Inspired by Lagoon Finance's curator-settles pattern where the valuation oracle proposes a price off-chain and the curator accepts it, processing pending deposits at that price.

## Flow Diagram

```
Admin
  │
  ├─ 1. Read PendingDeposit state
  │       └─ get amount, depositor pubkey, vault_state pubkey
  │
  ├─ 2. Verify depositor account matches PendingDeposit.depositor
  │
  ├─ 3. Verify PendingDeposit.vault_state matches passed vault_state
  │
  ├─ 4. Borrow VaultState mutably
  │       └─ verify admin is vault admin
  │       └─ verify share_mint key matches
  │       └─ update share_price to new_share_price
  │       └─ read share_decimals, bump, admin, base_mint
  │
  ├─ 5. Calculate shares_to_mint
  │       └─ amount * 10^share_decimals / new_share_price
  │       └─ error if result == 0 (0x102)
  │
  ├─ 6. Apply entry fee (if configured)
  │       └─ (user_shares, fee_shares) = apply_fee(gross_shares, entry_fee_bps)
  │
  ├─ 7. MintTo user shares (Token CPI, invoke_signed)
  │       mint: share_mint
  │       destination: depositor_share_ata
  │       authority: vault_state PDA (signs with bump)
  │
  ├─ 8. MintTo fee shares (if fee_shares > 0)
  │       mint: share_mint
  │       destination: fee_receiver_ata (optional account #7)
  │       authority: vault_state PDA (signs with bump)
  │
  └─ 9. Close PendingDeposit PDA
          └─ transfer rent lamports to depositor
          └─ zero account data via close()
```

## Accounts

| # | Name | Writable | Signer | Description |
|---|------|----------|--------|-------------|
| 0 | `admin` | No | Yes | Must be the vault admin |
| 1 | `vault_state` | Yes | No | PDA — writable for price update |
| 2 | `pending_deposit` | Yes | No | PDA to read and close |
| 3 | `share_mint` | Yes | No | Share token mint (vault_state is authority) |
| 4 | `depositor_share_ata` | Yes | No | Destination ATA to receive minted shares |
| 5 | `depositor` | Yes | No | Receives rent refund — NOT a signer |
| 6 | `token_program` | No | No | SPL Token program |
| 7 | `fee_receiver_ata` | Yes | No | (Optional) Destination for entry fee shares |

## Instruction Data Layout

```
Byte offset  Size  Type    Description
-----------  ----  ------  ---------------------
0            1     u8      Discriminator (0x09)
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
| `pending_deposit` is writable | `InvalidAccountData` |
| `pending_deposit` owned by this program | `IllegalOwner` |
| `pending_deposit` discriminator == 2 | `InvalidPendingDeposit` (0x109) |
| `depositor` is writable | `InvalidAccountData` |
| `data.len() >= 8` | `InvalidInstructionData` |
| `new_share_price > 0` | `InvalidSharePrice` (0x101) |

Checked in `process()`:

| Check | Error |
|-------|-------|
| `depositor.key() == PendingDeposit.depositor` | `InvalidAccountData` |
| `vault_state.key() == PendingDeposit.vault_state` | `InvalidAccountData` |
| `state.is_admin(admin.key())` | `Unauthorized` (0x100) |
| `state.share_mint == share_mint.key()` | `InvalidAccountData` |
| `shares_to_mint > 0` after calculation | `InvalidAmount` (0x102) |
| No arithmetic overflow | `MathOverflow` (0x106) |

## Account Closing

The `PendingDeposit` PDA is closed after fulfillment:

1. Rent lamports are transferred from `pending_deposit` to `depositor` via `try_borrow_mut_lamports()`
2. `pending_deposit.close()` zeroes the account's lamports, data length, and owner fields

The depositor receives ~1,447,680 lamports back (the rent they paid during `RequestDeposit`).

## Design Notes

- **Depositor does NOT sign** — the admin fulfills on the depositor's behalf. The depositor already committed their tokens during `RequestDeposit`.
- **Price update is global** — same as `DepositWithPrice`, the `vault_state.share_price` is permanently updated.
- **Base tokens were already transferred** — during `RequestDeposit`, so `FulfillDeposit` only mints shares. No token transfer CPI is needed.
- **Batch-friendly** — the admin can fulfill multiple pending deposits in the same transaction by including multiple `FulfillDeposit` instructions, each with a different `pending_deposit` PDA.

## Cross-References

- [README.md](./README.md) — Program overview and full instruction table
- [08-request-deposit.md](./08-request-deposit.md) — Step 1: user requests deposit
- [07-deposit-with-price.md](./07-deposit-with-price.md) — Synchronous alternative (atomic price + deposit)
- [03-set-share-price.md](./03-set-share-price.md) — Standalone price update
- [0D-update-fees.md](./0D-update-fees.md) — Configure entry fee BPS and fee receiver
