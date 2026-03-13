# Instruction 0x03 — SetSharePrice

| Property | Value |
|----------|-------|
| Discriminator | `0x03` |
| Access | Admin only |
| Source | [../src/instructions/set_share_price.rs](../src/instructions/set_share_price.rs) |

## Purpose

Allows the vault admin to update `share_price` stored in `VaultState`. All subsequent deposit and withdraw calculations use the new price immediately, reflecting vault performance (gains or losses) since the last update.

## Flow

```
caller (admin signer)
        │
        ▼
[TryFrom] validate accounts & data
        │  ├─ admin is signer
        │  ├─ vault_state is writable, owned by program
        │  ├─ vault_state discriminator == VAULT_DISCRIMINATOR
        │  └─ new_share_price > 0
        ▼
borrow vault_state mutably
        │
        ▼
verify admin key == state.admin
        │
        ▼
write state.share_price = new_share_price
        │
        ▼
Ok(())
```

## Accounts

| # | Role | Flags | Description |
|---|------|-------|-------------|
| 0 | `admin` | signer | Must match `vault_state.admin` |
| 1 | `vault_state` | writable | Vault PDA that holds the state |

## Instruction Data Layout

| Bytes | Field | Type | Notes |
|-------|-------|------|-------|
| 0 | discriminator | u8 | Always `0x03` |
| 1–8 | new_share_price | u64 LE | Must be > 0 |

**Total: 9 bytes.** The `TryFrom` implementation reads `data[..8]` (the payload slice after the router has stripped the leading discriminator byte), so the raw transaction data is 9 bytes in total.

## Impact on Deposit and Withdraw

Share price is expressed in base-token smallest units per share unit (scaled by `10^share_decimals`).

| Operation | Formula | Price increase effect | Price decrease effect |
|-----------|---------|----------------------|----------------------|
| Deposit | `shares = amount * 10^decimals / share_price` | Fewer shares minted per unit deposited | More shares minted per unit deposited |
| Withdraw | `base = shares * share_price / 10^decimals` | More base returned per share burned | Less base returned per share burned |

### Concrete example (`share_decimals = 6`)

| Scenario | share_price | Deposit 1 USDC (1_000_000 lamports) → shares | Burn 1 share → USDC out |
|----------|-------------|----------------------------------------------|------------------------|
| Initial | 1_000_000 | 1.000000 shares | 1.000000 USDC |
| After gain | 1_500_000 | 0.666666 shares | 1.500000 USDC |

Early depositors hold shares that are now worth 1.5× their entry value.

## Validation Rules

| Check | Error |
|-------|-------|
| At least 2 accounts provided | `ProgramError::NotEnoughAccountKeys` |
| `admin` is a signer | `ProgramError::MissingRequiredSignature` |
| `vault_state` is writable | `ProgramError::InvalidAccountData` |
| `vault_state` owned by this program | `ProgramError::IllegalOwner` |
| `vault_state` data has correct discriminator | `VaultError::InvalidDiscriminator` (0x105) |
| Payload is at least 8 bytes | `ProgramError::InvalidInstructionData` |
| `new_share_price != 0` | `VaultError::InvalidSharePrice` (0x101) |
| `admin.key == state.admin` | `VaultError::Unauthorized` (0x100) |

## Possible Errors

| Code | Name | Trigger |
|------|------|---------|
| 0x100 | `Unauthorized` | Signer key does not match `state.admin` |
| 0x101 | `InvalidSharePrice` | `new_share_price` is zero |
| 0x105 | `InvalidDiscriminator` | `vault_state` account has wrong discriminator byte |

## Design Notes

- **No timelocks or rate limits.** The admin can update the price at any frequency; callers should not assume price stability between transactions.
- **Owners cannot call this.** `is_admin()` is a strict equality check; owner-role pubkeys have no access.
- **No economic validation.** The program writes the supplied value verbatim. It does not inspect token balances or enforce that the price reflects actual vault value. Off-chain logic is responsible for computing a correct NAV before calling this instruction.

## Cross-References

- [README.md](./README.md) — full instruction table and VaultState layout
- [01-deposit.md](./01-deposit.md) — how `share_price` drives share minting
- [02-withdraw.md](./02-withdraw.md) — how `share_price` drives base-token returns
- [04-execute.md](./04-execute.md) — CPI passthrough used to rebalance vault assets
