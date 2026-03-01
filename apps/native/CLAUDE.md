# apps/native - CLAUDE.md

## Overview

This is the **Expo SDK 54** React Native application using Expo Router for navigation. It provides the mobile experience for the Autopilot platform.

## Technology Stack

- **Framework**: Expo SDK 54
- **React Native**: 0.81.x
- **React**: 19.1.x
- **Navigation**: Expo Router 6.x
- **TypeScript**: 5.7.x (strict mode)
- **Validation**: Zod via `@repo/shared`

## Directory Structure

```
apps/native/
├── app/                    # Expo Router (file-based routing) - ROUTES ONLY
│   ├── _layout.tsx         # Root layout with Stack navigator
│   └── index.tsx           # Home screen
├── components/             # All components (organized by feature)
│   ├── home/               # Components for home screen
│   └── shared/             # Shared components across screens
├── styles/                 # Shared styles
├── assets/                 # Static assets (icons, images)
├── app.json                # Expo configuration
├── babel.config.js         # Babel configuration
├── metro.config.js         # Metro bundler config (monorepo support)
├── tsconfig.json           # TypeScript config
├── eslint.config.js        # ESLint config (uses @repo/config-eslint/react)
└── package.json
```

## Liquid Glass UI Components

The app uses a "liquid glass" design system via platform-specific components:

- **iOS 26+**: Native `UIGlassEffect` via `@callstack/liquid-glass`
- **Android**: Blur fallback via `@sbaiahmed1/react-native-blur`
- **Web/other**: Semi-transparent background fallback

### Glass Components (`components/ui/glass/`)

```typescript
import { GlassView, GlassContainer } from "@/components/ui/glass";

// Basic glass surface
<GlassView effect="regular" interactive>
  <Text>Content</Text>
</GlassView>

// Merge adjacent glass views on iOS
<GlassContainer spacing={8}>
  <GlassView>...</GlassView>
  <GlassView>...</GlassView>
</GlassContainer>
```

Platform files: `GlassView.ios.tsx`, `GlassView.android.tsx`, `GlassView.tsx` (fallback)

### Card & Button Variants

- `<Card>` defaults to glass. Use `<Card variant="classic">` for the old solid style.
- `<Button>` defaults to glass. Use `<Button variant="classic">` for solid CTAs.
- All authentication, financial, and primary CTA buttons use `variant="classic"`.

### Config: `lib/glass.ts`

- `isNativeLiquidGlassSupported` — boolean, true on iOS 26+
- `GLASS_CONFIG` — blur amounts, fallback colors, blur types

## Component Organization (Parallel Structure)

**Expo Router limitation**: All files inside `app/` are treated as routes. Components CANNOT be colocated inside the `app/` directory.

**Solution**: Use a parallel folder structure in `components/` that mirrors the route structure.

### Rules

1. **Screen-specific components**: Place in `components/{screen-name}/` folder
2. **Shared components**: Place in `components/shared/` folder
3. **NEVER place components inside `app/`** - they will become routes

### Examples

```
app/                              # ROUTES ONLY - no components here!
├── _layout.tsx
├── index.tsx                     # Home screen → uses components/home/*
├── users/
│   ├── _layout.tsx
│   ├── index.tsx                 # Users list → uses components/users/*
│   └── [id].tsx                  # User detail → uses components/users/detail/*
└── settings.tsx                  # Settings → uses components/settings/*

components/                       # ALL components live here
├── home/                         # Components for app/index.tsx
│   ├── UserForm.tsx
│   └── ValidationResult.tsx
├── users/                        # Components for app/users/*
│   ├── UserCard.tsx
│   ├── UserList.tsx
│   └── detail/                   # Components for app/users/[id].tsx
│       └── UserProfile.tsx
├── settings/                     # Components for app/settings.tsx
│   └── SettingsForm.tsx
└── shared/                       # Used across multiple screens
    ├── Button.tsx
    ├── Modal.tsx
    └── LoadingSpinner.tsx

styles/                           # Shared StyleSheet definitions
├── colors.ts
├── typography.ts
└── spacing.ts
```

### Import Pattern

```typescript
// In app/index.tsx
import { UserForm } from "../components/home/UserForm";
import { ValidationResult } from "../components/home/ValidationResult";

// In app/users/index.tsx
import { UserCard } from "../../components/users/UserCard";
import { Button } from "../../components/shared/Button";
```

### When to Move a Component

- **Stay in feature folder**: Component is only used by one screen
- **Move to shared/**: Component is needed by 2+ screens

See: [Expo Router Core Concepts](https://docs.expo.dev/router/basics/core-concepts/) - Non-navigation components must live outside `app/` directory.

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
<Link href="/about">Go to About</Link>;

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
