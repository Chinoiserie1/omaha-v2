# apps/web - CLAUDE.md

## Overview

This is the **Next.js 15** web application using the App Router with React 19. It serves as the public-facing frontend of the Autopilot platform.

## Technology Stack

- **Framework**: Next.js 15.x with App Router
- **React**: 19.x
- **TypeScript**: 5.7.x (strict mode)
- **Styling**: Tailwind CSS v4 (via @tailwindcss/postcss)
- **Validation**: Zod via `@repo/shared`

## Directory Structure

```
apps/web/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page (waitlist form)
│   ├── globals.css         # Global styles (Tailwind v4)
│   ├── not-found.tsx       # Custom 404 page
│   ├── components/         # Root page components
│   │   ├── OmahaLogo.tsx   # SVG logo component
│   │   └── WaitlistForm.tsx # Waitlist signup form
│   └── (dashboard)/        # Dashboard route group
│       ├── layout.tsx      # Dashboard layout
│       └── quants/         # Quant list & detail
│           ├── page.tsx    # Quant list page
│           ├── [id]/
│           │   └── page.tsx # Quant detail page
│           └── components/ # Dashboard components
│               ├── ApiTryPanel.tsx
│               ├── BacktestSummary.tsx
│               ├── PortfolioSection.tsx
│               ├── QuantCard.tsx
│               ├── QuantHeader.tsx
│               ├── SignificantTweets.tsx
│               └── TweetCard.tsx
├── lib/                    # Utility modules
│   ├── api.ts              # API client (types + fetch helpers)
│   └── format.ts           # formatNumber, formatPercent, formatDate
├── pages/                  # Pages Router (error page workaround)
│   └── _error.tsx          # Custom error page (React 18/19 conflict fix)
├── postcss.config.mjs      # PostCSS config (Tailwind v4 plugin)
├── next.config.ts          # Next.js configuration
├── tsconfig.json           # TypeScript config
├── eslint.config.js        # ESLint config
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

### PostCSS (Tailwind v4)

`postcss.config.mjs` uses `@tailwindcss/postcss` plugin. Both `tailwindcss` and `@tailwindcss/postcss` must be in the app's own `package.json` (don't rely on hoisting — breaks Vercel builds).

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
// lib/api.ts provides the base URL
const API_BASE =
  process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4001";

const response = await fetch(`${API_BASE}/api/users`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
```

## Environment Variables

- `NEXT_PUBLIC_API_URL` - Backend API base URL (default: `http://localhost:4001`)
- `NEXT_PUBLIC_MAKE_WEBHOOK_URL` - Make.com webhook URL for waitlist form
- Other `NEXT_PUBLIC_*` variables are exposed to the browser
- Server-side variables are not bundled into the client

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
- `pages/_error.tsx` exists as a workaround for React 18/19 version conflict during Next.js prerendering
- All pages use `export const dynamic = "force-dynamic"` to avoid prerender issues in the monorepo
- `lib/api.ts` contains shared TypeScript interfaces (KolItem, TweetData, PortfolioResponse, BacktestResult, etc.)
