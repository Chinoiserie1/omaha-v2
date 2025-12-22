# packages/database - CLAUDE.md

## Overview

This package contains the **Prisma ORM setup** including schema definition, client generation, and database utilities. It provides type-safe database access for all apps.

## Technology Stack

- **ORM**: Prisma 6.x
- **Database**: PostgreSQL
- **TypeScript**: 5.7.x (strict mode)
- **Output**: ESM only

## Directory Structure

```
packages/database/
├── prisma/
│   ├── schema.prisma       # Database schema
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

## Development

```bash
# Generate Prisma client (required after schema changes)
pnpm db:generate
# Or from root:
pnpm --filter @repo/database db:generate

# Run migrations in development
pnpm --filter @repo/database db:migrate

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
// Import Prisma client and types
import { prisma, type User, type Prisma } from "@repo/database";

// Query examples
const users = await prisma.user.findMany();
const user = await prisma.user.findUnique({ where: { id } });
const newUser = await prisma.user.create({ data: { email, name } });
```

## Schema (prisma/schema.prisma)

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../generated/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("users")
}
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

## Adding New Models

### 1. Update Schema

```prisma
// prisma/schema.prisma
model Product {
  id          String   @id @default(cuid())
  name        String
  description String?
  price       Decimal  @db.Decimal(10, 2)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("products")
}
```

### 2. Generate Client

```bash
pnpm db:generate
```

### 3. Create Migration

```bash
pnpm db:migrate
```

### 4. Use in Apps

```typescript
import { prisma, type Product } from "@repo/database";

const products = await prisma.product.findMany();
```

## Environment Variables

Required in root `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/autopilot"
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

### Schema Push (Development Only)

```bash
# Push schema changes without migration
pnpm db:push
```

Use for rapid prototyping. Use migrations for production changes.

### Seeding

```bash
pnpm --filter @repo/database db:seed
```

The seed script (`prisma/seed.ts`) creates initial data.

## Prisma Studio

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
  type Prisma,
  type PrismaClient
} from "@repo/database";

// Use Prisma namespace for input types
type UserCreateInput = Prisma.UserCreateInput;
type UserWhereInput = Prisma.UserWhereInput;
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

1. Check `DATABASE_URL` is correct
2. Ensure PostgreSQL is running
3. Check network/firewall settings

### Migration Conflicts

```bash
# Reset and reapply (DESTROYS DATA)
npx prisma migrate reset
```
