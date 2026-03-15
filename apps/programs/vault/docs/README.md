# Vault Program — Overview

> **OUTDATED (Mar 2026)**: This doc and the per-instruction docs (00–0C) describe the **original 13-instruction architecture**. The program now has **26 instructions** with a factory/vault two-domain model, renamed owners → operators, fee snapshots, pause mechanism, cancel instructions, and Clock sysvar for CollectFees. See [../CLAUDE.md](../CLAUDE.md) for the current authoritative documentation.

A Solana tokenized vault built with Pinocchio under a shared factory. Users deposit a base token
(e.g. USDC), receive fungible share tokens priced by the admin, and redeem them
for base tokens on withdrawal. The vault PDA can sign CPIs to any external program
— Jupiter, SPL Token, DeFi protocols — enabling on-chain strategy execution.

Runtime: `no_std`, zero-copy state via bytemuck, compiled BPF binary.

See [../CLAUDE.md](../CLAUDE.md) for build/test commands and critical API notes.

---

## Architecture Diagram

```
  Admin wallet
      |
      | Initialize (pays rent)
      v
 +--------------------+          PDA seeds
 |   VaultState PDA   |  <---  ["vault", admin, base_mint]
 |  (488 bytes)       |
 |  admin             |          PDA seeds
 |  share_price       |  <---  ["share_mint", vault_state]
 |  num_owners        |               |
 |  owners[0..10]     |               v
 +--------------------+       +---------------+
          |                   |  ShareMint PDA|
          | mint authority     | (SPL Mint,    |
          +-----------------> |  82 bytes)    |
          |                   +---------------+
          |
          |  PDA seeds: ["pending_deposit", vault_state, depositor]
          v
 +--------------------+
 | PendingDeposit PDA |  (80 bytes, created by RequestDeposit,
 |  vault_state       |   closed by FulfillDeposit)
 |  depositor         |
 |  amount            |
 +--------------------+

          |  PDA seeds: ["pending_withdraw", vault_state, withdrawer]
          v
 +--------------------+
 | PendingWithdraw PDA|  (80 bytes, created by RequestWithdraw,
 |  vault_state       |   closed by FulfillWithdraw)
 |  withdrawer        |
 |  shares            |
 +--------------------+
          |
          | vault_base_ata (holds USDC)
          v
 +--------------------+       +---------------------+
 | Vault base ATA     |<----->| User base ATA (USDC)|
 +--------------------+       +---------------------+
          |                   +---------------------+
          |                   | User share ATA      |
          +------------------>| (receives/burns)    |
                              +---------------------+
          |
          | Execute (CPI passthrough)
          v
 +--------------------+
 | Any external prog  |  Jupiter, SPL Token, DeFi, ...
 +--------------------+
```

---

## Vault Lifecycle

```
  [Admin]                    [User]
     |                          |
     | -- Initialize ---------> |  Creates VaultState + ShareMint PDAs
     |    share_decimals,        |  Writes initial share_price
     |    initial_price          |
     |                          |
     | -- SetSharePrice -------> |  Updates share_price in VaultState
     |    new_price              |  (admin only)
     |                          |
     | -- Execute ------------> |  Vault PDA signs CPI to any program
     |    target_program,        |  (admin or owner)
     |    forwarded_data         |
     |                          |
     | -- AddOwner/RemoveOwner-> |  Manage operator list (admin only)
     |                          |
     | -- DepositWithPrice ---> |  Admin sets price + deposits atomically
     |    new_price, amount     |  (2 signers: admin + depositor)
     |                          |
     |                          | -- RequestDeposit --> vault
     |                          |    base tokens in, PendingDeposit PDA created
     |                          |
     | -- FulfillDeposit ------> |  Admin sets price, mints shares for
     |    new_price              |  pending deposit, closes PDA
     |                          |
     | -- WithdrawWithPrice --> |  Admin sets price + withdraws atomically
     |    new_price, shares     |  (2 signers: admin + withdrawer)
     |                          |
     |                          | -- RequestWithdraw --> vault
     |                          |    shares burned, PendingWithdraw PDA created
     |                          |
     | -- FulfillWithdraw -----> |  Admin sets price, transfers base tokens
     |    new_price              |  for pending withdraw, closes PDA
     |                          |
     | -- UpdateFees ----------> |  Admin configures fee BPS values
     |    entry, exit, mgmt,    |  + fee receiver pubkey
     |    perf, receiver        |
     |                          |
     | -- CollectFees ---------> |  Admin mints management + performance
     |    current_timestamp     |  fee shares to fee receiver
```

---

## PDA Derivation

| PDA          | Seeds                                     | Bump storage      | Authority role                         |
|--------------|-------------------------------------------|-------------------|----------------------------------------|
| vault_state  | `"vault"` + admin_pubkey + base_mint      | `VaultState.bump` | Program-owned; signs CPIs as PDA       |
| share_mint   | `"share_mint"` + vault_state_pubkey       | not stored        | vault_state PDA is SPL mint authority  |
| pending_deposit | `"pending_deposit"` + vault_state + depositor | `PendingDeposit.bump` | Program-owned; closed after fulfill |
| pending_withdraw | `"pending_withdraw"` + vault_state + withdrawer | `PendingWithdraw.bump` | Program-owned; closed after fulfill |

The vault_state PDA is the mint authority because it is a program-derived address
that the program can reconstruct and sign for at CPI time using `invoke_signed`.
No private key is required.

---

## VaultState Account Layout (488 bytes)

`#[repr(C)]` with `bytemuck::Pod + bytemuck::Zeroable`. Cast directly from raw
account data — no serialization/deserialization.

| Offset | Size | Field               | Type          | Description                              |
|--------|------|---------------------|---------------|------------------------------------------|
| 0      | 1    | discriminator       | u8            | Account type guard; always 0xA1          |
| 1      | 1    | bump                | u8            | vault_state PDA canonical bump           |
| 2      | 1    | share_decimals      | u8            | Decimal places for share token           |
| 3      | 1    | num_owners          | u8            | Active operator count (0..=10)           |
| 4      | 2    | entry_fee_bps       | u16 (LE)      | Entry fee in basis points (max 1000)     |
| 6      | 2    | exit_fee_bps        | u16 (LE)      | Exit fee in basis points (max 1000)      |
| 8      | 2    | management_fee_bps  | u16 (LE)      | Management fee in basis points (max 1000)|
| 10     | 2    | performance_fee_bps | u16 (LE)      | Performance fee in basis points (max 5000)|
| 12     | 4    | _padding            | [u8; 4]       | Alignment to 8-byte boundary             |
| 16     | 32   | admin               | [u8; 32]      | Admin pubkey                             |
| 48     | 32   | share_mint          | [u8; 32]      | Share SPL token mint pubkey              |
| 80     | 32   | base_mint           | [u8; 32]      | Deposit token mint (e.g. USDC)           |
| 112    | 32   | fee_receiver        | [u8; 32]      | Fee receiver pubkey (all zeros = none)   |
| 144    | 8    | share_price         | u64 (LE)      | Price per share in base token units      |
| 152    | 8    | high_water_mark     | u64 (LE)      | HWM for performance fee calculation      |
| 160    | 8    | last_fee_timestamp  | i64 (LE)      | Unix timestamp of last fee collection    |
| 168    | 320  | owners              | [[u8;32]; 10] | Operator pubkeys; zeroed if unused       |

Total: 1+1+1+1+2+2+2+2+4+32+32+32+32+8+8+8+320 = **488 bytes**

---

## Instruction Summary Table

| Disc  | Name              | Group              | Access             | Accounts | Data (after disc) | Doc                           |
|-------|-------------------|--------------------|--------------------|----------|--------------------|-------------------------------|
| 0x00  | Initialize        | Setup              | Admin signer       | 6        | 1 + 8 bytes        | [00-initialize.md](./00-initialize.md)       |
| 0x01  | AddOwner          | Setup              | Admin only         | 2        | 32 bytes           | [01-add-owner.md](./01-add-owner.md)         |
| 0x02  | RemoveOwner       | Setup              | Admin only         | 2        | 32 bytes           | [02-remove-owner.md](./02-remove-owner.md)   |
| 0x03  | SetSharePrice     | Admin Ops          | Admin only         | 2        | 8 bytes            | [03-set-share-price.md](./03-set-share-price.md) |
| 0x04  | Execute           | Admin Ops          | Admin or Owner     | 3+N      | variable           | [04-execute.md](./04-execute.md)             |
| 0x05  | UpdateFees        | Fee Mgmt           | Admin only         | 2        | 40 bytes           | [05-update-fees.md](./05-update-fees.md)     |
| 0x06  | CollectFees       | Fee Mgmt           | Admin only         | 5        | 8 bytes            | [06-collect-fees.md](./06-collect-fees.md)   |
| 0x07  | DepositWithPrice  | Deposit            | Admin only         | 8        | 8 + 8 bytes        | [07-deposit-with-price.md](./07-deposit-with-price.md) |
| 0x08  | RequestDeposit    | Deposit            | Anyone             | 7        | 8 bytes            | [08-request-deposit.md](./08-request-deposit.md)       |
| 0x09  | FulfillDeposit    | Deposit            | Admin only         | 7        | 8 bytes            | [09-fulfill-deposit.md](./09-fulfill-deposit.md)       |
| 0x0A  | WithdrawWithPrice | Withdraw           | Admin only         | 8        | 8 + 8 bytes        | [0A-withdraw-with-price.md](./0A-withdraw-with-price.md) |
| 0x0B  | RequestWithdraw   | Withdraw           | Anyone             | 7        | 8 bytes            | [0B-request-withdraw.md](./0B-request-withdraw.md)     |
| 0x0C  | FulfillWithdraw   | Withdraw           | Admin only         | 7        | 8 bytes            | [0C-fulfill-withdraw.md](./0C-fulfill-withdraw.md)     |

Data column excludes the leading discriminator byte consumed by `process_instruction`.

---

## Access Control Matrix

| Instruction       | Admin | Owner | Anyone |
|-------------------|-------|-------|--------|
| Initialize        | Yes   | No    | No     |
| SetSharePrice     | Yes   | No    | No     |
| Execute           | Yes   | Yes   | No     |
| AddOwner          | Yes   | No    | No     |
| RemoveOwner       | Yes   | No    | No     |
| DepositWithPrice  | Yes   | No    | No     |
| RequestDeposit    | Yes   | Yes   | Yes    |
| FulfillDeposit    | Yes   | No    | No     |
| WithdrawWithPrice | Yes   | No    | No     |
| RequestWithdraw   | Yes   | Yes   | Yes    |
| FulfillWithdraw   | Yes   | No    | No     |
| UpdateFees        | Yes   | No    | No     |
| CollectFees       | Yes   | No    | No     |

"Owner" means a pubkey present in `VaultState.owners[0..num_owners]`.
`is_authorized` checks admin first, then iterates the active owner slots.

---

## Share Token Math

**Deposit** — how many shares to mint:

```
shares_to_mint = amount * 10^share_decimals / share_price
```

**Withdraw** — how many base tokens to return:

```
base_to_return = shares_to_burn * share_price / 10^share_decimals
```

All arithmetic uses `checked_mul` / `checked_div`. Integer truncation applies
(Solana has no floating-point in on-chain code). Fee math uses `u128` intermediates
to prevent overflow with large supplies.

---

## Fee System

Four fee types, all in basis points (10,000 = 100%):

| Fee Type | Max BPS | Mechanism | Charged By |
|----------|---------|-----------|------------|
| Entry | 1,000 (10%) | Deducted from minted shares; fee shares minted to fee_receiver | DepositWithPrice, FulfillDeposit |
| Exit | 1,000 (10%) | Deducted from base tokens returned; fee stays in vault | WithdrawWithPrice, FulfillWithdraw |
| Management | 1,000 (10%) | Time-based AUM; new shares minted to fee_receiver | CollectFees |
| Performance | 5,000 (50%) | HWM-based; new shares minted to fee_receiver | CollectFees |

**Entry fee** — `apply_fee(gross_shares, entry_bps)` → `(user_shares, fee_shares)`. Fee shares
are minted to the `fee_receiver_ata` (optional 9th/8th account in deposit instructions).

**Exit fee** — `apply_fee(gross_base, exit_bps)` → `(net_base, fee)`. The fee stays in the
vault (not transferred), benefiting remaining shareholders.

**Management fee** — `total_supply * mgmt_bps * elapsed / (BPS * SECONDS_PER_YEAR)`. Minted
as new shares to dilute existing holders proportionally.

**Performance fee** — Only charged when `share_price > high_water_mark`:
`(price - hwm) * total_supply * perf_bps / (price * BPS)`. HWM is updated to current
price after collection.

**Worked example** — `share_decimals = 6`, `share_price = 1_500_000` (1.5 USDC per share), deposit 10 USDC:

```
amount         = 10_000_000   (10 USDC, 6 decimals)
share_decimals = 6
share_price    = 1_500_000

shares_to_mint = 10_000_000 * 10^6 / 1_500_000
               = 10_000_000 * 1_000_000 / 1_500_000
               = 10_000_000_000_000 / 1_500_000
               = 6_666_666  (truncated; 6.666666 shares)
```

---

## Error Reference

| Code  | Name                | Description                                         | Raised by                          |
|-------|---------------------|-----------------------------------------------------|------------------------------------|
| 0x100 | Unauthorized        | Signer is not admin (or not admin/owner for Execute)| SetSharePrice, Execute, AddOwner, RemoveOwner |
| 0x101 | InvalidSharePrice   | share_price must be > 0                             | Initialize, SetSharePrice          |
| 0x102 | InvalidAmount       | Deposit/withdraw amount or resulting shares = 0     | DepositWithPrice, Withdraw, RequestDeposit |
| 0x103 | OwnersFull          | owners array at capacity (10)                       | AddOwner                           |
| 0x104 | OwnerNotFound       | Pubkey not present in owners array                  | RemoveOwner                        |
| 0x105 | InvalidDiscriminator| Account data[0] != expected discriminator (0xA1/0xA2/0xA3) | SetSharePrice, Execute, AddOwner, RemoveOwner, DepositWithPrice, RequestDeposit, FulfillDeposit, WithdrawWithPrice, RequestWithdraw, FulfillWithdraw |
| 0x106 | MathOverflow        | checked_mul / checked_pow returned None             | DepositWithPrice, FulfillDeposit, WithdrawWithPrice, FulfillWithdraw |
| 0x107 | InsufficientFunds   | vault_base_ata balance < base_to_return             | WithdrawWithPrice, FulfillWithdraw (SPL Transfer CPI fails) |
| 0x108 | DuplicateOwner      | Pubkey already present in owners array              | AddOwner                           |
| 0x109 | InvalidPendingDeposit| PendingDeposit account has wrong discriminator     | FulfillDeposit                     |
| 0x10A | InvalidPendingWithdraw| PendingWithdraw account has wrong discriminator   | FulfillWithdraw                    |
| 0x10B | FeeExceedsMaximum   | Fee BPS exceeds allowed maximum                     | UpdateFees                         |
| 0x10C | NoFeesToCollect     | No fee receiver set or no fees to collect            | CollectFees                        |

All codes are `ProgramError::Custom(code)`. Base offset 0x100 avoids collision
with built-in `ProgramError` variants.

---

## Rent Exemption

Formula from `rent.rs` (compile-time `const fn`):

```
minimum_balance(data_len) = (data_len + 128) * 3_480 * 2
```

Constants: `128` bytes account storage overhead, `3_480` lamports per byte per
year, `2` years exemption threshold (unchanged since Solana mainnet launch).

| Account     | data_len | Calculation          | Lamports  |
|-------------|----------|----------------------|-----------|
| VaultState  | 488      | (488+128)*3480*2     | 4,287,360 |
| ShareMint   | 82       | (82+128)*3480*2      | 1,461,600 |
| PendingDeposit | 80    | (80+128)*3480*2      | 1,447,680 |
| PendingWithdraw | 80   | (80+128)*3480*2      | 1,447,680 |

VaultState and ShareMint rent is transferred from the admin during `Initialize`.
PendingDeposit rent is paid by the depositor during `RequestDeposit` and refunded on `FulfillDeposit`.
PendingWithdraw rent is paid by the withdrawer during `RequestWithdraw` and refunded on `FulfillWithdraw`.

---

## Instruction Routing

`process_instruction` in `lib.rs` splits the first byte as a discriminator:

```
instruction_data  ->  split_first()  ->  (discriminator, remaining_data)
                                               |
                            match discriminator {
                              // Setup (0–2)
                              0x00 => Initialize::try_from((data, accounts))?.process()
                              0x01 => AddOwner::try_from(...)?.process()
                              0x02 => RemoveOwner::try_from(...)?.process()
                              // Admin Ops (3–4)
                              0x03 => SetSharePrice::try_from(...)?.process()
                              0x04 => Execute::try_from(...)?.process()
                              // Fee Mgmt (5–6)
                              0x05 => UpdateFees::try_from(...)?.process()
                              0x06 => CollectFees::try_from(...)?.process()
                              // Deposit Flow (7–9)
                              0x07 => DepositWithPrice::try_from(...)?.process()
                              0x08 => RequestDeposit::try_from(...)?.process()
                              0x09 => FulfillDeposit::try_from(...)?.process()
                              // Withdraw Flow (10–12)
                              0x0A => WithdrawWithPrice::try_from(...)?.process()
                              0x0B => RequestWithdraw::try_from(...)?.process()
                              0x0C => FulfillWithdraw::try_from(...)?.process()
                              _    => Err(InvalidInstructionData)
                            }
```

Each instruction struct implements `TryFrom<(&[u8], &[AccountInfo])>`:
validates account count, signer/writable flags, discriminator byte of the vault
account, and deserializes instruction-specific fields. `process()` is called only
after successful validation.

Empty instruction_data (zero bytes) returns `ProgramError::InvalidInstructionData`
from `split_first().ok_or(...)` before the match is reached.

---

## Cross-References

Instruction detail docs:

- [00-initialize.md](./00-initialize.md)
- [03-set-share-price.md](./03-set-share-price.md)
- [04-execute.md](./04-execute.md)
- [01-add-owner.md](./01-add-owner.md)
- [02-remove-owner.md](./02-remove-owner.md)
- [07-deposit-with-price.md](./07-deposit-with-price.md)
- [08-request-deposit.md](./08-request-deposit.md)
- [09-fulfill-deposit.md](./09-fulfill-deposit.md)
- [0A-withdraw-with-price.md](./0A-withdraw-with-price.md)
- [0B-request-withdraw.md](./0B-request-withdraw.md)
- [0C-fulfill-withdraw.md](./0C-fulfill-withdraw.md)
- [05-update-fees.md](./05-update-fees.md)
- [06-collect-fees.md](./06-collect-fees.md)

Source files:

- [../src/lib.rs](../src/lib.rs) — entrypoint and routing
- [../src/state.rs](../src/state.rs) — VaultState definition
- [../src/error.rs](../src/error.rs) — error codes
- [../src/fees.rs](../src/fees.rs) — fee math (entry/exit/management/performance)
- [../src/rent.rs](../src/rent.rs) — rent exemption formula
- [../src/instructions/](../src/instructions/) — one file per instruction
- [../CLAUDE.md](../CLAUDE.md) — build commands, API constraints, test suite
