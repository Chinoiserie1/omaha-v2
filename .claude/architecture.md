# Architecture Guidelines

## Project Structure

Follow this exact folder structure for all development:

```
root/
├── prisma/                 # Database schema & migrations (ISOLATED)
├── src/
│   ├── server.ts          # Fastify entry point
│   ├── services/          # Business logic (pure functions)
│   ├── store/             # Data access layer (repositories)
│   ├── cron/              # Scheduled tasks
│   ├── routes/            # API endpoints
│   ├── middlewares/       # Fastify middlewares
│   ├── utils/             # Helper functions
│   └── types/             # TypeScript types
├── scripts/               # One-off utility scripts
└── dist/                  # Compiled output (auto-generated)
```

## Core Principles

### 1. No Hacky Solutions

- ❌ NO manual file copying in build scripts
- ❌ NO raw SQL strings in service code
- ❌ NO mixing business logic with data access
- ✅ Use proper tooling (Prisma, TypeScript, etc.)
- ✅ Follow dependency injection patterns
- ✅ Use established conventions

### 2. Separation of Concerns

**Dependency Flow:**

```
routes → services → store/repositories → Prisma Client
```

**Layer Responsibilities:**

- **routes/** - HTTP layer only

  - Request validation
  - Response formatting
  - Error handling
  - NO business logic

- **services/** - Business logic only

  - Calculations
  - Data transformations
  - Orchestration of multiple repositories
  - NO direct database access

- **store/** - Data access only

  - Repository pattern
  - Prisma queries
  - Data mapping
  - NO business logic

- **cron/** - Scheduled tasks
  - Use services, not repositories directly
  - Clear scheduling definitions
  - Proper error handling

### 3. Prisma Database Layer

**Rules:**

- All database schema lives in `prisma/schema.prisma`
- Migrations auto-generated in `prisma/migrations/`
- Single Prisma Client instance at `src/store/prisma.client.ts`
- Never import Prisma Client outside `store/` folder
- Never copy migrations to `dist/`

**Example Repository:**

```typescript
// src/store/pool.repository.ts
import { prisma } from "./prisma.client";

export const poolRepository = {
  async findByToken(tokenMint: string) {
    return prisma.pool.findMany({ where: { tokenMint } });
  },
};
```

### 4. Error Handling

**Never swallow errors silently:**

```typescript
// ❌ BAD
try {
  await something();
} catch (e) {
  // Silent failure
}

// ✅ GOOD
try {
  await something();
} catch (error) {
  logger.error({ error }, "Failed to process");
  throw new AppError("Processing failed", { cause: error });
}
```

### 5. TypeScript Best Practices

- **Strict mode enabled** in `tsconfig.json`
- **No `any` types** - use `unknown` if necessary
- **Explicit return types** for public functions
- **Interface over type** for object shapes
- **Enums for constants** with multiple values

### 6. Naming Conventions

**Files:**

- Services: `*.service.ts` (e.g., `liquidity.service.ts`)
- Repositories: `*.repository.ts` (e.g., `pool.repository.ts`)
- Routes: `*.route.ts` (e.g., `health.route.ts`)
- Types: `*.types.ts` (e.g., `api.types.ts`)
- Utils: descriptive names (e.g., `logger.ts`, `validators.ts`)

**Code:**

- Functions: `camelCase`
- Classes: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Interfaces: `PascalCase` (no `I` prefix)
- Types: `PascalCase` with `Type` suffix if needed

### 7. Dependency Injection

**Export singletons, not classes:**

```typescript
// ✅ GOOD
export const liquidityService = {
  async calculate(poolId: string) {},
};

// ❌ AVOID (unless necessary)
export class LiquidityService {
  async calculate(poolId: string) {}
}
```

### 8. Testing Structure (when implemented)

```
tests/
├── unit/
│   ├── services/
│   └── store/
├── integration/
│   └── routes/
└── fixtures/
```

## Build & Deployment

### Build Process

```json
{
  "scripts": {
    "build": "prisma generate && tsc",
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js"
  }
}
```

### No Manual Steps

- Prisma generates client automatically
- TypeScript compiles to `dist/`
- No file copying required
- No post-build scripts needed

## Code Review Checklist

Before considering code complete, verify:

- [ ] Follows folder structure exactly
- [ ] No business logic in routes
- [ ] No database access in services
- [ ] Proper error handling throughout
- [ ] TypeScript strict mode passes
- [ ] Environment variables validated
- [ ] No hardcoded values
- [ ] Descriptive variable names
- [ ] Functions under 50 lines
- [ ] Files under 300 lines

## Examples

### Example Service with Repository

```typescript
// src/services/liquidity.service.ts
import { poolRepository } from "../store";
import { birdeyeService } from "./birdeye.service";
import { logger } from "../utils/logger";

export const liquidityService = {
  async syncRealTime(poolId: string) {
    try {
      const data = await birdeyeService.fetchLiquidity(poolId);
      return await poolRepository.createSnapshot({
        poolId,
        ...data,
      });
    } catch (error) {
      logger.error({ error, poolId }, "Failed to sync liquidity");
      throw error;
    }
  },
};
```

### Example Cron Job

```typescript
// src/cron/minute-liquidity-sync.ts
import { liquidityService } from "../services";
import { poolRepository } from "../store";
import { logger } from "../utils/logger";

export const minuteLiquiditySync = {
  schedule: "* * * * *",

  async run() {
    const pools = await poolRepository.getActive();

    await Promise.allSettled(
      pools.map((pool) => liquidityService.syncRealTime(pool.id)),
    );

    logger.info(`Synced ${pools.length} pools`);
  },
};
```

## Questions?

When in doubt:

1. Check this architecture guide first
2. Look at existing similar files
3. Ask for clarification before implementing
4. Prefer established patterns over novel solutions
