# Instruction 0x02 — Withdraw

| Property | Value |
|----------|-------|
| Discriminator | `0x02` |
| Access | Anyone (any holder of share tokens) |
| Source | [`../src/instructions/withdraw.rs`](../src/instructions/withdraw.rs) |

## Purpose

Burns share tokens held by the withdrawer and returns the equivalent amount of base tokens
from the vault, calculated at the current share price. This is the inverse of
[Deposit (0x01)](./01-deposit.md).

## Flow

```
Caller
  │
  ▼
[1] Read VaultState (try_borrow_data)
    └─ verify share_mint matches account[2]
  │
  ▼
[2] Calculate base_to_return
    └─ shares * share_price / 10^share_decimals
    └─ guard: base_to_return > 0
  │
  ▼
[3] Drop data borrow
    └─ required before any CPI (borrow checker)
  │
  ▼
[4] Burn shares (Token CPI — invoke)
    └─ authority: withdrawer (signer)
    └─ from:      withdrawer_share_ata
    └─ mint:      share_mint
  │
  ▼
[5] Transfer base tokens (Token CPI — invoke_signed)
    └─ from:      vault_base_ata
    └─ to:        withdrawer_base_ata
    └─ authority: vault_state PDA (["vault", admin, base_mint, bump])
```

## Accounts

| # | Name | Writable | Signer | Description |
|---|------|----------|--------|-------------|
| 0 | `withdrawer` | No | Yes | Wallet initiating the withdrawal; must hold shares |
| 1 | `withdrawer_share_ata` | Yes | No | ATA holding the share tokens to burn |
| 2 | `share_mint` | Yes | No | Share token mint; validated against `VaultState.share_mint` |
| 3 | `vault_base_ata` | Yes | No | Vault's base token account; source of the payout |
| 4 | `withdrawer_base_ata` | Yes | No | Withdrawer's base token account; receives the payout |
| 5 | `vault_state` | No | No | Vault PDA (`["vault", admin, base_mint]`); holds config |
| 6 | `token_program` | No | No | SPL Token program |

## Instruction Data Layout

```
Byte(s)   Type      Description
───────────────────────────────────────────────────
[0]       u8        Discriminator — must be 0x02
[1..9]    u64 LE    shares — number of share tokens to burn
───────────────────────────────────────────────────
Total: 9 bytes
```

> Note: in `TryFrom`, the discriminator byte has already been stripped by the router in
> `lib.rs`, so `data` passed to the instruction starts at byte 1. The `data.len() < 8`
> guard covers exactly the 8-byte `shares` field.

## Base Amount Calculation

```
base_to_return = shares * share_price / 10^share_decimals
```

All three operations use `checked_*` arithmetic; any overflow returns `MathOverflow (0x106)`.

**Worked example (round-trip with rounding loss)**

Assume `share_decimals = 6`, `share_price = 1_000_000` (i.e. 1 USDC per share).

Deposit: deposit 1.5 USDC (1_500_000 lamports)

```
shares_minted = 1_500_000 * 10^6 / 1_000_000 = 1_500_000 shares
```

Full withdrawal of those shares:

```
base_to_return = 1_500_000 * 1_000_000 / 10^6 = 1_500_000 base units  ✓
```

Partial withdrawal of 1 share with `share_price = 3` (sub-unit price):

```
base_to_return = 1 * 3 / 10^6 = 0  →  rejected (InvalidAmount 0x102)
```

Integer division truncates; depositors may lose up to 1 base unit per withdrawal when
`shares * share_price` is not divisible by `10^share_decimals`.

## Validation Rules

Checked in `TryFrom` before `process()` is called:

| Check | Error |
|-------|-------|
| Exactly 7 accounts provided (slice pattern match) | `NotEnoughAccountKeys` |
| `withdrawer` is a signer | `MissingRequiredSignature` |
| `vault_state` is owned by this program | `IllegalOwner` |
| `vault_state` data length >= `VaultState::LEN` | `InvalidDiscriminator (0x105)` |
| `vault_state` first byte == `VAULT_DISCRIMINATOR` | `InvalidDiscriminator (0x105)` |
| Instruction data length >= 8 bytes | `InvalidInstructionData` |
| `shares` > 0 | `InvalidAmount (0x102)` |

Checked inside `process()`:

| Check | Error |
|-------|-------|
| `vault_state.share_mint` == `share_mint` account key | `InvalidAccountData` |
| `10^share_decimals` does not overflow u64 | `MathOverflow (0x106)` |
| `shares * share_price` does not overflow u64 | `MathOverflow (0x106)` |
| `base_to_return` > 0 after integer division | `InvalidAmount (0x102)` |

## Possible Errors

| Code | Name | Trigger |
|------|------|---------|
| `0x102` | `InvalidAmount` | `shares == 0` or `base_to_return == 0` after division |
| `0x105` | `InvalidDiscriminator` | `vault_state` has wrong discriminator or is too small |
| `0x106` | `MathOverflow` | Arithmetic overflow in share calculation |
| `0x107` | `InsufficientFunds` | Defined in `error.rs` but **not explicitly checked** here — the program relies on SPL Token's own balance check to reject the `Transfer` CPI when `vault_base_ata` has insufficient funds |
| — | `InvalidAccountData` | `share_mint` key does not match `VaultState.share_mint` |
| — | `IllegalOwner` | `vault_state` not owned by this program |
| — | `MissingRequiredSignature` | `withdrawer` did not sign |

## Security Considerations

- **No ownership restriction** — any wallet holding share tokens can call Withdraw. There is
  no admin or allowlist gate.
- **Price trust** — `base_to_return` is computed from `share_price`, which is set exclusively
  by the admin via `SetSharePrice (0x03)`. Withdrawers receive whatever the admin has configured.
- **Burn-before-transfer** — shares are burned in step 4 before base tokens are sent in step 5.
  If the transfer CPI fails (e.g. insufficient vault balance), the transaction is atomic and
  reverts, restoring the burned shares.
- **PDA signer for vault funds** — the vault's base token ATA is controlled by the vault_state
  PDA, not a wallet. Only this program can authorize outbound transfers from it.

## Cross-References

- [README.md](./README.md) — program overview, all instructions, error table
- [01-deposit.md](./01-deposit.md) — the inverse operation
- [../../docs/flow/WITHDRAW-VAULT.md](../../docs/flow/WITHDRAW-VAULT.md) — app-level multi-step
  withdrawal flow (redeem → fulfill → claim) that wraps this instruction
