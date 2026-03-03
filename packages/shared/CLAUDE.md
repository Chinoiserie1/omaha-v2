# packages/shared - CLAUDE.md

## Overview

This package contains **shared types, DTOs, and Zod schemas** used across all apps in the monorepo. It provides type-safe validation and consistent data structures.

## Technology Stack

- **Build Tool**: tsup
- **Validation**: Zod 3.x
- **TypeScript**: 5.7.x (strict mode)
- **Output**: ESM only

## Directory Structure

```
packages/shared/
├── src/
│   ├── index.ts            # Main export file
│   ├── types/
│   │   └── index.ts        # TypeScript interfaces
│   ├── dto/
│   │   └── index.ts        # Data Transfer Objects (inferred from Zod)
│   └── schemas/
│       └── index.ts        # Zod validation schemas
├── dist/                   # Built output (generated)
├── tsconfig.json           # TypeScript config (extends @repo/config-typescript/node.json)
├── tsup.config.ts          # Build configuration
├── eslint.config.js        # ESLint config (uses @repo/config-eslint/base)
└── package.json
```

## Development

```bash
# Build the package
pnpm --filter @repo/shared build

# Watch mode for development
pnpm --filter @repo/shared dev

# Type check
pnpm --filter @repo/shared typecheck

# Lint
pnpm --filter @repo/shared lint
```

## Usage in Apps

```typescript
// Import schemas for validation
import { createUserSchema, updateUserSchema } from "@repo/shared";

// Import types
import type { User, ApiResponse, PaginatedResponse } from "@repo/shared";

// Import DTOs (inferred from Zod schemas)
import type { CreateUserDto, UpdateUserDto } from "@repo/shared";
```

## Available Exports

### Types (`src/types/index.ts`)

```typescript
interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface PaginationParams {
  page?: number;
  pageSize?: number;
}
```

### Schemas (`src/schemas/index.ts`)

```typescript
// User creation
createUserSchema: z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
})

// User update
updateUserSchema: z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
})

// User response
userResponseSchema: z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

// Fund SOL (USDC → SOL swap)
fundSolRequestSchema: z.object({
  amountUsd: z.number().min(1).max(10),
  signerPublicKey: z.string(),
})

// Pagination
paginationSchema: z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
})

// ID parameter
idParamSchema: z.object({
  id: z.string().min(1),
})
```

### DTOs (`src/dto/index.ts`)

DTOs are inferred from Zod schemas:
```typescript
type CreateUserDto = z.infer<typeof createUserSchema>;
type UpdateUserDto = z.infer<typeof updateUserSchema>;
type UserResponseDto = z.infer<typeof userResponseSchema>;
type FundSolRequestDto = z.infer<typeof fundSolRequestSchema>;
type PaginationDto = z.infer<typeof paginationSchema>;
```

## Adding New Types/Schemas

### 1. Add Type Interface

```typescript
// src/types/index.ts
export interface Product {
  id: string;
  name: string;
  price: number;
}
```

### 2. Add Zod Schema

```typescript
// src/schemas/index.ts
export const createProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
});
```

### 3. Add DTO

```typescript
// src/dto/index.ts
export type CreateProductDto = z.infer<typeof createProductSchema>;
```

### 4. Export from Index

```typescript
// src/index.ts
export * from "./types/index.js";
export * from "./dto/index.js";
export * from "./schemas/index.js";
```

## Build Configuration

### tsup.config.ts

```typescript
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,           // Generate .d.ts files
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
```

## Package Exports

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

## Important Notes

- Always use `.js` extension in imports (ESM requirement)
- Run `pnpm --filter @repo/shared build` after changes
- Turborepo handles rebuild automatically during `pnpm dev`
- Zod schemas provide runtime validation
- DTOs provide compile-time type safety
