# packages/config-typescript - CLAUDE.md

## Overview

This package contains **shared TypeScript configurations** for all apps and packages in the monorepo. It provides consistent compiler settings across the codebase.

## Directory Structure

```
packages/config-typescript/
├── base.json               # Base strict settings
├── nextjs.json             # Next.js app settings
├── node.json               # Node.js backend settings
├── react-library.json      # React library settings
└── package.json
```

## Available Configs

### base.json

Base configuration with strict settings:

```json
{
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

### node.json

For Node.js packages (backend, database):

```json
{
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

### nextjs.json

For Next.js applications:

```json
{
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
    "plugins": [{ "name": "next" }],
    "declaration": false,
    "declarationMap": false
  }
}
```

### react-library.json

For React component libraries:

```json
{
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

## Usage

In your package's `tsconfig.json`:

```json
{
  "extends": "@repo/config-typescript/node.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Config Selection Guide

| Package Type | Config | Key Features |
|--------------|--------|--------------|
| Node.js backend | `node.json` | NodeNext resolution, ESM |
| Next.js app | `nextjs.json` | Bundler resolution, JSX |
| React library | `react-library.json` | JSX, DOM types |
| Utility package | `base.json` | Strict, minimal |

## Strict Mode Features

All configs inherit strict settings from `base.json`:

- `strict: true` - Enable all strict checks
- `noUncheckedIndexedAccess` - Array/object access returns `T | undefined`
- `exactOptionalPropertyTypes` - Distinguish `undefined` from optional
- `noImplicitOverride` - Require `override` keyword
- `noPropertyAccessFromIndexSignature` - Use bracket notation for index signatures
- `noImplicitReturns` - All code paths must return
- `noFallthroughCasesInSwitch` - Require break in switch cases
- `verbatimModuleSyntax` - Preserve import/export syntax

## Module Resolution

### Node.js Packages

```json
{
  "module": "NodeNext",
  "moduleResolution": "NodeNext"
}
```

Requires `.js` extension in imports:
```typescript
import { foo } from "./bar.js";
```

### Next.js / React

```json
{
  "module": "ESNext",
  "moduleResolution": "Bundler"
}
```

Bundler handles resolution, no extensions needed:
```typescript
import { foo } from "./bar";
```

## Package Exports

```json
{
  "exports": {
    "./base.json": "./base.json",
    "./node.json": "./node.json",
    "./nextjs.json": "./nextjs.json",
    "./react-library.json": "./react-library.json"
  }
}
```

## Customizing

Override settings in your package's `tsconfig.json`:

```json
{
  "extends": "@repo/config-typescript/node.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "build",
    "target": "ES2023"  // Override target
  }
}
```

## Important Notes

- All configs use ES2022 as the default target
- TypeScript 5.7+ is required
- Use `node.json` for anything that runs in Node.js directly
- Use `nextjs.json` for Next.js apps (handles JSX transformation)
- Use `react-library.json` for shared React components
