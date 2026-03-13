# Instruction 0x05 — AddOwner

- **Discriminator**: `0x05`
- **Access**: Admin only
- **Source**: [`../src/instructions/add_owner.rs`](../src/instructions/add_owner.rs)

## Purpose

Adds an operator pubkey to the vault's `owners` list. Owners can call `Execute` (0x04) to trigger on-chain CPI operations but cannot modify vault settings or manage the owner list — those actions remain admin-only.

## Flow

```
Caller
  │
  ├─ accounts[0]: admin (signer)
  ├─ accounts[1]: vault_state (writable)
  └─ data: [0x05][new_owner: 32 bytes]
            │
            ▼
  try_from validation
  ├─ accounts >= 2, admin is_signer, vault_state is_writable
  ├─ vault_state owned by program, discriminator == VAULT_DISCRIMINATOR
  └─ data.len() >= 32 → copy new_owner
            │
            ▼
  process()
  ├─ try_borrow_mut_data(vault_state)
  ├─ bytemuck cast → &mut VaultState
  ├─ state.is_admin(admin.key())  → Err(Unauthorized) if false
  └─ state.add_owner(&new_owner)
       ├─ num_owners >= MAX_OWNERS (10) → Err(OwnersFull)
       ├─ pubkey already in owners[0..num_owners] → Err(DuplicateOwner)
       └─ owners[num_owners] = new_owner; num_owners += 1 → Ok(())
```

## Accounts

| # | Role | Constraints |
|---|------|-------------|
| 0 | `admin` | Signer |
| 1 | `vault_state` | Writable, owned by program, valid discriminator |

## Instruction Data Layout

| Bytes | Field | Description |
|-------|-------|-------------|
| 0 | `discriminator` | `0x05` — stripped before `try_from` receives `data` |
| 1–32 | `new_owner` | 32-byte pubkey of the operator to add |

**Total**: 33 bytes (including discriminator).

## Validation Rules

| Check | Error |
|-------|-------|
| At least 2 accounts provided | `NotEnoughAccountKeys` |
| `admin` is a signer | `MissingRequiredSignature` |
| `vault_state` is writable | `InvalidAccountData` |
| `vault_state` owned by this program | `IllegalOwner` |
| `vault_state` data has valid discriminator | `InvalidDiscriminator` (0x105) |
| `data.len() >= 32` | `InvalidInstructionData` |
| `admin` matches `state.admin` | `Unauthorized` (0x100) |
| `num_owners < MAX_OWNERS` (10) | `OwnersFull` (0x103) |
| `new_owner` not already in list | `DuplicateOwner` (0x108) |

## Owner Storage Implementation

The `owners` field in `VaultState` is a fixed array of 10 x 32 bytes (320 bytes total at offset 112). `num_owners` (1 byte, offset 3) tracks how many slots are active.

```
owners array (320 bytes):
┌──────────┬──────────┬──────────┬──────────┬─────────────────────────┐
│ owners[0]│ owners[1]│ owners[2]│  ...     │ owners[9] (unused=zeros)│
│  32 B    │  32 B    │  32 B    │          │  32 B                   │
└──────────┴──────────┴──────────┴──────────┴─────────────────────────┘
            ▲
            num_owners = 2 → next append at index 2
```

`add_owner` logic:
1. Iterate `0..num_owners` — if any slot equals `new_owner` return `false` (duplicate).
2. If `num_owners >= MAX_OWNERS` return `false` (full).
3. `owners[num_owners] = *new_owner; num_owners += 1` — append and increment.

## Possible Errors

| Code | Name | Trigger |
|------|------|---------|
| 0x100 | `Unauthorized` | Signer is not `state.admin` |
| 0x103 | `OwnersFull` | Owner list already has 10 entries |
| 0x105 | `InvalidDiscriminator` | `vault_state` account type byte mismatch |
| 0x108 | `DuplicateOwner` | `new_owner` is already in the list |

## Cross-References

- [06-remove-owner.md](./06-remove-owner.md) — symmetric removal instruction
- [04-execute.md](./04-execute.md) — instruction that owners are authorized to call
- [README.md](./README.md) — full instruction index and VaultState layout
