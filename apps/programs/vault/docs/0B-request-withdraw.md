# RequestWithdraw Instruction

| Property | Value |
|----------|-------|
| Discriminator | `0x0B` |
| Access | Anyone |
| Source | [`../src/instructions/request_withdraw.rs`](../src/instructions/request_withdraw.rs) |

## Purpose

Step 1 of the async Request → Fulfill withdraw flow. The withdrawer burns their share tokens and a `PendingWithdraw` PDA is created to record the request. The admin later calls `FulfillWithdraw` to set the share price and transfer base tokens to the withdrawer.

Inspired by Lagoon Finance's `requestRedeem` → `settleRedeem` → `claimAssets` pattern, adapted for Solana. Useful when the share price is computed off-chain (by the backend) and withdrawals need to be queued for batch or delayed fulfillment.

## Flow Diagram

```
Withdrawer
  │
  ├─ 1. Derive PendingWithdraw PDA
  │       seeds: ["pending_withdraw", vault_state, withdrawer]
  │       └─ verify passed account matches expected PDA
  │
  ├─ 2. CreateAccount (System CPI, invoke_signed)
  │       PDA signs with pending_withdraw seeds + bump
  │       size: 80 bytes (PendingWithdraw::LEN)
  │       owner: vault program
  │       payer: withdrawer
  │
  ├─ 3. Write PendingWithdraw state
  │       discriminator = 3
  │       vault_state = vault_state.key()
  │       withdrawer = withdrawer.key()
  │       shares = shares amount
  │
  └─ 4. Burn shares (Token CPI)
          from:      withdrawer_share_ata
          mint:      share_mint
          authority: withdrawer (signer)
```

## Accounts

| # | Name | Writable | Signer | Description |
|---|------|----------|--------|-------------|
| 0 | `withdrawer` | Yes | Yes | Pays rent for PDA + signs share burn |
| 1 | `withdrawer_share_ata` | Yes | No | Source ATA holding share tokens to burn |
| 2 | `share_mint` | Yes | No | Share token mint |
| 3 | `vault_state` | No | No | PDA with vault config (read-only validation) |
| 4 | `pending_withdraw` | Yes | No | PDA to create: `["pending_withdraw", vault_state, withdrawer]` |
| 5 | `system_program` | No | No | System program (for CreateAccount) |
| 6 | `token_program` | No | No | SPL Token program |

## Instruction Data Layout

```
Byte offset  Size  Type    Description
-----------  ----  ------  ---------------------
0            1     u8      Discriminator (0x0B)
1..9         8     u64 LE  Number of shares to burn
```

Total: **9 bytes**

## PendingWithdraw Account Layout (80 bytes)

```
Byte offset  Size  Type      Description
-----------  ----  --------  ----------------------------
0            1     u8        Discriminator (always 3)
1            1     u8        PDA bump seed
2            6     [u8; 6]   Alignment padding
8            32    [u8; 32]  vault_state pubkey
40           32    [u8; 32]  withdrawer pubkey
72           8     u64 LE    Number of shares burned
```

## Validation Rules

Checked in `TryFrom`:

| Check | Error |
|-------|-------|
| 7+ accounts provided | `NotEnoughAccountKeys` |
| `withdrawer` is a signer | `MissingRequiredSignature` |
| `withdrawer` is writable | `InvalidAccountData` |
| `vault_state` owned by this program | `IllegalOwner` |
| `vault_state` discriminator == 1 | `InvalidDiscriminator` (0x105) |
| `data.len() >= 8` | `InvalidInstructionData` |
| `shares > 0` | `InvalidAmount` (0x102) |

Checked in `process()`:

| Check | Error |
|-------|-------|
| `pending_withdraw` key matches derived PDA | `InvalidSeeds` |
| `CreateAccount` CPI succeeds | System program errors (e.g., account already exists) |

## Constraints

- **One pending withdraw per user per vault** — the PDA seeds include both `vault_state` and `withdrawer`, so each user can only have one pending withdrawal at a time for a given vault.
- **Rent is paid by the withdrawer** — the withdrawer pays ~1,447,680 lamports for the PendingWithdraw PDA. This rent is refunded when the admin calls `FulfillWithdraw`.
- **Shares are burned immediately** — share tokens are burned during this instruction, not during fulfillment. The withdrawer cannot use those shares for anything else while waiting.

## Cross-References

- [README.md](./README.md) — Program overview and full instruction table
- [0C-fulfill-withdraw.md](./0C-fulfill-withdraw.md) — Step 2: admin fulfills with price
- [0A-withdraw-with-price.md](./0A-withdraw-with-price.md) — Synchronous alternative (atomic price + withdraw)
- [03-set-share-price.md](./03-set-share-price.md) — Standalone price update
