# User / Quant / Vault Architecture

> How users, quant profiles, and vaults relate to each other.

## Overview

The platform has three core identity layers:

1. **User** — The identity anchor (real or placeholder)
2. **Quant** — A strategy profile linked to a User
3. **Vault** — A tokenized on-chain vault (Omaha Vault program) owned by a Quant

## Entity Relationship

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                 │
│                                                              │
│  id, privyId?, email?, username?, walletAddress?             │
│  twitterId?, twitterUsername?, twitterFollowerCount?          │
│  profileImageUrl?, bio?, hasTwitter                          │
│  userType: REAL | PLACEHOLDER                                │
│                                                              │
│  A user can be:                                              │
│    - A regular investor (no Quant profile)                   │
│    - A Quant (has Quant profile, may or may not have vault)  │
│    - A placeholder (created for a Quant not yet signed up)   │
└─────────────┬───────────────────────────────────────────────┘
              │ 1:0..1
              ▼
┌─────────────────────────────────────────────────────────────┐
│                        QUANT                                 │
│                                                              │
│  id, userId (unique)                                         │
│  isActive, algoEnabled, lastFetchedAt                        │
│                                                              │
│  Owns:                                                       │
│    - Tweet[]              (Twitter posts for analysis)       │
│    - PortfolioSnapshot[]  (strategy allocations over time)   │
│    - TweetImpact[]        (tweet significance scores)        │
│    - Vault?               (optional on-chain vault)          │
└─────────────┬───────────────────────────────────────────────┘
              │ 1:0..1
              ▼
┌─────────────────────────────────────────────────────────────┐
│                        VAULT                                 │
│                                                              │
│  id, quantId (unique)                                        │
│  vaultPda?, statePda, mintAddress?                            │
│  vaultName, vaultSymbol                                      │
│  dryRun, isActive, jupiterEnabled                            │
│                                                              │
│  Owns:                                                       │
│    - RebalanceEvent[]      (on-chain swap history)           │
│    - HoldingsSnapshot[]    (token holdings over time)        │
│    - WithdrawalRequest[]   (user redemption queue)           │
│    - VaultFavorite[]       (user bookmarks)                  │
└─────────────────────────────────────────────────────────────┘
```

## User Types

```
enum UserType {
  REAL         -- Authenticated via Privy, has privyId
  PLACEHOLDER  -- Created for a Quant who hasn't signed up yet
}
```

| Field | REAL User | PLACEHOLDER User |
|-------|-----------|------------------|
| `privyId` | Set (from Privy auth) | `null` |
| `email` | Optional | `null` |
| `walletAddress` | Set (Privy embedded wallet) | `null` |
| `twitterId` | Optional (if linked) | Set (from Quant's Twitter) |
| `twitterUsername` | Optional (if linked) | Set (from Quant's Twitter) |
| `twitterFollowerCount` | Optional | Set (from Quant's Twitter) |
| `bio` | Optional | Set (from Quant's Twitter) |
| `hasTwitter` | `true` if linked | `true` |
| `userType` | `REAL` | `PLACEHOLDER` |

## User Journey Flows

### Flow 1: Regular User (Investor)

```
User signs up via Privy (Twitter OAuth)
  → User record created (userType = REAL, privyId set)
  → Browse vaults, invest, withdraw
  → No Quant profile needed
```

### Flow 2: Admin Creates a Quant

```
Admin wants to track a Twitter influencer (e.g. @elonmusk)
  → Create placeholder User:
      twitterUsername = "elonmusk"
      twitterId = "44196397"
      userType = PLACEHOLDER
      privyId = null
  → Create Quant linked to that User:
      isActive = true
      algoEnabled = true
  → Pipeline starts fetching tweets, classifying, generating theses
  → Optionally create a Vault for on-chain rebalancing
```

### Flow 3: Placeholder User Signs Up (Account Linking)

```
@elonmusk decides to sign up on Omaha
  → Signs in with Twitter via Privy
  → Backend checks: does a PLACEHOLDER User with twitterId = "44196397" exist?
  → YES: Update the existing User record:
      privyId = <from Privy>
      email = <from Privy>
      walletAddress = <embedded wallet>
      userType = REAL
  → All existing data (Quant, Vault, tweets, portfolios) is automatically linked
  → User now "owns" their Quant profile and vault
```

### Flow 4: User Becomes a Quant

```
Existing REAL user wants to create their own strategy
  → Create Quant profile linked to their User
  → User starts providing signals (tweets analyzed by pipeline)
  → Optionally create a Vault for their strategy
```

## Account Linking Logic

```
                     ┌─────────────────────┐
                     │  User signs up with  │
                     │  Twitter via Privy   │
                     └──────────┬──────────┘
                                │
                     ┌──────────▼──────────┐
                     │  Check: PLACEHOLDER  │
                     │  User with matching  │
                     │  twitterId exists?   │
                     └──────────┬──────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
           ┌──────────────┐       ┌──────────────┐
           │   YES: Link   │       │   NO: Create  │
           │               │       │               │
           │ Update fields:│       │ New User:     │
           │ - privyId     │       │ - privyId     │
           │ - email       │       │ - email       │
           │ - wallet      │       │ - wallet      │
           │ - userType    │       │ - userType    │
           │   → REAL      │       │   = REAL      │
           │               │       │               │
           │ Quant + Vault │       │ No Quant yet  │
           │ auto-linked   │       │               │
           └──────────────┘       └──────────────┘
```

## Pipeline Data Flow

```
                   User (PLACEHOLDER)
                      │
                      ▼
                    Quant
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
   Fetch Tweets   Classify    Generate Thesis
   (Twitter API)  (LLM)       (LLM)
         │            │            │
         ▼            ▼            ▼
      Tweet[]   ClassifiedTweet  PortfolioSnapshot
         │                         │
         ▼                         ▼
    TweetImpact[]          RebalanceEvent[]
    (significance)         (Jupiter swaps via Vault)
```

## Database Schema Reference

See [`packages/database/prisma/schema.prisma`](../../packages/database/prisma/schema.prisma) for the full schema.

Key foreign key relationships:
- `Quant.userId` → `User.id` (unique, cascade delete)
- `Vault.quantId` → `Quant.id` (unique, cascade delete)
- `Tweet.quantId` → `Quant.id`
- `PortfolioSnapshot.quantId` → `Quant.id`
- `TweetImpact.quantId` → `Quant.id`
- `RebalanceEvent.vaultId` → `Vault.id`
- `HoldingsSnapshot.vaultId` → `Vault.id`
- `WithdrawalRequest.vaultId` → `Vault.id`
- `WithdrawalRequest.userId` → `User.id`
- `VaultFavorite.vaultId` → `Vault.id`
- `VaultFavorite.userId` → `User.id`

## Migration History

The Kol → Quant refactor was done in 5 migrations (March 2026):

1. **Add User fields** — `twitterFollowerCount`, `bio`, `hasTwitter`, `userType` enum, make `privyId` optional
2. **Create Quant table** — New model with FK to User
3. **Migrate Kol data** — Create placeholder Users from Kols, create Quants with same IDs
4. **Rename FKs + Vault** — `kolId` → `quantId`, `KolVault` → `Vault`, drop duplicate columns
5. **Drop Kol table** — Clean removal after data migration
