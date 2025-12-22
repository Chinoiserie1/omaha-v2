# apps/web - CLAUDE.md

## Overview

This is the **Next.js 15** web application using the App Router with React 19. It serves as the public-facing frontend of the Autopilot platform.

## Technology Stack

- **Framework**: Next.js 15.x with App Router
- **React**: 19.x
- **TypeScript**: 5.7.x (strict mode)
- **Styling**: Plain CSS (globals.css)
- **Validation**: Zod via `@repo/shared`

## Directory Structure

```
apps/web/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   ├── globals.css         # Global styles
│   └── components/         # Components used only by root page
├── components/             # Shared components (used across multiple pages)
├── next.config.ts          # Next.js configuration
├── tsconfig.json           # TypeScript config (extends @repo/config-typescript/nextjs.json)
├── eslint.config.js        # ESLint config (uses @repo/config-eslint/next)
└── package.json
```

## Component Organization (Colocation)

**Components should be as close as possible to where they are used.**

### Rules

1. **Single-use components**: Place in a `components/` folder next to the page that uses them
2. **Shared components**: Place in root `components/` folder when used by multiple pages

### Examples

```
app/
├── page.tsx                      # Uses UserForm, ValidationResult
├── components/
│   ├── UserForm.tsx              # Only used by root page
│   └── ValidationResult.tsx      # Only used by root page
├── users/
│   ├── page.tsx                  # Uses UserCard, UserList
│   ├── [id]/
│   │   ├── page.tsx              # Uses UserProfile
│   │   └── components/
│   │       └── UserProfile.tsx   # Only used by user detail page
│   └── components/
│       ├── UserCard.tsx          # Only used in /users
│       └── UserList.tsx          # Only used in /users
└── settings/
    ├── page.tsx
    └── components/
        └── SettingsForm.tsx      # Only used in /settings

components/                       # ROOT: Shared across multiple pages
├── Button.tsx                    # Used everywhere
├── Modal.tsx                     # Used in multiple pages
└── LoadingSpinner.tsx            # Used everywhere
```

### When to Move a Component

- **Stay colocated**: Component is only used in one page/section
- **Move to root**: Component is needed in 2+ unrelated pages

Next.js App Router allows non-page files inside `app/` - only files that export a default page component become routes.

## Development

```bash
# Start development server
pnpm dev              # From root
pnpm --filter @repo/web dev  # Specific to this app

# Build for production
pnpm --filter @repo/web build

# Type check
pnpm --filter @repo/web typecheck

# Lint
pnpm --filter @repo/web lint
```

The development server runs on **port 3000**.

## Configuration

### TypeScript

Extends `@repo/config-typescript/nextjs.json` with:
- `moduleResolution: "Bundler"`
- `jsx: "preserve"`
- `noEmit: true`
- Path alias: `@/*` maps to `./*`

### ESLint

Uses `@repo/config-eslint/next` which includes:
- React and React Hooks rules
- TypeScript ESLint
- Next.js specific rules

### Next.js Config

```typescript
// next.config.ts
{
  transpilePackages: ["@repo/shared"],
  experimental: {
    turbo: {},
  },
}
```

## Using Shared Packages

Import from `@repo/shared` for types and validation:

```typescript
import { createUserSchema, type CreateUserDto } from "@repo/shared";

// Validate data
const result = createUserSchema.safeParse(data);
if (!result.success) {
  // Handle validation error
}
```

## File Conventions

- **`page.tsx`**: Route pages
- **`layout.tsx`**: Shared layouts
- **`loading.tsx`**: Loading UI (Suspense)
- **`error.tsx`**: Error boundaries
- **`not-found.tsx`**: 404 pages

## Server vs Client Components

- Default: Server Components (no `"use client"`)
- Use `"use client"` for:
  - Event handlers (onClick, onChange, etc.)
  - useState, useEffect, useContext
  - Browser-only APIs

## Common Patterns

### Form Validation

```typescript
"use client";

import { createUserSchema } from "@repo/shared";

function Form() {
  const handleSubmit = (formData: FormData) => {
    const result = createUserSchema.safeParse({
      email: formData.get("email"),
      name: formData.get("name"),
    });

    if (!result.success) {
      // Show validation errors
      return;
    }

    // Process valid data
  };
}
```

### API Calls to Backend

```typescript
const response = await fetch("http://localhost:3001/api/users", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
```

## Environment Variables

Next.js environment variables:
- `NEXT_PUBLIC_*` - Exposed to browser
- Others - Server-side only

## Build Output

Production build generates:
- `.next/` - Build artifacts
- `.next/static/` - Static assets

## Testing

(Add testing setup when implemented)

## Important Notes

- Uses Turbopack in development (`next dev --turbo` is default)
- Transpiles `@repo/shared` for compatibility
- All imports from workspace packages work at runtime
