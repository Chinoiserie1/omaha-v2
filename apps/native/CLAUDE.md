# apps/native - CLAUDE.md

## Overview

This is the **Expo SDK 52** React Native application using Expo Router for navigation. It provides the mobile experience for the Autopilot platform.

## Technology Stack

- **Framework**: Expo SDK 52
- **React Native**: 0.76.x
- **React**: 18.3.x
- **Navigation**: Expo Router 4.x
- **TypeScript**: 5.7.x (strict mode)
- **Validation**: Zod via `@repo/shared`

## Directory Structure

```
apps/native/
├── app/                    # Expo Router (file-based routing)
│   ├── _layout.tsx         # Root layout with Stack navigator
│   └── index.tsx           # Home screen
├── assets/                 # Static assets (icons, images)
├── app.json                # Expo configuration
├── babel.config.js         # Babel configuration
├── metro.config.js         # Metro bundler config (monorepo support)
├── tsconfig.json           # TypeScript config
├── eslint.config.js        # ESLint config (uses @repo/config-eslint/react)
└── package.json
```

## Development

```bash
# Start Expo development server
pnpm dev              # From root
pnpm --filter @repo/native dev  # Specific to this app

# Start on specific platform
pnpm --filter @repo/native ios
pnpm --filter @repo/native android
pnpm --filter @repo/native web

# Type check
pnpm --filter @repo/native typecheck

# Lint
pnpm --filter @repo/native lint
```

## Configuration

### Expo Config (app.json)

Key settings:
- `scheme: "autopilot"` - Deep linking scheme
- `newArchEnabled: true` - React Native New Architecture
- `experiments.typedRoutes: true` - Type-safe routing

### Metro Config

Automatically configured for monorepo support (Expo SDK 52+):
```javascript
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
module.exports = config;
```

### TypeScript

Extends `expo/tsconfig.base` with strict settings.

### ESLint

Uses `@repo/config-eslint/react` which includes:
- React and React Hooks rules
- TypeScript ESLint

## Using Shared Packages

Import from `@repo/shared` for types and validation:

```typescript
import { createUserSchema, type CreateUserDto } from "@repo/shared";

const validation = createUserSchema.safeParse(data);
if (!validation.success) {
  // Handle validation error
}
```

## Expo Router

### File-Based Routing

- `app/index.tsx` → `/` (home screen)
- `app/about.tsx` → `/about`
- `app/[id].tsx` → `/:id` (dynamic route)
- `app/(tabs)/` → Tab navigator group

### Layout Files

- `_layout.tsx` - Defines navigation structure
- Use `Stack`, `Tabs`, or custom navigators

### Navigation

```typescript
import { Link, router } from "expo-router";

// Declarative
<Link href="/about">Go to About</Link>

// Imperative
router.push("/about");
router.replace("/home");
router.back();
```

## Styling

Use React Native StyleSheet:

```typescript
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
});
```

## API Calls

```typescript
const response = await fetch("http://localhost:3001/api/users");
const data = await response.json();
```

Note: Use your machine's IP instead of `localhost` when testing on physical devices.

## Platform-Specific Code

```typescript
import { Platform } from "react-native";

const styles = StyleSheet.create({
  shadow: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
    },
    android: {
      elevation: 4,
    },
  }),
});
```

## Assets

Place in `assets/` directory:
- `icon.png` - App icon (1024x1024)
- `splash-icon.png` - Splash screen
- `adaptive-icon.png` - Android adaptive icon
- `favicon.png` - Web favicon

## Building for Production

Use EAS Build:
```bash
npx eas build --platform ios
npx eas build --platform android
```

## Environment Variables

Use `expo-constants` or environment config:
```typescript
import Constants from "expo-constants";
const apiUrl = Constants.expoConfig?.extra?.apiUrl;
```

## Testing

(Add testing setup when implemented)

## Important Notes

- Monorepo support is automatic with Expo SDK 52+
- No manual Metro configuration needed for workspace packages
- Expo Router provides type-safe navigation
- New Architecture is enabled by default
- Use SafeAreaView for proper safe area handling
