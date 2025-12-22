# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Overview

This is a **Turborepo monorepo** built with Next.js, Fastify, Expo (React Native), Prisma ORM, and TypeScript. The monorepo contains three applications and shared packages managed via pnpm workspaces.

### Apps

Each app has its own detailed CLAUDE.md file:

- **`apps/web/`** - Next.js 15 web application (port 3000)
  - See [apps/web/CLAUDE.md](./apps/web/CLAUDE.md)

- **`apps/back/`** - Fastify 5 REST API server (port 3001)
  - See [apps/back/CLAUDE.md](./apps/back/CLAUDE.md)

- **`apps/native/`** - Expo SDK 52 React Native application
  - See [apps/native/CLAUDE.md](./apps/native/CLAUDE.md)

### Packages

Each package has its own detailed CLAUDE.md file:

- **`packages/shared/`** - Shared types, DTOs, and Zod schemas
  - See [packages/shared/CLAUDE.md](./packages/shared/CLAUDE.md)

- **`packages/database/`** - Prisma ORM setup, schema, and client
  - See [packages/database/CLAUDE.md](./packages/database/CLAUDE.md)

- **`packages/config-eslint/`** - Shared ESLint 9 flat configurations
  - See [packages/config-eslint/CLAUDE.md](./packages/config-eslint/CLAUDE.md)

- **`packages/config-typescript/`** - Shared TypeScript configurations
  - See [packages/config-typescript/CLAUDE.md](./packages/config-typescript/CLAUDE.md)

## Package Manager

This project uses **pnpm** (v9.15.0). Always use `pnpm` commands, not npm or yarn.

## Development Commands

### Starting Development

```bash
# Start all apps in development mode
pnpm dev

# Start specific app only
pnpm --filter @repo/web dev    # Web app on port 3000
pnpm --filter @repo/back dev   # Backend API on port 3001
pnpm --filter @repo/native dev # Expo native app
```

### Database Commands

```bash
# Generate Prisma client (must run after schema changes)
pnpm db:generate

# Run migrations in development
pnpm db:migrate

# Push schema changes without migration (dev only)
pnpm db:push

# Open Prisma Studio
pnpm db:studio
```

### Building and Testing

```bash
# Build all apps and packages
pnpm build

# Lint all packages
pnpm lint

# Type check all packages
pnpm typecheck

# Run tests
pnpm test

# Clean all build artifacts
pnpm clean
```

## Environment Variables

Create a `.env` file in the root directory (see `.env.example`):

```env
DATABASE_URL="postgresql://user:password@localhost:5432/autopilot"
NODE_ENV=development
```

Environment variables are managed in `turbo.json` under `globalEnv`.

## Architecture Overview

### Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Monorepo | Turborepo | 2.7.x |
| Web Frontend | Next.js | 15.x |
| Mobile | Expo / React Native | SDK 52 |
| Backend | Fastify | 5.x |
| Database | PostgreSQL + Prisma | 6.x |
| Validation | Zod | 3.x |
| Linting | ESLint | 9.x (flat config) |
| Language | TypeScript | 5.7.x |

### ESM Only

All packages use ESM (`"type": "module"`). There is no CommonJS output.

### Shared Code Pattern

- **Types & DTOs**: Defined in `packages/shared/src/types/`
- **Zod Schemas**: Defined in `packages/shared/src/schemas/`
- **Inferred Types**: DTOs are inferred from Zod schemas in `packages/shared/src/dto/`

All apps import from `@repo/shared`:
```typescript
import { createUserSchema, type CreateUserDto, type User } from "@repo/shared";
```

### Database Access

Prisma client is exported from `packages/database`:
```typescript
import { prisma, type User } from "@repo/database";
```

## Turbo Pipeline

The build order is:
1. `packages/database` (Prisma generate)
2. `packages/shared` (build with tsup)
3. `apps/*` (build each app)

Key tasks:
- `build`: Depends on `^build` and `^db:generate`
- `dev`: Persistent, depends on `^db:generate`
- `lint`: Depends on `^build`
- `typecheck`: Depends on `^build` and `^db:generate`

## Port Assignments

- Web: `3000`
- Backend API: `3001`
- Prisma Studio: `5555` (default)

## Common Workflows

### Adding a New Feature

1. If types are needed, add to `packages/shared/src/types/`
2. If validation is needed, add Zod schema to `packages/shared/src/schemas/`
3. If database changes are needed:
   - Modify `packages/database/prisma/schema.prisma`
   - Run `pnpm db:migrate` or `pnpm db:push`
4. Run `pnpm db:generate` to regenerate Prisma client
5. Implement feature in relevant app(s)

### Database Schema Changes

1. Modify `packages/database/prisma/schema.prisma`
2. Run `pnpm db:migrate` for production-ready migrations
3. Or run `pnpm db:push` for quick development iteration
4. Run `pnpm db:generate` to regenerate Prisma client

### Working with Shared Packages

- Changes to `packages/shared/` require rebuild: `pnpm --filter @repo/shared build`
- Turborepo handles incremental builds automatically
- Always run `pnpm db:generate` after database schema changes

## Code Style

- ESLint 9 with flat config (`eslint.config.js`)
- Strict TypeScript settings
- Consistent type imports: `import type { X } from "y"`
- No `any` types (warn)
- Unused variables must be prefixed with `_`

## Node.js Version

This project requires Node.js 20 or higher. Use `.nvmrc` with nvm:
```bash
nvm use
```

## Workspace Dependencies

Internal packages use the workspace protocol:
```json
{
  "dependencies": {
    "@repo/shared": "workspace:*",
    "@repo/database": "workspace:*"
  }
}
```

## Pull Request Strategy

This project uses a **rebase and squash** strategy:

1. Keep your branch up to date with `git pull origin main --rebase`
2. Use `git push --force-with-lease` to safely force push
3. Always use "Squash and merge" when merging PRs
