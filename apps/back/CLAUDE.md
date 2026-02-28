# apps/back - CLAUDE.md

## Overview

This is the **Fastify 5** REST API backend using TypeScript and ESM. It provides the API endpoints for the Autopilot platform.

## Technology Stack

- **Framework**: Fastify 5.x
- **Runtime**: Node.js 20+ with ESM
- **TypeScript**: 5.7.x (strict mode)
- **Database**: PostgreSQL via `@repo/database` (Prisma)
- **Validation**: Zod via `@repo/shared`
- **Dev Runner**: tsx (watch mode)

## Directory Structure

```
apps/back/
├── src/
│   ├── index.ts            # Entry point, server startup
│   ├── app.ts              # Fastify app configuration
│   └── routes/
│       └── users.ts        # User CRUD routes
├── tsconfig.json           # TypeScript config (extends @repo/config-typescript/node.json)
├── eslint.config.js        # ESLint config (uses @repo/config-eslint/node)
└── package.json
```

## Development

```bash
# Start development server with hot reload
pnpm dev              # From root
pnpm --filter @repo/back dev  # Specific to this app

# Build for production
pnpm --filter @repo/back build

# Start production server
pnpm --filter @repo/back start

# Type check
pnpm --filter @repo/back typecheck

# Lint
pnpm --filter @repo/back lint
```

The development server runs on **port 3001**.

## Configuration

### TypeScript

Extends `@repo/config-typescript/node.json` with:
- `module: "NodeNext"`
- `moduleResolution: "NodeNext"`
- `target: "ES2022"`
- Output to `dist/`

### ESLint

Uses `@repo/config-eslint/node` which includes:
- Node.js specific rules (eslint-plugin-n)
- TypeScript ESLint
- Console logging allowed for `info`, `warn`, `error`

## API Routes

### Health Check

```
GET /health
Response: { status: "ok", timestamp: "2024-01-01T00:00:00.000Z" }
```

### Users API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List users (paginated) |
| GET | `/api/users/:id` | Get user by ID |
| POST | `/api/users` | Create new user |
| PATCH | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |

### KOL Tweets API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kols/:kolId/tweets` | List tweets by KOL (paginated) |
| GET | `/api/kols/:kolId/tweets/significant` | List significant tweets with impact scores |
| GET | `/api/kols/:kolId/threads/:conversationId` | Get tweet thread |

## Using Shared Packages

### Prisma Client

```typescript
import { prisma } from "@repo/database";

const users = await prisma.user.findMany();
```

### Zod Validation

```typescript
import { createUserSchema, type ApiResponse } from "@repo/shared";

const result = createUserSchema.safeParse(request.body);
if (!result.success) {
  return reply.status(400).send({
    success: false,
    error: result.error.errors.map(e => e.message).join(", "),
  } satisfies ApiResponse<never>);
}
```

## Route Pattern

```typescript
import type { FastifyInstance } from "fastify";
import { prisma } from "@repo/database";
import { someSchema, type ApiResponse } from "@repo/shared";

export async function myRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    // Validate query/params/body with Zod
    // Use Prisma for database operations
    // Return typed response
  });
}
```

## Error Handling

Use the `ApiResponse` type from `@repo/shared`:

```typescript
// Success
return { success: true, data: user } satisfies ApiResponse<User>;

// Error
return reply.status(400).send({
  success: false,
  error: "Validation failed",
} satisfies ApiResponse<never>);
```

## Environment Variables

- `PORT` - Server port (default: 3001)
- `HOST` - Server host (default: 0.0.0.0)
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment (development/production)

## Build Output

Production build generates:
- `dist/` - Compiled JavaScript (ESM)

Run with: `node dist/index.js`

## ESM Import Notes

When importing local files, use `.js` extension:
```typescript
import { buildApp } from "./app.js";
import { userRoutes } from "./routes/users.js";
```

## CORS

CORS is enabled for all origins in development:
```typescript
await app.register(cors, { origin: true });
```

## Logging

Fastify logger is configured:
- Development: `debug` level
- Production: `info` level

## Testing

(Add testing setup when implemented)

## Important Notes

- Uses tsx for development (fast TypeScript execution)
- ESM-only (no CommonJS)
- Prisma client must be generated before starting
- Database must be accessible via `DATABASE_URL`
