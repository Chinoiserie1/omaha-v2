# Initialize — Instruction 0x00

| Property | Value |
|----------|-------|
| Discriminator | `0x00` |
| Access | Admin (signer) |
| Source | [../src/instructions/initialize.rs](../src/instructions/initialize.rs) |

---

## Purpose

Creates a new vault by allocating a `VaultState` PDA and a `ShareMint` PDA, then writing
initial configuration. The admin pays rent for both accounts. After this instruction:

- `vault_state` is owned by the vault program and holds all configuration.
- `share_mint` is an SPL Token mint with `vault_state` as its sole mint authority.

---

## Flow Diagram

```
Admin (signer, payer)
  │
  ├─1─ derive vault PDA  ["vault", admin, base_mint]  → verify vault_state address
  │
  ├─2─ derive share_mint PDA  ["share_mint", vault_state]  → verify share_mint address
  │
  ├─3─ CPI system_program::CreateAccount
  │      from: admin  →  to: vault_state
  │      space: VaultState::LEN,  owner: vault_program
  │
  ├─4─ CPI system_program::CreateAccount
  │      from: admin  →  to: share_mint
  │      space: 82 bytes,  owner: token_program
  │
  ├─5─ CPI token_program::InitializeMint2
  │      mint: share_mint
  │      decimals: share_decimals
  │      mint_authority: vault_state (PDA)
  │      freeze_authority: None
  │
  └─6─ write VaultState fields into vault_state account data
```

---

## Accounts

| # | Name | Signer | Writable | Description |
|---|------|:------:|:--------:|-------------|
| 0 | `admin` | yes | yes | Pays for account creation; becomes vault admin |
| 1 | `vault_state` | no | yes | PDA: `["vault", admin, base_mint]` — will hold VaultState |
| 2 | `share_mint` | no | yes | PDA: `["share_mint", vault_state]` — SPL Token mint for shares |
| 3 | `base_mint` | no | no | The deposit token mint (e.g. USDC); read-only for seeding |
| 4 | `system_program` | no | no | Required for CreateAccount CPIs |
| 5 | `token_program` | no | no | Required for InitializeMint2 CPI |

---

## Instruction Data Layout

Total: **10 bytes** (discriminator byte consumed by the router before parsing).

| Offset | Size | Field | Type | Notes |
|--------|------|-------|------|-------|
| 0 | 1 | `discriminator` | `u8` | Always `0x00`; consumed by router |
| 1 | 1 | `share_decimals` | `u8` | Decimal places for the share token |
| 2 | 8 | `share_price` | `u64` (LE) | Initial price per share in base-token smallest units |

The `TryFrom` parser receives the slice **after** the discriminator byte, so it reads
`data[0]` as `share_decimals` and `data[1..9]` as `share_price`.

---

## Validation Rules

Performed inside `TryFrom<(&[u8], &[AccountInfo])>`:

1. **Minimum accounts** — destructure requires exactly 6 accounts; fewer returns `NotEnoughAccountKeys`.
2. **Admin is signer** — `admin.is_signer()` must be `true`; otherwise `MissingRequiredSignature`.
3. **Writable checks** — `admin`, `vault_state`, and `share_mint` must all be writable; otherwise `InvalidAccountData`.
4. **Data length** — post-discriminator slice must be `>= 9` bytes; otherwise `InvalidInstructionData`.
5. **share_price > 0** — zero price returns `VaultError::InvalidSharePrice`.
6. **vault_state PDA** — derived with `find_program_address(["vault", admin, base_mint])` and compared to the provided address; mismatch returns `InvalidSeeds`.
7. **share_mint PDA** — derived with `find_program_address(["share_mint", vault_state])` and compared to the provided address; mismatch returns `InvalidSeeds`.

---

## Possible Errors

| Error Code | Name | Cause |
|------------|------|-------|
| `NotEnoughAccountKeys` | — | Fewer than 6 accounts provided |
| `MissingRequiredSignature` | — | `admin` account is not a signer |
| `InvalidAccountData` | — | `admin`, `vault_state`, or `share_mint` is not writable |
| `InvalidInstructionData` | — | Post-discriminator data shorter than 9 bytes |
| `0x101` | `InvalidSharePrice` | `share_price` parsed as `0` |
| `InvalidSeeds` | — | Provided `vault_state` or `share_mint` address does not match derived PDA |

---

## State After Success

`VaultState` written at `vault_state` account (488 bytes, zero-copy via bytemuck):

| Field | Value |
|-------|-------|
| `discriminator` | `VAULT_DISCRIMINATOR` (account type guard) |
| `bump` | Canonical bump for `["vault", admin, base_mint]` |
| `share_decimals` | Value from instruction data |
| `num_owners` | `0` |
| `entry_fee_bps` | `0` (no entry fee) |
| `exit_fee_bps` | `0` (no exit fee) |
| `management_fee_bps` | `0` (no management fee) |
| `performance_fee_bps` | `0` (no performance fee) |
| `admin` | `admin` pubkey |
| `share_mint` | `share_mint` pubkey |
| `base_mint` | `base_mint` pubkey |
| `fee_receiver` | All zeroes (no fee receiver) |
| `share_price` | Value from instruction data |
| `high_water_mark` | Same as `share_price` |
| `last_fee_timestamp` | `0` (initialized on first `CollectFees` call) |
| `owners` | All zeroes (no operators yet) |

Share mint initialized with:
- `decimals` = `share_decimals`
- `mint_authority` = `vault_state` PDA
- `freeze_authority` = `None`

---

## Cross-References

- [README.md](./README.md) — instruction index and PDA seeds overview
- [01-deposit.md](./01-deposit.md) — next instruction: deposit base tokens and mint shares
