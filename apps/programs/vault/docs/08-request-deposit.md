# RequestDeposit Instruction

| Property | Value |
|----------|-------|
| Discriminator | `0x08` |
| Access | Anyone |
| Source | [`../src/instructions/request_deposit.rs`](../src/instructions/request_deposit.rs) |

## Purpose

Step 1 of the async Request → Fulfill deposit flow. The depositor transfers base tokens into the vault and a `PendingDeposit` PDA is created to record the request. The admin later calls `FulfillDeposit` to set the share price and mint shares.

Inspired by Lagoon Finance's `requestDeposit` → `settleDeposit` → `claimShares` pattern, adapted for Solana. Useful when the share price is computed off-chain (by the backend) and deposits need to be queued for batch or delayed fulfillment.

## Flow Diagram

```
Depositor
  │
  ├─ 1. Derive PendingDeposit PDA
  │       seeds: ["pending_deposit", vault_state, depositor]
  │       └─ verify passed account matches expected PDA
  │
  ├─ 2. CreateAccount (System CPI, invoke_signed)
  │       PDA signs with pending_deposit seeds + bump
  │       size: 80 bytes (PendingDeposit::LEN)
  │       owner: vault program
  │       payer: depositor
  │
  ├─ 3. Write PendingDeposit state
  │       discriminator = 2
  │       vault_state = vault_state.key()
  │       depositor = depositor.key()
  │       amount = deposit amount
  │
  └─ 4. Transfer base tokens (Token CPI)
          depositor_base_ata → vault_base_ata
          authority: depositor (signer)
```

## Accounts

| # | Name | Writable | Signer | Description |
|---|------|----------|--------|-------------|
| 0 | `depositor` | Yes | Yes | Pays rent for PDA + signs token transfer |
| 1 | `depositor_base_ata` | Yes | No | Source ATA holding base tokens |
| 2 | `vault_base_ata` | Yes | No | Vault's base token custody account |
| 3 | `vault_state` | No | No | PDA with vault config (read-only validation) |
| 4 | `pending_deposit` | Yes | No | PDA to create: `["pending_deposit", vault_state, depositor]` |
| 5 | `system_program` | No | No | System program (for CreateAccount) |
| 6 | `token_program` | No | No | SPL Token program |

## Instruction Data Layout

```
Byte offset  Size  Type    Description
-----------  ----  ------  ---------------------
0            1     u8      Discriminator (0x08)
1..9         8     u64 LE  Amount of base tokens to deposit
```

Total: **9 bytes**

## PendingDeposit Account Layout (80 bytes)

```
Byte offset  Size  Type      Description
-----------  ----  --------  ----------------------------
0            1     u8        Discriminator (always 2)
1            1     u8        PDA bump seed
2            6     [u8; 6]   Alignment padding
8            32    [u8; 32]  vault_state pubkey
40           32    [u8; 32]  depositor pubkey
72           8     u64 LE    Base token amount deposited
```

## Validation Rules

Checked in `TryFrom`:

| Check | Error |
|-------|-------|
| 7+ accounts provided | `NotEnoughAccountKeys` |
| `depositor` is a signer | `MissingRequiredSignature` |
| `depositor` is writable | `InvalidAccountData` |
| `vault_state` owned by this program | `IllegalOwner` |
| `vault_state` discriminator == 1 | `InvalidDiscriminator` (0x105) |
| `data.len() >= 8` | `InvalidInstructionData` |
| `amount > 0` | `InvalidAmount` (0x102) |

Checked in `process()`:

| Check | Error |
|-------|-------|
| `pending_deposit` key matches derived PDA | `InvalidSeeds` |
| `CreateAccount` CPI succeeds | System program errors (e.g., account already exists) |

## Constraints

- **One pending deposit per user per vault** — the PDA seeds include both `vault_state` and `depositor`, so each user can only have one pending deposit at a time for a given vault.
- **Rent is paid by the depositor** — the depositor pays ~1,447,680 lamports for the PendingDeposit PDA. This rent is refunded when the admin calls `FulfillDeposit`.
- **Tokens move immediately** — base tokens are transferred to the vault during this instruction, not during fulfillment.

## Cross-References

- [README.md](./README.md) — Program overview and full instruction table
- [09-fulfill-deposit.md](./09-fulfill-deposit.md) — Step 2: admin fulfills with price
- [07-deposit-with-price.md](./07-deposit-with-price.md) — Synchronous alternative (atomic price + deposit)
- [01-deposit.md](./01-deposit.md) — Standard deposit (uses current price)
