# Deposit Instruction

| Property | Value |
|----------|-------|
| Discriminator | `0x01` |
| Access | Anyone |
| Source | [`../src/instructions/deposit.rs`](../src/instructions/deposit.rs) |

## Purpose

Allows any user to deposit base tokens into the vault and receive share tokens proportional to the current share price. The vault PDA signs the mint CPI as the share mint authority.

## Flow Diagram

```
Caller
  │
  ├─ 1. Read VaultState (try_borrow_data)
  │       └─ verify share_mint key matches account[4]
  │
  ├─ 2. Calculate shares_to_mint
  │       └─ amount * 10^share_decimals / share_price
  │       └─ error if result == 0 (0x102)
  │
  ├─ 3. Drop data borrow (required before CPI)
  │
  ├─ 4. Transfer base tokens (Token CPI)
  │       depositor_base_ata → vault_base_ata
  │       authority: depositor (signer)
  │
  └─ 5. MintTo shares (Token CPI, invoke_signed)
          mint: share_mint
          destination: depositor_share_ata
          authority: vault_state PDA (signs with bump)
```

## Accounts

| # | Name | Writable | Signer | Description |
|---|------|----------|--------|-------------|
| 0 | `depositor` | No | Yes | Wallet initiating the deposit |
| 1 | `depositor_base_ata` | Yes | No | Source ATA holding base tokens |
| 2 | `vault_base_ata` | Yes | No | Vault's base token custody account |
| 3 | `vault_state` | No | No | PDA with vault config (`["vault", admin, base_mint]`) |
| 4 | `share_mint` | Yes | No | Share token mint (vault_state is authority) |
| 5 | `depositor_share_ata` | Yes | No | Destination ATA to receive minted shares |
| 6 | `token_program` | No | No | SPL Token program |

## Instruction Data Layout

```
Byte offset  Size  Type    Description
-----------  ----  ------  ---------------------
0            1     u8      Discriminator (0x01)
1..9         8     u64 LE  Amount of base tokens to deposit
```

Total: **9 bytes**

The discriminator is stripped by the router before passing `data` to `TryFrom`. The `TryFrom` impl receives the remaining 8+ bytes and reads `amount` from `data[0..8]`.

## Share Calculation Walkthrough

```
shares_to_mint = amount * 10^share_decimals / share_price
```

Integer division is used — fractional shares are truncated (floor).

**Worked example:**

| Variable | Value |
|----------|-------|
| `share_decimals` | `6` |
| `share_price` | `1_500_000` (1.5 USDC in 6-decimal units) |
| `amount` | `10_000_000` (10 USDC) |

```
share_multiplier = 10^6 = 1_000_000
shares_to_mint   = 10_000_000 * 1_000_000 / 1_500_000
                 = 10_000_000_000_000 / 1_500_000
                 = 6_666_666   (truncated, not 6_666_666.6...)
```

Depositor receives **6,666,666** share tokens (6.666666 shares at 6 decimals).

## Validation Rules

Checked in `TryFrom` before `process()` is called:

| Check | Error |
|-------|-------|
| Exactly 7+ accounts provided | `NotEnoughAccountKeys` |
| `depositor` is a signer | `MissingRequiredSignature` |
| `vault_state` owned by this program | `IllegalOwner` (`ProgramError`) |
| `vault_state` data discriminator == `VAULT_DISCRIMINATOR` (`0x105` mapped) | `InvalidDiscriminator` (0x105) |
| `data.len() >= 8` | `InvalidInstructionData` |
| `amount > 0` | `InvalidAmount` (0x102) |

Checked in `process()`:

| Check | Error |
|-------|-------|
| `state.share_mint == share_mint.key()` | `InvalidAccountData` (`ProgramError`) |
| `shares_to_mint > 0` after calculation | `InvalidAmount` (0x102) |
| No arithmetic overflow in share calc | `MathOverflow` (0x106) |

## Possible Errors

| Code | Name | Trigger |
|------|------|---------|
| `ProgramError::NotEnoughAccountKeys` | — | Fewer than 7 accounts passed |
| `ProgramError::MissingRequiredSignature` | — | Depositor did not sign |
| `ProgramError::IllegalOwner` | — | `vault_state` not owned by this program |
| `ProgramError::InvalidAccountData` | — | `share_mint` key mismatch |
| `ProgramError::InvalidInstructionData` | — | `data` shorter than 8 bytes |
| `0x102` | `InvalidAmount` | `amount == 0` or `shares_to_mint == 0` |
| `0x105` | `InvalidDiscriminator` | Wrong discriminator byte in `vault_state` |
| `0x106` | `MathOverflow` | Overflow in `checked_pow` or `checked_mul` |

## Important Implementation Detail

The data borrow (`try_borrow_data`) over `vault_state` **must be explicitly dropped** before any CPI calls. Pinocchio enforces single-borrow semantics on account data — holding an active borrow while invoking a CPI that touches the same account is a runtime violation.

```rust
// Correct pattern used in deposit.rs
let vault_bump = state.bump;
let admin_bytes = state.admin;
let base_mint_bytes = state.base_mint;
drop(data); // <-- must happen before Transfer::invoke() and MintTo::invoke_signed()
```

Copy the fields you need out of the borrow before dropping it.

## Cross-References

- [README.md](./README.md) — Program overview and full instruction table
- [02-withdraw.md](./02-withdraw.md) — Inverse operation: burn shares, receive base tokens
- [03-set-share-price.md](./03-set-share-price.md) — Admin instruction that controls the share price used in the calculation above
