# CollectFees Instruction

| Property | Value |
|----------|-------|
| Discriminator | `0x06` |
| Access | Admin only |
| Source | [`../src/instructions/collect_fees.rs`](../src/instructions/collect_fees.rs) |

## Purpose

Collects time-based management fees and high-water-mark-based performance fees by minting new share tokens to the fee receiver's token account. This dilutes existing shareholders proportionally to the fee amount — the standard approach for on-chain vault fee collection.

The first call initializes `last_fee_timestamp` without minting any fees.

## Flow Diagram

```
Admin
  │
  ├─ 1. Read total_supply from share_mint account (offset 36)
  │
  ├─ 2. Borrow VaultState mutably
  │       └─ verify admin is vault admin
  │       └─ verify share_mint matches
  │       └─ verify fee_receiver is set (non-zero)
  │
  ├─ 3. First call? (last_fee_timestamp == 0)
  │       └─ YES: set last_fee_timestamp = current_timestamp, return Ok
  │       └─ NO: continue to fee calculation
  │
  ├─ 4. Calculate management fee shares
  │       └─ total_supply * mgmt_bps * elapsed_seconds / (10,000 * 31,557,600)
  │
  ├─ 5. Calculate performance fee shares
  │       └─ if share_price > high_water_mark:
  │           (price - hwm) * total_supply * perf_bps / (price * 10,000)
  │       └─ else: 0
  │
  ├─ 6. Update state
  │       └─ last_fee_timestamp = current_timestamp
  │       └─ if price > hwm: high_water_mark = share_price
  │
  └─ 7. MintTo fee shares (Token CPI, invoke_signed)
          mint: share_mint
          destination: fee_receiver_ata
          authority: vault_state PDA (signs with bump)
          amount: mgmt_shares + perf_shares
```

## Accounts

| # | Name | Writable | Signer | Description |
|---|------|----------|--------|-------------|
| 0 | `admin` | No | Yes | Must be the vault admin |
| 1 | `vault_state` | Yes | No | PDA — writable for timestamp/HWM update |
| 2 | `share_mint` | Yes | No | Read supply + mint fee shares |
| 3 | `fee_receiver_ata` | Yes | No | Destination for minted fee shares |
| 4 | `token_program` | No | No | SPL Token program |

## Instruction Data Layout

```
Byte offset  Size  Type    Description
-----------  ----  ------  ---------------------
0            1     u8      Discriminator (0x06)
1..9         8     i64 LE  Current unix timestamp (must be > 0)
```

Total: **9 bytes**

## Fee Formulas

All intermediate calculations use `u128` to prevent overflow.

### Management Fee

```
mgmt_shares = total_supply * mgmt_bps * elapsed_seconds
              / (BPS_DENOMINATOR * SECONDS_PER_YEAR)

BPS_DENOMINATOR = 10,000
SECONDS_PER_YEAR = 31,557,600
```

### Performance Fee (High Water Mark)

```
if share_price > high_water_mark:
  perf_shares = (share_price - hwm) * total_supply * perf_bps
                / (share_price * BPS_DENOMINATOR)
else:
  perf_shares = 0
```

### Worked Example

- `total_supply` = 1,000,000,000 (1000 shares, 6 decimals)
- `management_fee_bps` = 200 (2% annual)
- `elapsed` = 31,557,600 seconds (1 year)
- `share_price` = 2,000,000, `hwm` = 1,000,000
- `performance_fee_bps` = 2000 (20%)

```
mgmt_shares = 1,000,000,000 * 200 * 31,557,600 / (10,000 * 31,557,600)
            = 20,000,000 (2% of supply)

perf_shares = (2,000,000 - 1,000,000) * 1,000,000,000 * 2000 / (2,000,000 * 10,000)
            = 100,000,000 (10% of supply for 100% gain with 20% perf fee)

total = 120,000,000 shares minted to fee_receiver
```

## Validation Rules

Checked in `TryFrom`:

| Check | Error |
|-------|-------|
| 5+ accounts provided | `NotEnoughAccountKeys` |
| `admin` is a signer | `MissingRequiredSignature` |
| `vault_state` is writable | `InvalidAccountData` |
| `vault_state` owned by this program | `IllegalOwner` |
| `vault_state` discriminator == 0xA1 | `InvalidDiscriminator` (0x105) |
| `data.len() >= 8` | `InvalidInstructionData` |
| `current_timestamp > 0` | `InvalidInstructionData` |

Checked in `process()`:

| Check | Error |
|-------|-------|
| `state.is_admin(admin.key())` | `Unauthorized` (0x100) |
| `state.share_mint == share_mint.key()` | `InvalidAccountData` |
| `state.has_fee_receiver()` | `NoFeesToCollect` (0x10C) |
| `current_timestamp >= last_fee_timestamp` | `InvalidInstructionData` |
| No arithmetic overflow | `MathOverflow` (0x106) |

## Design Notes

- **Timestamp is admin-trusted** — passed as instruction data rather than using a Sysvar clock. The admin is trusted to provide an accurate timestamp.
- **First-call initialization** — when `last_fee_timestamp == 0`, the instruction sets the timestamp and returns without minting. This prevents charging fees retroactively to vault creation time.
- **HWM only updates upward** — the high water mark is only updated when `share_price > high_water_mark` AND `performance_fee_bps > 0`. This ensures performance fees are only charged on new all-time highs.
- **Zero fees → no CPI** — if both management and performance fee shares compute to 0, no `MintTo` CPI is executed.

## Cross-References

- [README.md](./README.md) — Program overview and full instruction table
- [05-update-fees.md](./05-update-fees.md) — Configure fee parameters
- [07-deposit-with-price.md](./07-deposit-with-price.md) — Entry fees on deposit
- [0A-withdraw-with-price.md](./0A-withdraw-with-price.md) — Exit fees on withdraw
