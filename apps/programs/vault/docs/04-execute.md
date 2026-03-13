# Execute — CPI Passthrough

| Field | Value |
|-------|-------|
| Discriminator | `0x04` |
| Access | Admin or Owner |
| Source | [`../src/instructions/execute.rs`](../src/instructions/execute.rs) |

---

## Purpose

Execute is the core feature of the vault program. It forwards an arbitrary instruction to any Solana program via CPI, with the vault PDA acting as a signer. This allows the vault to interact with external protocols — Jupiter aggregator for swaps, SPL Token for transfers, DeFi protocols for deposits — without those programs needing any knowledge of this vault. The operator constructs the target instruction off-chain and submits it through the vault; the program validates authorization, promotes the vault PDA to signer status, and executes the CPI verbatim.

---

## Flow Diagram

```
Caller
  │
  ▼
TryFrom (validation)
  ├── accounts.len() >= 3?          → NotEnoughAccountKeys
  ├── operator.is_signer()?         → MissingRequiredSignature
  ├── vault_state owned by program? → IllegalOwner
  ├── vault_state discriminator ok? → InvalidDiscriminator (0x105)
  └── target_program.executable()?  → InvalidAccountData
  │
  ▼
Execute::process()
  │
  ├── borrow vault_state data
  ├── state.is_authorized(operator) → Unauthorized (0x100) if false
  ├── capture vault_bump, admin, base_mint, vault_state key
  └── drop borrow                   (required before CPI)
  │
  ▼
Build AccountMeta array (stack-allocated MaybeUninit[32])
  │
  └── for each remaining_account (up to MAX_CPI_ACCS=32):
        is_vault_signer = account.key == vault_state_key
        is_signer       = is_vault_signer || account.is_signer()
        → AccountMeta::{writable_signer, writable, readonly_signer, readonly}
  │
  ▼
Build account refs array (stack-allocated MaybeUninit[32])
  │
  ▼
Construct Instruction { program_id, accounts: metas, data: target_data }
  │
  ▼
Build signer seeds: ["vault", admin, base_mint, bump]
  │
  ▼
cpi::slice_invoke_signed(&ix, account_refs, &signers)
```

---

## Accounts

| Index | Role | Constraints |
|-------|------|-------------|
| 0 | `operator` (signer) | Must be signer; must pass `is_authorized()` |
| 1 | `vault_state` | Owned by this program; valid discriminator |
| 2 | `target_program` | Must be executable (`InvalidAccountData` if not) |
| 3..N | `remaining_accounts` | Forwarded to target program verbatim; max 32 |

---

## Instruction Data Layout

```
Byte 0:     discriminator = 0x04       (consumed by lib.rs router, not seen here)
Bytes 1..:  target_data               (variable length, passed verbatim to target)
```

The router in `lib.rs` strips the discriminator before calling `TryFrom`. The `Execute` struct receives the remaining bytes as `target_data` and passes them unchanged to the CPI instruction.

---

## CPI Construction Deep-Dive

### Why MaybeUninit Stack Arrays

The program runs in a `no_std` environment with no heap allocator beyond Solana's minimal default. Dynamic collections like `Vec` are not viable for performance-critical paths. Instead, the code declares a fixed-size stack array of `MaybeUninit<AccountMeta>` with capacity `MAX_CPI_ACCS = 32`, writes initialized values into the first `num_remaining` slots, then casts a raw pointer to a properly-typed slice:

```rust
let mut metas_storage: [MaybeUninit<AccountMeta>; MAX_CPI_ACCS] =
    unsafe { MaybeUninit::uninit().assume_init() };
// ... fill slots ...
let metas = unsafe {
    core::slice::from_raw_parts(metas_storage.as_ptr() as *const AccountMeta, num_remaining)
};
```

This is safe because every slot from `0..num_remaining` has been explicitly initialized via `MaybeUninit::new(...)` before the slice is formed. The same pattern is applied to the account references slice.

### MAX_CPI_ACCS = 32

Solana's CPI limit is 64 accounts per transaction, but 32 is a conservative ceiling that keeps the two stack arrays (`AccountMeta` + `&AccountInfo`) within reasonable stack frame bounds for BPF. Remaining accounts beyond 32 are silently truncated via `.min(MAX_CPI_ACCS)`.

### Signer Promotion

The vault PDA cannot be passed as a signer by the original caller because callers cannot sign on behalf of PDAs. Instead, for each account in `remaining_accounts`, the code checks whether its public key matches `vault_state_key`. If it does, `is_vault_signer` is set to `true` and the account is wrapped in a signer `AccountMeta` variant. The actual signing authority is then proven to the runtime via the PDA seeds passed to `invoke_signed`.

```rust
let is_vault_signer = *acc.key() == vault_state_key;
let is_signer = is_vault_signer || acc.is_signer();
```

### cpi::slice_invoke_signed vs invoke_signed

Pinocchio's `cpi::invoke_signed` takes a fixed-length array of `&AccountInfo`. Because the number of forwarded accounts is dynamic and known only at runtime, `cpi::slice_invoke_signed` is used instead — it accepts a `&[&AccountInfo]` slice, enabling variable-length CPI calls without requiring heap allocation.

### Borrow Drop Before CPI

Pinocchio uses runtime borrow checking on account data. The vault state data borrow must be explicitly dropped before calling into CPI; otherwise the runtime will panic if any CPI re-entrant path attempts to access the same account. The relevant fields (`bump`, `admin`, `base_mint`) are copied out of the borrow before it is dropped.

---

## Use Case Examples

### Jupiter Swap

The operator prepares a Jupiter swap instruction off-chain (selecting route, slippage, etc.) and submits it through Execute. The vault PDA is included as a signer in `remaining_accounts` so Jupiter can transfer tokens from the vault's token accounts. The swap executes and the vault receives the output tokens directly.

### SPL Token Transfer

An operator moving tokens between vault-controlled token accounts constructs a standard SPL `transfer` instruction targeting the Token program. The vault PDA is the token account owner and signer. Execute forwards the instruction with the vault signing via PDA seeds.

### DeFi Protocol Deposit

For protocols like Kamino or MarginFi, the operator builds the deposit instruction with the vault PDA as the depositor. Execute promotes the PDA to signer status and invokes the protocol, crediting the resulting position to the vault.

---

## Validation Rules

| Check | Error | Code |
|-------|-------|------|
| `accounts.len() >= 3` | `NotEnoughAccountKeys` | — |
| `operator.is_signer()` | `MissingRequiredSignature` | — |
| `vault_state` owned by this program | `IllegalOwner` | — |
| `vault_state` data length >= `VaultState::LEN` and `data[0] == VAULT_DISCRIMINATOR` | `InvalidDiscriminator` | `0x105` |
| `target_program.executable()` | `InvalidAccountData` | — |
| `state.is_authorized(operator.key())` | `Unauthorized` | `0x100` |

Validation in `TryFrom` is intentionally separated from business logic in `process()`. Account structure errors are caught before any state is read.

---

## Possible Errors

| Error | Source | Description |
|-------|--------|-------------|
| `NotEnoughAccountKeys` | `TryFrom` | Fewer than 3 accounts provided |
| `MissingRequiredSignature` | `TryFrom` | Operator did not sign the transaction |
| `IllegalOwner` | `TryFrom` | `vault_state` not owned by this program |
| `InvalidDiscriminator` (0x105) | `TryFrom` | `vault_state` has wrong account type tag |
| `InvalidAccountData` | `TryFrom` | `target_program` is not executable |
| `Unauthorized` (0x100) | `process()` | Operator is neither admin nor an active owner |
| CPI error (propagated) | `process()` | Target program rejected the instruction |

---

## Security Considerations

**The vault PDA can sign any CPI to any program.** There is no allowlist of permitted target programs and no instruction-level filtering. This is by design — the vault's flexibility depends on being able to reach arbitrary protocols. The entire security model rests on the `is_authorized()` check at the start of `process()`.

- **Compromise of admin or any owner key is critical.** An attacker with an authorized signer can drain all token accounts owned by the vault PDA by routing a malicious SPL token transfer through Execute.
- **No program allowlist.** The `target_program` is only checked to be executable. Any deployed program on the cluster is a valid target.
- **No reentrancy guard.** If a target program calls back into this vault program, there is no guard to prevent it. The borrow drop before CPI is the only protection against runtime panics; it does not prevent logical reentrancy.
- **Remaining accounts are forwarded verbatim.** The vault does not inspect or restrict which accounts are passed to the target program beyond capping at 32.
- **Access control is the security boundary.** Protect admin and owner keys with hardware wallets or multisig. Rotate compromised keys immediately using [AddOwner](./01-add-owner.md) and [RemoveOwner](./02-remove-owner.md).

---

## Cross-References

- [README.md](./README.md) — Program overview, VaultState layout, PDA seeds, error codes
- [01-add-owner.md](./01-add-owner.md) — Add operator pubkeys to the authorized owner list
- [02-remove-owner.md](./02-remove-owner.md) — Remove operator pubkeys from the authorized owner list
- [03-set-share-price.md](./03-set-share-price.md) — Admin-only share price update (for context on admin-only vs admin-or-owner access)
