# packages/config-eslint - CLAUDE.md

## Overview

This package contains **shared ESLint 9 flat configurations** for all apps and packages in the monorepo. It provides consistent linting rules across the codebase.

## Technology Stack

- **ESLint**: 9.x (flat config)
- **TypeScript ESLint**: 8.x
- **Plugins**: react, react-hooks, n (node)

## Directory Structure

```
packages/config-eslint/
├── base.js                 # Base config for all packages
├── next.js                 # Next.js/React config
├── node.js                 # Node.js backend config
├── react.js                # React library config
└── package.json
```

## Available Configs

### base.js

Base configuration for TypeScript packages:
- ESLint recommended rules
- TypeScript ESLint recommended
- Consistent type imports
- Unused variables with `_` prefix allowed

```javascript
import baseConfig from "@repo/config-eslint/base";
export default baseConfig;
```

### next.js

Configuration for Next.js applications:
- Extends base config
- React and React Hooks rules
- JSX support
- Browser + Node globals

```javascript
import nextConfig from "@repo/config-eslint/next";
export default nextConfig;
```

### node.js

Configuration for Node.js backends:
- Extends base config
- Node.js specific rules (eslint-plugin-n)
- ESM/CJS mixed support
- Node globals

```javascript
import nodeConfig from "@repo/config-eslint/node";
export default nodeConfig;
```

### react.js

Configuration for React libraries:
- Extends base config
- React and React Hooks rules
- JSX support
- Browser globals

```javascript
import reactConfig from "@repo/config-eslint/react";
export default reactConfig;
```

## Usage in Packages

Create `eslint.config.js` in your package:

```javascript
// For Next.js apps
import nextConfig from "@repo/config-eslint/next";
export default nextConfig;

// For Node.js backends
import nodeConfig from "@repo/config-eslint/node";
export default nodeConfig;

// For shared packages
import baseConfig from "@repo/config-eslint/base";
export default baseConfig;

// For React Native / React libraries
import reactConfig from "@repo/config-eslint/react";
export default reactConfig;
```

## Customizing Rules

Extend the config with additional rules:

```javascript
import baseConfig from "@repo/config-eslint/base";

export default [
  ...baseConfig,
  {
    rules: {
      "no-console": "off", // Allow console in this package
    },
  },
];
```

## Key Rules

### TypeScript
- `@typescript-eslint/no-unused-vars` - Error (allows `_` prefix)
- `@typescript-eslint/no-explicit-any` - Warn
- `@typescript-eslint/consistent-type-imports` - Enforce `import type`

### General
- `no-console` - Warn (allows `warn`, `error`, `info` in node)
- `prefer-const` - Error

### React (next.js, react.js)
- `react/prop-types` - Off (use TypeScript)
- `react/react-in-jsx-scope` - Off (React 17+ JSX transform)
- All React Hooks rules enabled

### Node (node.js)
- `n/no-missing-import` - Off (TypeScript handles this)
- `n/no-unsupported-features/es-syntax` - Off (allow modern ES)

## Ignored Patterns

All configs ignore:
- `**/node_modules/**`
- `**/dist/**`
- `**/build/**`
- `**/.turbo/**`
- `**/coverage/**`
- `**/generated/**`

Next.js config additionally ignores:
- `**/.next/**`
- `**/out/**`
- `next-env.d.ts`

## Dependencies

```json
{
  "@eslint/js": "^9.17.0",
  "eslint": "^9.17.0",
  "eslint-config-next": "^15.1.0",
  "eslint-plugin-n": "^17.15.1",
  "eslint-plugin-react": "^7.37.2",
  "eslint-plugin-react-hooks": "^5.1.0",
  "globals": "^15.14.0",
  "typescript-eslint": "^8.18.1"
}
```

## Adding New Rules

1. Edit the appropriate config file (base.js, next.js, etc.)
2. Add rules to the rules object:

```javascript
{
  rules: {
    "new-rule": "error",
  },
}
```

## Running ESLint

```bash
# Lint all packages
pnpm lint

# Lint specific package
pnpm --filter @repo/web lint

# Fix auto-fixable issues
pnpm --filter @repo/web lint -- --fix
```

## Important Notes

- Uses ESLint 9 flat config (not legacy `.eslintrc`)
- All configs are ESM (`"type": "module"`)
- TypeScript type checking is enabled via `parserOptions.projectService`
- JavaScript files have type checking disabled via `tseslint.configs.disableTypeChecked`
