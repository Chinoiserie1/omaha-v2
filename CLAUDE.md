# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Overview

This is a **Turborepo monorepo** built with Next.js, Fastify, Expo (React Native), Prisma ORM, TypeScript, and on-chain Solana programs (Rust/Pinocchio). The monorepo contains four applications and shared packages managed via pnpm workspaces.

### Flow Documentation

- [User / Quant / Vault Architecture](./docs/flow/USER-QUANT-VAULT.md) — User types, Quant profiles, vault ownership, and account linking
- [Fund SOL (USDC → SOL for gas fees)](./docs/flow/FUND-SOL.md) — Full transaction flow from mobile UI to on-chain swap
- [Withdraw from Vault](./docs/flow/WITHDRAW-VAULT.md) — Multi-step withdrawal flow (redeem → fulfill → claim)

### Apps

Each app has its own detailed CLAUDE.md file:

- **`apps/web/`** - Next.js 15 web application (port 3000)

  - See [apps/web/CLAUDE.md](./apps/web/CLAUDE.md)

- **`apps/back/`** - Fastify 5 REST API server (port 3001)

  - See [apps/back/CLAUDE.md](./apps/back/CLAUDE.md)

- **`apps/native/`** - Expo SDK 54 React Native application
  - See [apps/native/CLAUDE.md](./apps/native/CLAUDE.md)

- **`apps/programs/vault/`** - Solana on-chain tokenized vault program (Rust/Pinocchio)
  - See [apps/programs/vault/CLAUDE.md](./apps/programs/vault/CLAUDE.md)

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

## Command Execution Rules

**IMPORTANT: All commands MUST be executed from the repository root directory.**

### Why Root-Only Execution?

- Turborepo orchestrates tasks across all packages with proper dependency ordering
- Environment variables and caching are managed centrally
- Ensures consistent behavior across all workspaces

### Rules

1. **Always run from root** - Never `cd` into `apps/` or `packages/` to run commands
2. **Use root scripts only** - All scripts in root `package.json` are the single source of truth
3. **Use filters for specific apps** - `pnpm --filter @repo/web dev` instead of `cd apps/web && pnpm dev`

### Examples

```bash
# CORRECT - Run from root
pnpm dev                          # Start all apps
pnpm --filter @repo/native dev    # Start only native app
pnpm lint                         # Lint all packages
pnpm --filter @repo/back lint     # Lint only backend

# WRONG - Never do this
cd apps/web && pnpm dev           # DON'T cd into apps
cd packages/shared && pnpm build  # DON'T cd into packages
```

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update tasks/lessons md with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management
1. **Plan First**: Write plan to tasks/todo.d with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to
'tasks/todo.md

6. **Capture Lessons**: Update tasks/lessons.md after corrections
## Core Principles
- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.


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

### Solana Program Commands

```bash
# Build the vault program (BPF target)
pnpm program:build

# Run vault program unit tests
pnpm program:test
```

## Environment Variables

Create a `.env` file in the root directory (see `.env.example`):

```env
DATABASE_URL="postgresql://user:password@localhost:5456/autopilot"
REDIS_URL="redis://localhost:6380"
NODE_ENV=development
```

Environment variables are managed in `turbo.json` under `globalEnv`.

## Architecture Overview

### Technology Stack

| Layer        | Technology          | Version           |
| ------------ | ------------------- | ----------------- |
| Monorepo     | Turborepo           | 2.7.x             |
| Web Frontend | Next.js             | 15.x              |
| Mobile       | Expo / React Native | SDK 54            |
| Backend      | Fastify             | 5.x               |
| Database     | PostgreSQL + Prisma | 6.x               |
| Validation   | Zod                 | 3.x               |
| Linting      | ESLint              | 9.x (flat config) |
| Language     | TypeScript          | 5.7.x             |
| On-chain     | Pinocchio (Rust)    | 0.9.x             |

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

### Adding New Scripts

**When implementing a new CLI script, you MUST update both `package.json` and `turbo.json`.**

#### Steps to Add a New Script

1. **Add to root `package.json`** - Create the script entry
2. **Add to `turbo.json`** - Register the task in the pipeline
3. **Configure task properties** - Set dependencies, outputs, and caching

#### turbo.json Task Configuration

```json
{
  "tasks": {
    "my-new-task": {
      "dependsOn": ["^build"],      // Run after dependencies build
      "outputs": ["dist/**"],        // Cache these outputs
      "cache": true,                 // Enable caching (false for side-effects)
      "persistent": false            // true for long-running tasks (dev servers)
    }
  }
}
```

#### Common Task Patterns

| Task Type | `cache` | `persistent` | `dependsOn` |
|-----------|---------|--------------|-------------|
| Build | `true` | `false` | `["^build"]` |
| Dev server | `false` | `true` | `["^db:generate"]` |
| Lint/Test | `true` | `false` | `["^build"]` |
| DB commands | `false` | `false` | `[]` |

#### Example: Adding a `format` Script

```bash
# 1. Add to root package.json
"format": "turbo run format"

# 2. Add to turbo.json tasks
"format": {
  "outputs": [],
  "cache": false
}

# 3. Add to each app's package.json that needs formatting
"format": "prettier --write ."
```

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

## File Organization (Single Responsibility)

**Each file must have ONE clear responsibility.** Keep files small and focused.

### Rules

1. **One logic per file** - Each file handles a single concern
2. **Max ~100 lines** - If a file exceeds 100 lines, consider splitting it
3. **Extract early** - Don't wait for files to become large; extract when a second responsibility appears

### Backend (Fastify)

```
routes/
├── users/
│   ├── index.ts          # Route registration only
│   ├── handlers/
│   │   ├── list.ts       # GET / handler
│   │   ├── get.ts        # GET /:id handler
│   │   ├── create.ts     # POST / handler
│   │   ├── update.ts     # PATCH /:id handler
│   │   └── delete.ts     # DELETE /:id handler
│   └── validation.ts     # Shared validation helpers (if needed)
```

### Frontend (Next.js / React Native)

```
app/
├── page.tsx              # Page container (orchestration only)
├── components/
│   ├── UserForm.tsx      # Form logic + inputs
│   └── ValidationResult.tsx  # Result display
```

### Packages

```
packages/shared/src/
├── types/
│   ├── user.ts           # User-related types
│   └── api.ts            # API response types
├── schemas/
│   ├── user.ts           # User Zod schemas
│   └── pagination.ts     # Pagination schema
```

### What belongs in each file type

| File Type | Contains | Does NOT contain |
|-----------|----------|------------------|
| Handler | Single endpoint logic | Multiple endpoints, route setup |
| Component | Single UI concern | Business logic, multiple components |
| Schema | Related validations | Unrelated schemas |
| Types | Related interfaces | Implementation logic |
| Index | Exports/registration | Business logic |

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
