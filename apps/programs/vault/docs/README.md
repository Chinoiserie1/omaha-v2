# Vault Program — Overview

A minimal Solana tokenized vault built with Pinocchio. Users deposit a base token
(e.g. USDC), receive fungible share tokens priced by the admin, and redeem them
for base tokens on withdrawal. The vault PDA can sign CPIs to any external program
— Jupiter, SPL Token, DeFi protocols — enabling on-chain strategy execution.

Runtime: `no_std`, zero-copy state via bytemuck, ~37 KB compiled BPF binary.

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
 |  (432 bytes)       |
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
     |                          | -- Deposit ------> vault
     |                          |    base tokens in
     |                          |    shares minted out
     |                          |
     | -- SetSharePrice -------> |  Updates share_price in VaultState
     |    new_price              |  (admin only)
     |                          |
     | -- Execute ------------> |  Vault PDA signs CPI to any program
     |    target_program,        |  (admin or owner)
     |    forwarded_data         |
     |                          |
     |                          | -- Withdraw -----> vault
     |                          |    shares burned
     |                          |    base tokens out
     |                          |
     | -- AddOwner/RemoveOwner-> |  Manage operator list (admin only)
```

---

## PDA Derivation

| PDA          | Seeds                                     | Bump storage      | Authority role                         |
|--------------|-------------------------------------------|-------------------|----------------------------------------|
| vault_state  | `"vault"` + admin_pubkey + base_mint      | `VaultState.bump` | Program-owned; signs CPIs as PDA       |
| share_mint   | `"share_mint"` + vault_state_pubkey       | not stored        | vault_state PDA is SPL mint authority  |

The vault_state PDA is the mint authority because it is a program-derived address
that the program can reconstruct and sign for at CPI time using `invoke_signed`.
No private key is required.

---

## VaultState Account Layout (432 bytes)

`#[repr(C)]` with `bytemuck::Pod + bytemuck::Zeroable`. Cast directly from raw
account data — no serialization/deserialization.

| Offset | Size | Field           | Type          | Description                          |
|--------|------|-----------------|---------------|--------------------------------------|
| 0      | 1    | discriminator   | u8            | Account type guard; always 1         |
| 1      | 1    | bump            | u8            | vault_state PDA canonical bump       |
| 2      | 1    | share_decimals  | u8            | Decimal places for share token       |
| 3      | 1    | num_owners      | u8            | Active operator count (0..=10)       |
| 4      | 4    | _padding        | [u8; 4]       | Alignment to 8-byte boundary         |
| 8      | 32   | admin           | [u8; 32]      | Admin pubkey                         |
| 40     | 32   | share_mint      | [u8; 32]      | Share SPL token mint pubkey          |
| 72     | 32   | base_mint       | [u8; 32]      | Deposit token mint (e.g. USDC)       |
| 104    | 8    | share_price     | u64 (LE)      | Price per share in base token units  |
| 112    | 320  | owners          | [[u8;32]; 10] | Operator pubkeys; zeroed if unused   |

Total: 1+1+1+1+4+32+32+32+8+320 = **432 bytes**

---

## Instruction Summary Table

| Disc  | Name          | Access        | Accounts | Data (after disc) | Doc                           |
|-------|---------------|---------------|----------|--------------------|-------------------------------|
| 0x00  | Initialize    | Admin signer  | 6        | 1 + 8 bytes        | [00-initialize.md](./00-initialize.md)       |
| 0x01  | Deposit       | Anyone        | 7        | 8 bytes            | [01-deposit.md](./01-deposit.md)             |
| 0x02  | Withdraw      | Anyone        | 7        | 8 bytes            | [02-withdraw.md](./02-withdraw.md)           |
| 0x03  | SetSharePrice | Admin only    | 2        | 8 bytes            | [03-set-share-price.md](./03-set-share-price.md) |
| 0x04  | Execute       | Admin or Owner| 3+N      | variable           | [04-execute.md](./04-execute.md)             |
| 0x05  | AddOwner      | Admin only    | 2        | 32 bytes           | [05-add-owner.md](./05-add-owner.md)         |
| 0x06  | RemoveOwner   | Admin only    | 2        | 32 bytes           | [06-remove-owner.md](./06-remove-owner.md)   |

Data column excludes the leading discriminator byte consumed by `process_instruction`.

---

## Access Control Matrix

| Instruction   | Admin | Owner | Anyone |
|---------------|-------|-------|--------|
| Initialize    | Yes   | No    | No     |
| Deposit       | Yes   | Yes   | Yes    |
| Withdraw      | Yes   | Yes   | Yes    |
| SetSharePrice | Yes   | No    | No     |
| Execute       | Yes   | Yes   | No     |
| AddOwner      | Yes   | No    | No     |
| RemoveOwner   | Yes   | No    | No     |

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
(Solana has no floating-point in on-chain code).

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
| 0x102 | InvalidAmount       | Deposit/withdraw amount or resulting shares = 0     | Deposit, Withdraw                  |
| 0x103 | OwnersFull          | owners array at capacity (10)                       | AddOwner                           |
| 0x104 | OwnerNotFound       | Pubkey not present in owners array                  | RemoveOwner                        |
| 0x105 | InvalidDiscriminator| Account data[0] != VAULT_DISCRIMINATOR (1)          | Deposit, Withdraw, SetSharePrice, Execute, AddOwner, RemoveOwner |
| 0x106 | MathOverflow        | checked_mul / checked_pow returned None             | Deposit, Withdraw                  |
| 0x107 | InsufficientFunds   | vault_base_ata balance < base_to_return             | Withdraw (SPL Transfer CPI fails)  |
| 0x108 | DuplicateOwner      | Pubkey already present in owners array              | AddOwner                           |

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
| VaultState  | 432      | (432+128)*3480*2     | 3,897,600 |
| ShareMint   | 82       | (82+128)*3480*2      | 1,461,600 |

Both amounts are transferred from the admin wallet during `Initialize`.

---

## Instruction Routing

`process_instruction` in `lib.rs` splits the first byte as a discriminator:

```
instruction_data  ->  split_first()  ->  (discriminator, remaining_data)
                                               |
                            match discriminator {
                              0x00 => Initialize::try_from((data, accounts))?.process()
                              0x01 => Deposit::try_from(...)?.process()
                              0x02 => Withdraw::try_from(...)?.process()
                              0x03 => SetSharePrice::try_from(...)?.process()
                              0x04 => Execute::try_from(...)?.process()
                              0x05 => AddOwner::try_from(...)?.process()
                              0x06 => RemoveOwner::try_from(...)?.process()
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

Instruction detail docs (to be written alongside this file):

- [00-initialize.md](./00-initialize.md)
- [01-deposit.md](./01-deposit.md)
- [02-withdraw.md](./02-withdraw.md)
- [03-set-share-price.md](./03-set-share-price.md)
- [04-execute.md](./04-execute.md)
- [05-add-owner.md](./05-add-owner.md)
- [06-remove-owner.md](./06-remove-owner.md)

Source files:

- [../src/lib.rs](../src/lib.rs) — entrypoint and routing
- [../src/state.rs](../src/state.rs) — VaultState definition
- [../src/error.rs](../src/error.rs) — error codes
- [../src/rent.rs](../src/rent.rs) — rent exemption formula
- [../src/instructions/](../src/instructions/) — one file per instruction
- [../CLAUDE.md](../CLAUDE.md) — build commands, API constraints, test suite
