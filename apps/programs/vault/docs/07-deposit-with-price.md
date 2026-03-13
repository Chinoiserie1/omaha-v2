# DepositWithPrice Instruction

| Property | Value |
|----------|-------|
| Discriminator | `0x07` |
| Access | Admin only (+ depositor signer) |
| Source | [`../src/instructions/deposit_with_price.rs`](../src/instructions/deposit_with_price.rs) |

## Purpose

Atomically sets the share price and deposits base tokens in a single instruction. The admin sets the new share price, and shares are minted to the depositor at that exact price. This guarantees price isolation — no other deposit can use the new price before this one completes.

If entry fees are configured (via `UpdateFees`), fee shares are deducted from the gross mint and sent to the fee receiver's token account. The depositor receives `gross_shares - fee_shares`.

Inspired by GLAM Protocol's instant subscription model where price feeds are included in the same transaction, and Lagoon Finance's curator-settles pattern.

## Flow Diagram

```
Admin + Depositor
  │
  ├─ 1. Borrow VaultState mutably
  │       └─ verify admin is vault admin
  │       └─ verify share_mint key matches account[5]
  │
  ├─ 2. Update share_price to new_share_price
  │
  ├─ 3. Calculate shares_to_mint
  │       └─ deposit_amount * 10^share_decimals / new_share_price
  │       └─ error if result == 0 (0x102)
  │
  ├─ 4. Drop data borrow (required before CPI)
  │
  ├─ 5. Transfer base tokens (Token CPI)
  │       depositor_base_ata → vault_base_ata
  │       authority: depositor (signer)
  │
  ├─ 6. Apply entry fee (if configured)
  │       └─ (user_shares, fee_shares) = apply_fee(gross_shares, entry_fee_bps)
  │
  ├─ 7. MintTo user shares (Token CPI, invoke_signed)
  │       mint: share_mint
  │       destination: depositor_share_ata
  │       authority: vault_state PDA (signs with bump)
  │
  └─ 8. MintTo fee shares (if fee_shares > 0)
          mint: share_mint
          destination: fee_receiver_ata (optional account #8)
          authority: vault_state PDA (signs with bump)
```

## Accounts

| # | Name | Writable | Signer | Description |
|---|------|----------|--------|-------------|
| 0 | `admin` | No | Yes | Must be the vault admin |
| 1 | `depositor` | No | Yes | Authorizes base token transfer (can be same as admin) |
| 2 | `depositor_base_ata` | Yes | No | Source ATA holding base tokens |
| 3 | `vault_base_ata` | Yes | No | Vault's base token custody account |
| 4 | `vault_state` | Yes | No | PDA with vault config — writable for price update |
| 5 | `share_mint` | Yes | No | Share token mint (vault_state is authority) |
| 6 | `depositor_share_ata` | Yes | No | Destination ATA to receive minted shares |
| 7 | `token_program` | No | No | SPL Token program |
| 8 | `fee_receiver_ata` | Yes | No | (Optional) Destination for entry fee shares |

## Instruction Data Layout

```
Byte offset  Size  Type    Description
-----------  ----  ------  ---------------------
0            1     u8      Discriminator (0x07)
1..9         8     u64 LE  New share price (must be > 0)
9..17        8     u64 LE  Deposit amount in base token units
```

Total: **17 bytes**

## Validation Rules

Checked in `TryFrom`:

| Check | Error |
|-------|-------|
| 8+ accounts provided | `NotEnoughAccountKeys` |
| `admin` is a signer | `MissingRequiredSignature` |
| `depositor` is a signer | `MissingRequiredSignature` |
| `vault_state` is writable | `InvalidAccountData` |
| `vault_state` owned by this program | `IllegalOwner` |
| `vault_state` discriminator == 0xA1 | `InvalidDiscriminator` (0x105) |
| `data.len() >= 16` | `InvalidInstructionData` |
| `new_share_price > 0` | `InvalidSharePrice` (0x101) |
| `deposit_amount > 0` | `InvalidAmount` (0x102) |

Checked in `process()`:

| Check | Error |
|-------|-------|
| `state.is_admin(admin.key())` | `Unauthorized` (0x100) |
| `state.share_mint == share_mint.key()` | `InvalidAccountData` |
| `shares_to_mint > 0` after calculation | `InvalidAmount` (0x102) |
| No arithmetic overflow | `MathOverflow` (0x106) |

## Design Notes

- The price update is **global** — `vault_state.share_price` is permanently changed. Any subsequent `Deposit` or `Withdraw` instruction uses the new price.
- Both admin and depositor must sign. The backend constructs the transaction and collects both signatures.
- When admin == depositor, the same account appears twice in the account list with both `is_signer` flags set.

## Cross-References

- [README.md](./README.md) — Program overview and full instruction table
- [01-deposit.md](./01-deposit.md) — Standard deposit (without price update)
- [03-set-share-price.md](./03-set-share-price.md) — Standalone price update
- [08-request-deposit.md](./08-request-deposit.md) — Async deposit alternative (step 1)
- [09-fulfill-deposit.md](./09-fulfill-deposit.md) — Async deposit alternative (step 2)
- [05-update-fees.md](./05-update-fees.md) — Configure entry fee BPS and fee receiver
