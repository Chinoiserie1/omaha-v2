# UpdateFees Instruction

| Property | Value |
|----------|-------|
| Discriminator | `0x05` |
| Access | Admin only |
| Source | [`../src/instructions/update_fees.rs`](../src/instructions/update_fees.rs) |

## Purpose

Configures the vault's fee parameters: entry, exit, management, and performance fees (all in basis points), plus the fee receiver address. All fees are optional — set to 0 to disable any fee type.

Inspired by Lagoon Finance's fee structure (entry/exit/management/performance) and GLAM Protocol's fee configuration model.

## Flow Diagram

```
Admin
  │
  ├─ 1. Borrow VaultState mutably
  │       └─ verify admin is vault admin
  │
  ├─ 2. Write fee parameters
  │       └─ entry_fee_bps, exit_fee_bps
  │       └─ management_fee_bps, performance_fee_bps
  │       └─ fee_receiver pubkey
  │
  └─ 3. Initialize high_water_mark if not yet set
          └─ set to current share_price
```

## Accounts

| # | Name | Writable | Signer | Description |
|---|------|----------|--------|-------------|
| 0 | `admin` | No | Yes | Must be the vault admin |
| 1 | `vault_state` | Yes | No | PDA — writable for fee config update |

## Instruction Data Layout

```
Byte offset  Size  Type    Description
-----------  ----  ------  ---------------------
0            1     u8      Discriminator (0x05)
1..3         2     u16 LE  Entry fee (BPS, max 1000 = 10%)
3..5         2     u16 LE  Exit fee (BPS, max 1000 = 10%)
5..7         2     u16 LE  Management fee (BPS, max 1000 = 10%)
7..9         2     u16 LE  Performance fee (BPS, max 5000 = 50%)
9..41        32    [u8;32] Fee receiver pubkey
```

Total: **41 bytes**

## Fee Limits

| Fee Type | Max BPS | Max % |
|----------|---------|-------|
| Entry | 1,000 | 10% |
| Exit | 1,000 | 10% |
| Management | 1,000 | 10% |
| Performance | 5,000 | 50% |

## Validation Rules

Checked in `TryFrom`:

| Check | Error |
|-------|-------|
| 2+ accounts provided | `NotEnoughAccountKeys` |
| `admin` is a signer | `MissingRequiredSignature` |
| `vault_state` is writable | `InvalidAccountData` |
| `vault_state` owned by this program | `IllegalOwner` |
| `vault_state` discriminator == 0xA1 | `InvalidDiscriminator` (0x105) |
| `data.len() >= 40` | `InvalidInstructionData` |
| All fees within max limits | `FeeExceedsMaximum` (0x10B) |

Checked in `process()`:

| Check | Error |
|-------|-------|
| `state.is_admin(admin.key())` | `Unauthorized` (0x100) |

## Design Notes

- **HWM initialization** — if `high_water_mark == 0` (never set), it is initialized to the current `share_price`. This ensures performance fees are only charged on gains above the price at fee configuration time.
- **Fee receiver** — set to all zeros to effectively disable fee collection in deposit/withdraw instructions. The `CollectFees` instruction checks `has_fee_receiver()` and returns `NoFeesToCollect` if it's all zeros.
- **Idempotent** — can be called multiple times to update fee parameters. Each call overwrites all fee values.

## Cross-References

- [README.md](./README.md) — Program overview and full instruction table
- [06-collect-fees.md](./06-collect-fees.md) — Collect management and performance fees
- [07-deposit-with-price.md](./07-deposit-with-price.md) — Entry fee applied during deposit
- [09-fulfill-deposit.md](./09-fulfill-deposit.md) — Entry fee applied during async deposit
- [0A-withdraw-with-price.md](./0A-withdraw-with-price.md) — Exit fee applied during withdraw
- [0C-fulfill-withdraw.md](./0C-fulfill-withdraw.md) — Exit fee applied during async withdraw
