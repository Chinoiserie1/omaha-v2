# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Overview

This is a **Turborepo monorepo** built with Next.js, Fastify, Expo (React Native), Prisma ORM, TypeScript, and on-chain Solana programs (Rust/Pinocchio). The monorepo contains four applications and shared packages managed via pnpm workspaces.

### Flow Documentation

- [User / Quant / Vault Architecture](./docs/flow/USER-QUANT-VAULT.md) — User types, Quant profiles, vault ownership, and account linking
- [Fund SOL (USDC → SOL for gas fees)](./docs/flow/FUND-SOL.md) — Full transaction flow from mobile UI to on-chain swap
- [Withdraw from Vault](./docs/flow/WITHDRAW-VAULT.md) — Multi-step withdrawal flow (redeem → fulfill → claim)
- [Price Worker](./docs/flow/PRICE-WORKER.md) — Token price fetching, multi-instance scaling, and vault share pricing

### Deployment

- [Vault Mainnet Deployment](./docs/deployment/VAULT-MAINNET.md) — Mainnet addresses, keypair inventory, and operational commands
- [Vault Devnet Deployment](./docs/deployment/VAULT-DEVNET.md) — Devnet keypair inventory, step-by-step deploy commands, and troubleshooting

### Apps

Each app has its own detailed CLAUDE.md file:

- **`apps/web/`** - Next.js 15 web application (port 3000)

  - See [apps/web/CLAUDE.md](./apps/web/CLAUDE.md)

- **`apps/back/`** - Fastify 5 REST API server (port 4001)

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

- **`packages/omaha-programs-sdk/`** - Fully-typed TypeScript SDK for Solana vault program instructions

  - See [packages/omaha-programs-sdk/CLAUDE.md](./packages/omaha-programs-sdk/CLAUDE.md)

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

<!-- AUTO-GENERATED from root package.json — do not edit manually -->

### Starting Development

```bash
# Start all apps in development mode
pnpm dev

# Start specific app only (convenience shortcuts)
pnpm dev:web                   # Web app on port 3000
pnpm dev:back                  # Backend API on port 4001
pnpm dev:ios                   # Expo iOS simulator
pnpm dev:android               # Expo Android emulator
pnpm dev:ios:release            # iOS release build
pnpm dev:android:release        # Android release build

# Or use filters directly
pnpm --filter @repo/web dev
pnpm --filter @repo/back dev
pnpm --filter @repo/native dev
```

### Building and Testing

```bash
pnpm build                     # Build all apps and packages
pnpm build:web                 # Build web app only
pnpm build:back                # Build backend only
pnpm lint                      # Lint all packages
pnpm lint:web                  # Lint web only
pnpm lint:back                 # Lint backend only
pnpm lint:native               # Lint native only
pnpm typecheck                 # Type check all packages
pnpm typecheck:web             # Type check web only
pnpm typecheck:back            # Type check backend only
pnpm typecheck:native          # Type check native only
pnpm test                      # Run tests
pnpm clean                     # Clean all build artifacts + node_modules
```

### Database Commands

```bash
pnpm db:generate               # Generate Prisma client (after schema changes)
pnpm db:migrate                # Run migrations in development
pnpm db:push                   # Push schema changes without migration (dev only)
pnpm db:studio                 # Open Prisma Studio
pnpm db:up                     # Start PostgreSQL + Redis via docker compose
pnpm db:down                   # Stop docker compose services
```

### Solana Program Commands

```bash
pnpm program:build             # Build the vault program (BPF target)
pnpm program:test              # Run vault program unit tests
pnpm program:deploy            # Deploy vault program to devnet
```

### Data & Seed Scripts

```bash
pnpm seed:kols                 # Seed Quant (KOL) data
pnpm create-vault              # Create vault in database
pnpm seed-vaults               # Seed vault data
pnpm sync-tokens               # Sync Jupiter verified tokens to Token
pnpm sync-aliases              # Sync asset aliases (crypto + stock mappings)
pnpm seed-stocks               # Seed xStock + Ondo GM tokenized stock tokens
pnpm sync-icons                # Sync token icon URLs from Jupiter
pnpm backfill-algo-all         # Backfill algo results for all Quants
```

### On-Chain Admin Scripts

```bash
# Factory initialization (root-level, runs via turbo)
pnpm initialize-factory        # Initialize factory PDA on-chain

# Vault creation (root-level, runs via turbo)
pnpm create-vault-onchain --name "my-vault" [--dry-run]

# Factory/vault management (run via backend filter — NOT registered at root)
pnpm --filter @repo/back manage-factory-admin add --admin <pubkey>
pnpm --filter @repo/back transfer-factory-ownership --new-owner <pubkey>
pnpm --filter @repo/back transfer-vault-admin --vault-name <name> --new-admin <pubkey>
pnpm --filter @repo/back manage-vault-operator add --vault-name <name> --operator <pubkey>
```

### Production & Worktree

```bash
pnpm start:back                # Start backend in production mode
pnpm --filter @repo/back start:price-worker  # Start standalone price worker
pnpm native:clean              # Clean native app build artifacts

# Git worktree helpers (parallel branch development)
pnpm wt:create                 # Create a new worktree
pnpm wt:start                  # Start dev in worktree
pnpm wt:ios                    # Start iOS dev in worktree
pnpm wt:android                # Start Android dev in worktree
pnpm wt:clean                  # Clean up worktrees
```

<!-- /AUTO-GENERATED -->

## Environment Variables

Create a `.env` file in the root directory (see `.env.example`). The native app also has its own `.env.example` in `apps/native/`.

<!-- AUTO-GENERATED from .env.example — do not edit manually -->

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql://user:password@localhost:5456/autopilot`) |
| `REDIS_URL` | Yes | Redis connection string (`redis://localhost:6380`) |
| `NODE_ENV` | Yes | Environment (`development` / `production`) |
| `EXPO_PUBLIC_PRIVY_APP_ID` | Yes | Privy app ID (from dashboard.privy.io) |
| `EXPO_PUBLIC_PRIVY_CLIENT_ID` | Yes | Privy client ID |
| `PRIVY_APP_SECRET` | Yes | Privy app secret (backend only) |
| `EXPO_PUBLIC_POSTHOG_API_KEY` | No | PostHog analytics key (EU cloud) |
| `RAPIDAPI_KEY` | No | Twitter API via RapidAPI |
| `ANTHROPIC_API_KEY` | No | Anthropic API for signal analysis |
| `SOLANA_NETWORK` | No | `mainnet` or `devnet` (default: mainnet) — selects USDC mint |
| `SOLANA_RPC_URL` | No | Solana RPC endpoint (backend) |
| `USDC_MINT` | No | Override USDC mint address (auto-selected from `SOLANA_NETWORK`) |
| `EXPO_PUBLIC_SOLANA_NETWORK` | No | `mainnet` or `devnet` (default: mainnet) — native app |
| `EXPO_PUBLIC_SOLANA_RPC_URL` | No | Solana RPC endpoint (native app) |
| `EXPO_PUBLIC_USDC_MINT` | No | Override USDC mint address (native app) |
| `ADMIN_PROGRAM_PRIVATE_KEY` | No | Factory owner + vault admin keypair for on-chain operations |
| `PROGRAM_AUTHORITY_PRIVATE_KEY` | No | Program authority keypair for factory init (remove after) |
| `FEE_PAYER_PRIVATE_KEY` | No | Fee payer for Fund SOL transactions |
| `JUPITER_API_KEY` | No | Jupiter swap + price API key |
| `JUPITER_API_KEYS` | No | Comma-separated keys from different Jupiter accounts (price worker multi-account scaling) |
| `JUPITER_RPM` | No | Jupiter requests/min per key (default: 55 for free tier) |
| `PRICE_CONCURRENCY` | No | Max concurrent price fetch requests (default: 10) |
| `PRICE_BATCH_SIZE` | No | Mints per Jupiter price API call (default: 50, max 50) |
| `BIRDEYE_API_KEY` | No | Birdeye price data for backtesting + fallback pricing |
| `TELEGRAM_BOT_TOKEN` | No | Telegram health check bot |
| `TELEGRAM_CHAT_ID` | No | Telegram group chat ID |
| `NEXT_PUBLIC_API_URL` | No | Backend API URL for web app |
| `NEXT_PUBLIC_MAKE_WEBHOOK_URL` | No | Make.com webhook for waitlist |

<!-- /AUTO-GENERATED -->

Full variable list with defaults and cron schedules: see `.env.example`. Variables are registered in `turbo.json` under `globalEnv`.

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
- Backend API: `4001`
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
