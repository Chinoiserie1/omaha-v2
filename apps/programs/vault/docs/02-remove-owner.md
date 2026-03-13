# Instruction 0x02 — RemoveOwner

- **Discriminator**: `0x02`
- **Access**: Admin only
- **Source**: [`../src/instructions/remove_owner.rs`](../src/instructions/remove_owner.rs)

## Purpose

Removes an operator pubkey from the vault's `owners` list using swap-remove semantics. After removal the owner loses access to `Execute` (0x04). The order of remaining owners is not preserved.

## Flow

```
Caller
  │
  ├─ accounts[0]: admin (signer)
  ├─ accounts[1]: vault_state (writable)
  └─ data: [0x02][owner_to_remove: 32 bytes]
            │
            ▼
  try_from validation
  ├─ accounts >= 2, admin is_signer, vault_state is_writable
  ├─ vault_state owned by program, discriminator == VAULT_DISCRIMINATOR
  └─ data.len() >= 32 → copy owner_to_remove
            │
            ▼
  process()
  ├─ try_borrow_mut_data(vault_state)
  ├─ bytemuck cast → &mut VaultState
  ├─ state.is_admin(admin.key())  → Err(Unauthorized) if false
  └─ state.remove_owner(&owner_to_remove)
       ├─ iterate owners[0..num_owners] to find index i
       ├─ not found → return false → Err(OwnerNotFound)
       ├─ owners[i] = owners[num_owners - 1]  (swap with last)
       ├─ owners[num_owners - 1] = [0u8; 32]  (zero vacated slot)
       └─ num_owners -= 1 → Ok(())
```

## Accounts

| # | Role | Constraints |
|---|------|-------------|
| 0 | `admin` | Signer |
| 1 | `vault_state` | Writable, owned by program, valid discriminator |

## Instruction Data Layout

| Bytes | Field | Description |
|-------|-------|-------------|
| 0 | `discriminator` | `0x02` — stripped before `try_from` receives `data` |
| 1–32 | `owner_to_remove` | 32-byte pubkey of the operator to remove |

**Total**: 33 bytes (including discriminator).

## Swap-Remove Semantics

Swap-remove avoids shifting the entire array: find the target at index `i`, overwrite it with the last active entry, then zero the vacated tail slot and decrement `num_owners`.

```
Before (num_owners = 3):
┌───┬───┬───┬──────────┐
│ A │ B │ C │ (unused) │
└───┴───┴───┴──────────┘
  0   1   2

Remove B (index 1):
  Step 1 — swap with last:   owners[1] = owners[2]  →  [A, C, C, ...]
  Step 2 — zero vacated:     owners[2] = [0; 32]    →  [A, C, _, ...]
  Step 3 — decrement:        num_owners = 2

After:
┌───┬───┬──────────┐
│ A │ C │ (unused) │
└───┴───┴──────────┘
  0   1
```

Complexity: O(n) linear scan to find the index + O(1) removal. Order is NOT preserved.

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
| `owner_to_remove` found in list | `OwnerNotFound` (0x104) |

## Possible Errors

| Code | Name | Trigger |
|------|------|---------|
| 0x100 | `Unauthorized` | Signer is not `state.admin` |
| 0x104 | `OwnerNotFound` | `owner_to_remove` is not in the list |
| 0x105 | `InvalidDiscriminator` | `vault_state` account type byte mismatch |

## Cross-References

- [01-add-owner.md](./01-add-owner.md) — symmetric addition instruction
- [04-execute.md](./04-execute.md) — instruction that owners are authorized to call
- [README.md](./README.md) — full instruction index and VaultState layout
