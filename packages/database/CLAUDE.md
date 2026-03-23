# packages/database - CLAUDE.md

## Overview

This package contains the **Prisma ORM setup** including schema definition, client generation, and database utilities. It provides type-safe database access for all apps.

## Technology Stack

- **ORM**: Prisma 6.x
- **Database**: PostgreSQL
- **TypeScript**: 5.7.x (strict mode)
- **Output**: ESM only

## Database Environments

| Environment | Provider | Setup |
|-------------|----------|-------|
| **Local** | Docker (PostgreSQL 16) | `pnpm db:up` starts container via docker-compose |
| **Staging** | Railway | Managed PostgreSQL instance |
| **Production** | Railway | Managed PostgreSQL instance |

The `DATABASE_URL` environment variable determines which database is used. Each environment has its own URL configured in the respective deployment platform.

## Directory Structure

```
packages/database/
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── migrations/          # Prisma migrations
│   └── seed.ts             # Database seeding script
├── src/
│   ├── index.ts            # Main export file
│   └── client.ts           # Prisma client singleton
├── generated/
│   └── client/             # Generated Prisma client (gitignored)
├── tsconfig.json           # TypeScript config
├── eslint.config.js        # ESLint config
└── package.json
```

## Core Models

### User

The identity anchor for all users (real and placeholder).

```prisma
enum UserType {
  REAL        # Authenticated via Privy/Twitter
  PLACEHOLDER # Created for Quants who haven't signed up yet
}

model User {
  id                    String    @id @default(cuid())
  privyId               String?   @unique  # Optional for placeholder users
  email                 String?   @unique
  username              String?   @unique
  name                  String?
  walletAddress         String?   @unique
  twitterId             String?   @unique
  twitterUsername        String?
  twitterFollowerCount  Int?
  profileImageUrl       String?
  bio                   String?
  hasTwitter            Boolean   @default(false)
  userType              UserType  @default(REAL)
  onboardingCompleted   Boolean   @default(false)
  quant                 Quant?    # Optional Quant profile
  ...
}
```

### Quant

A strategy profile linked to a User. Owns tweets, portfolios, and optionally a vault.

```prisma
model Quant {
  id             String              @id @default(cuid())
  userId         String              @unique
  user           User                @relation(...)
  isActive       Boolean             @default(true)
  algoEnabled    Boolean             @default(true)
  lastFetchedAt  DateTime?
  tweets         Tweet[]
  portfolios     PortfolioSnapshot[]
  vault          Vault?
  tweetImpacts   TweetImpact[]
  ...
}
```

### Vault (formerly KolVault)

A tokenized vault on Solana (Omaha Vault program) owned by a Quant.

```prisma
model Vault {
  id                 String    @id @default(cuid())
  quantId            String    @unique
  quant              Quant     @relation(...)
  statePda           String    @unique
  baseTokenAta       String?
  vaultName          String
  vaultSymbol        String
  dryRun             Boolean   @default(true)
  isActive           Boolean   @default(true)
  shareToken         Token?    # 1:1 relation to Token (isVault=true)
  ...
}
```

**Note**: The vault's share mint address is accessed via the `shareToken` relation: `vault.shareToken.mint`. The `Token` model is the single source of truth for mint address, symbol, decimals, and logo. When creating a new vault, create a corresponding Token record with `isVault=true` and `vaultId` pointing back to the vault.

### Token

Represents a tradeable asset (crypto, stock, etc.) with on-chain metadata.

```prisma
model Token {
  id        String       @id @default(cuid())
  name      String
  symbol    String       @unique
  decimals  Int
  mint      String       @unique
  logoUri   String?
  isVault   Boolean      @default(false)
  isActive  Boolean      @default(true)
  vaultId   String?      @unique
  vault     Vault?       @relation(fields: [vaultId], references: [id])
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  prices    TokenPrice[]
}
```

**Fields**:
- `isVault`: Boolean flag. When `true`, this Token represents a vault's share token. When `false`, it's a curated asset (crypto/stock/index/commodity).
- `vaultId`: Optional FK to Vault. When set, this Token is the share token for that vault. Must be unique — each vault has at most one share token.
- `vault`: Reverse relation for convenient access to vault metadata from the token.

**Usage**:
- Query vault share token: `await prisma.token.findUnique({ where: { vaultId } })`
- Batch vault creation: Create `Token` with `isVault=true` and `vaultId` after on-chain vault initialization
- Portfolio holdings: Resolve token metadata (decimals, logoUri) via token mint to compute display values

### Model Relationships

```
User (1) ──── (0..1) Quant (1) ──── (0..1) Vault ──── (1) Token (isVault=true)
                       │                      │
                       ├── Tweet[]            ├── RebalanceEvent[]
                       ├── PortfolioSnapshot[]├── HoldingsSnapshot[]
                       └── TweetImpact[]      ├── WithdrawalRequest[]
                                              └── VaultFavorite[]
```

The Token model also holds curated assets (crypto/stock tokens) for portfolio allocations — those have `isVault=false` and `vaultId=null`.

### User Linking Flow

When a Quant hasn't signed up yet, a placeholder User is created:
1. Admin creates a placeholder User (`userType = PLACEHOLDER`, `privyId = null`)
2. Quant profile linked to that placeholder User
3. When the real user signs up with matching Twitter, update the placeholder:
   - Set `privyId`, `email`, `walletAddress`
   - Set `userType = REAL`
   - Quant + Vault + all data automatically linked

## Development

```bash
# Start local database (Docker)
pnpm db:up

# Stop local database
pnpm db:down

# Generate Prisma client (required after schema changes)
pnpm db:generate

# Run migrations in development
pnpm db:migrate

# Push schema changes (dev only, no migration)
pnpm --filter @repo/database db:push

# Open Prisma Studio
pnpm --filter @repo/database db:studio

# Seed the database
pnpm --filter @repo/database db:seed

# Type check
pnpm --filter @repo/database typecheck

# Lint
pnpm --filter @repo/database lint
```

## Usage in Apps

```typescript
import { prisma, type User, type Quant, type Vault, type Prisma } from "@repo/database";

// Query examples
const quant = await prisma.quant.findUnique({
  where: { id },
  include: { user: true, vault: true },
});

const vault = await prisma.vault.findUnique({
  where: { quantId },
  include: { quant: { include: { user: true } } },
});
```

## Client Singleton Pattern

The Prisma client uses a singleton pattern to prevent multiple instances during hot reload:

```typescript
// src/client.ts
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

## Environment Variables

Required `DATABASE_URL` in root `.env` (or deployment platform):

```bash
# Local (Docker - matches docker-compose.yml)
DATABASE_URL="postgresql://user:password@localhost:5432/autopilot"

# Staging/Production (Railway - set in Railway dashboard)
DATABASE_URL="postgresql://postgres:xxx@xxx.railway.app:5432/railway"
```

## Database Operations

### Migrations

```bash
# Create and apply migration
pnpm db:migrate

# Apply migrations in production
npx prisma migrate deploy

# Reset database (DESTROYS ALL DATA)
npx prisma migrate reset
```

### Prisma Studio

```bash
pnpm db:studio
```

Opens a web UI at http://localhost:5555 for database exploration.

## Type Exports

The package exports:
- `prisma` - The Prisma client instance
- All generated types from Prisma client

```typescript
import {
  prisma,
  type User,
  type Quant,
  type Vault,
  type Prisma,
  type PrismaClient
} from "@repo/database";

// Use Prisma namespace for input types
type UserCreateInput = Prisma.UserCreateInput;
type QuantWhereInput = Prisma.QuantWhereInput;
```

## Important Notes

- **Always run `pnpm db:generate`** after schema changes
- The generated client is in `generated/client/` (gitignored)
- Use singleton pattern to prevent connection pool exhaustion
- Database URL must be set before running any Prisma command
- Migrations are stored in `prisma/migrations/`

## Troubleshooting

### Client Not Found

```bash
# Regenerate client
pnpm db:generate
```

### Connection Issues

**Local:**
1. Run `pnpm db:up` to start Docker container
2. Verify container is running: `docker ps`
3. Check `DATABASE_URL` matches docker-compose.yml credentials

**Staging/Production:**
1. Verify Railway database is provisioned
2. Check `DATABASE_URL` is set correctly in Railway dashboard
3. Ensure deployment has access to Railway network

### Migration Conflicts

```bash
# Reset and reapply (DESTROYS DATA)
npx prisma migrate reset
```
