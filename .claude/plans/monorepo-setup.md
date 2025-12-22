# Turborepo Monorepo Implementation Plan

## Overview

Create a production-ready Turborepo monorepo with:
- **apps/web**: Next.js 16 with TypeScript
- **apps/back**: Fastify 5 with TypeScript + ESM
- **apps/native**: Expo SDK 53 with React Native
- **packages/shared**: Shared types, DTOs, Zod schemas
- **packages/database**: Prisma 7 with ESM support
- **packages/config-eslint**: Shared ESLint 9 flat configs
- **packages/config-typescript**: Shared TypeScript configs

## Version Matrix

| Package | Version | Notes |
|---------|---------|-------|
| Turborepo | 2.7.1 | Latest with devtools |
| Next.js | 16.1.0 | Turbopack stable, React 19 |
| Fastify | 5.6.2 | ESM-first, Node 20+ |
| Expo SDK | 53 | React Native 0.79 |
| Prisma | 7.2.0 | New `prisma-client` generator |
| ESLint | 9.39.1 | Flat config |
| TypeScript | 5.7.2 | Latest |
| pnpm | 9.x | Workspace support |
| Node.js | 20+ | Required for Fastify 5 |

---

## Phase 1: Root Configuration

### 1.1 Initialize pnpm Workspace

**Files to create:**
- `package.json` - Root package with scripts
- `pnpm-workspace.yaml` - Workspace definition
- `turbo.json` - Turborepo configuration
- `.gitignore` - Git ignores
- `.npmrc` - pnpm configuration
- `.nvmrc` - Node version

**package.json:**
```json
{
  "name": "autopilot",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf node_modules",
    "db:generate": "turbo run db:generate",
    "db:migrate": "pnpm --filter @repo/database db:migrate",
    "db:push": "pnpm --filter @repo/database db:push",
    "db:studio": "pnpm --filter @repo/database db:studio"
  },
  "devDependencies": {
    "turbo": "^2.7.1",
    "typescript": "^5.7.2"
  }
}
```

**pnpm-workspace.yaml:**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**turbo.json:**
```json
{
  "$schema": "https://turborepo.com/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build", "^db:generate"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"],
      "inputs": ["$TURBO_DEFAULT$", "!**/*.test.ts", "!**/*.spec.ts"]
    },
    "dev": {
      "cache": false,
      "persistent": true,
      "dependsOn": ["^db:generate"]
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": [],
      "cache": true
    },
    "typecheck": {
      "dependsOn": ["^build", "^db:generate"],
      "outputs": [],
      "cache": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "cache": true
    },
    "clean": {
      "cache": false
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    },
    "db:studio": {
      "cache": false,
      "persistent": true
    }
  },
  "globalEnv": ["NODE_ENV", "DATABASE_URL"],
  "globalPassThroughEnv": ["CI"]
}
```

---

## Phase 2: TypeScript Configuration Package

### 2.1 packages/config-typescript

**Structure:**
```
packages/config-typescript/
├── package.json
├── base.json
├── node.json
├── nextjs.json
├── react-library.json
└── CLAUDE.md
```

**base.json** - Shared strict settings:
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Base",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**node.json** - For Node.js packages (back, database):
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Node.js ESM",
  "extends": "./base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "dist",
    "noEmit": false
  }
}
```

**nextjs.json** - For Next.js apps:
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Next.js",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowJs": true,
    "jsx": "preserve",
    "noEmit": true,
    "incremental": true,
    "isolatedModules": true,
    "plugins": [{ "name": "next" }]
  }
}
```

**react-library.json** - For shared React components:
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "React Library",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "outDir": "dist"
  }
}
```

---

## Phase 3: ESLint Configuration Package

### 3.1 packages/config-eslint

**Structure:**
```
packages/config-eslint/
├── package.json
├── base.js
├── next.js
├── node.js
├── react.js
└── CLAUDE.md
```

Using ESLint 9 flat config with:
- `@eslint/js` for base rules
- `typescript-eslint` for TypeScript
- `eslint-plugin-react` + `eslint-plugin-react-hooks` for React
- `eslint-config-next` for Next.js
- `eslint-plugin-n` for Node.js

---

## Phase 4: Shared Package

### 4.1 packages/shared

**Structure:**
```
packages/shared/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts
│   ├── types/
│   │   └── index.ts
│   ├── dto/
│   │   └── index.ts
│   └── schemas/
│       └── index.ts
└── CLAUDE.md
```

**Key decisions:**
- Use `tsup` for building to ESM with type declarations
- Export everything from `src/index.ts`
- Zod schemas with inferred types
- No runtime dependencies except Zod

---

## Phase 5: Database Package

### 5.1 packages/database

**Structure:**
```
packages/database/
├── package.json
├── tsconfig.json
├── prisma/
│   └── schema.prisma
├── src/
│   ├── index.ts
│   └── client.ts
├── generated/
│   └── client/  (generated by Prisma)
└── CLAUDE.md
```

**Key decisions:**
- Use new `prisma-client` generator (not `prisma-client-js`)
- Output to `generated/client/` directory
- Singleton pattern with global memoization
- Export types from generated client

**schema.prisma:**
```prisma
generator client {
  provider = "prisma-client"
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
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## Phase 6: Apps

### 6.1 apps/web (Next.js)

**Structure:**
```
apps/web/
├── package.json
├── tsconfig.json
├── next.config.js
├── eslint.config.js
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   └── example.tsx
└── CLAUDE.md
```

**Key features:**
- Next.js 16.1.0 with App Router
- TypeScript extending `@repo/config-typescript/nextjs.json`
- ESLint using `@repo/config-eslint/next`
- Imports `@repo/shared` for Zod validation example

### 6.2 apps/back (Fastify)

**Structure:**
```
apps/back/
├── package.json
├── tsconfig.json
├── eslint.config.js
├── src/
│   ├── index.ts
│   ├── app.ts
│   ├── routes/
│   │   └── users.ts
│   └── plugins/
└── CLAUDE.md
```

**Key features:**
- Fastify 5.6.2 with ESM
- TypeScript extending `@repo/config-typescript/node.json`
- Uses `tsx` for development
- Integrates `@repo/shared` for validation
- Integrates `@repo/database` for Prisma

### 6.3 apps/native (Expo)

**Structure:**
```
apps/native/
├── package.json
├── tsconfig.json
├── app.json
├── babel.config.js
├── metro.config.js
├── eslint.config.js
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   └── (tabs)/
└── CLAUDE.md
```

**Key features:**
- Expo SDK 53 with React Native 0.79
- Auto-configured Metro for monorepo (SDK 52+)
- TypeScript with path aliases for `@repo/shared`
- Example screen using shared types

---

## Phase 7: CLAUDE.md Files

Create CLAUDE.md documentation for:
1. Root - Overview, commands, architecture
2. apps/web - Next.js specifics
3. apps/back - Fastify specifics
4. apps/native - Expo/React Native specifics
5. packages/shared - Types and validation
6. packages/database - Prisma usage
7. packages/config-eslint - ESLint configuration
8. packages/config-typescript - TypeScript configuration

---

## Phase 8: Testing & Verification

### 8.1 Verification Checklist

- [ ] `pnpm install` succeeds
- [ ] `pnpm dev` starts all apps
- [ ] `pnpm build` builds all packages and apps
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm db:generate` generates Prisma client
- [ ] apps/web can import from `@repo/shared`
- [ ] apps/back can use `@repo/database` Prisma client
- [ ] apps/native can import shared types

---

## File Creation Order

1. Root configuration files
2. `packages/config-typescript/`
3. `packages/config-eslint/`
4. `packages/shared/`
5. `packages/database/`
6. `apps/web/`
7. `apps/back/`
8. `apps/native/`
9. All CLAUDE.md files
10. Final verification

---

## Environment Variables

**Required for development:**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/autopilot"
```

**Optional:**
```env
NODE_ENV=development
```

---

## Important Notes

1. **ESM Only**: All packages use ESM (`"type": "module"`)
2. **Workspace Protocol**: Use `"workspace:*"` for internal dependencies
3. **Prisma 7**: Uses new generator with driver adapters
4. **Expo SDK 53**: Auto-detects monorepo, no manual Metro config needed
5. **ESLint 9**: Uses flat config with `eslint.config.js`
6. **Node 20+**: Required for Fastify 5 and modern features

## Commands Quick Reference

```bash
# Development
pnpm dev                    # Start all apps
pnpm --filter @repo/web dev # Start specific app

# Building
pnpm build                  # Build everything
pnpm --filter @repo/back build

# Database
pnpm db:generate           # Generate Prisma client
pnpm db:migrate            # Run migrations
pnpm db:push               # Push schema (dev only)
pnpm db:studio             # Open Prisma Studio

# Code Quality
pnpm lint                  # Lint all
pnpm typecheck             # Type check all
pnpm test                  # Run tests
```
