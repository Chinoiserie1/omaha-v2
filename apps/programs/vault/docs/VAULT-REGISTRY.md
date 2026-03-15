# Vault Registry

Tracks all vaults created on-chain via the Omaha Vault program.

---

## Devnet

### Factory

| Property | Value |
|----------|-------|
| Factory PDA | `Cg7avg41WkbFAgaoUx4kbMSp77SGyhd5gcFHucNgTazA` |
| Owner | `EAYQWKZHbMjp8noSD1oQaPW61Ym78kf1bb8ZuEa2ZUqr` |
| Program ID | `5yY17NisfXbyjanUEBxrdKsSCuRiWcjzEt6LXGZqDiVR` |
| Init Tx | `3uejCvk57K7ZU4dk4dmu3Qz3YcQGnSeiJEyRhyreSHMz2VWqhsgZzhjHRVmEt913DvnyyBzpRUixadipsFdMKuHC` |
| Created | 2026-03-15 |

### Vaults

| # | Name | Symbol | Vault State PDA | Share Mint | Base Mint | Admin | Tx Signature | Created |
|---|------|--------|-----------------|------------|-----------|-------|--------------|---------|
| 1 | mert | oMERT | `QXgD79ZhSQAmkSJLPZrKNmZwJ1zAQboPw2vGkpFBEXn` | `F19WMGr117qofJ3BWRRwU1UD5FYkmifjujPcFaJmUTws` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (USDC) | `EAYQ...ZUqr` | `r4HBv98yDQhY2XPat6VyovwKh6Tt5dyb8hYWMu7RCzwwmWJqHxgDZif2AnK17CgJLXzuYtJFJcfGT659WypzPg9` | 2026-03-15 |

---

## Mainnet

### Factory

_Not yet deployed._

### Vaults

_None yet._

---

## How to Add a New Entry

After creating a vault with `pnpm create-vault-onchain`, add a row to the appropriate cluster table above with the output values (Vault State PDA, Share Mint, Tx Signature, etc.).
