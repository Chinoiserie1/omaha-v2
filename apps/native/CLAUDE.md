# apps/native - CLAUDE.md

## Overview

This is the **Expo SDK 54** React Native application using Expo Router for navigation. It provides the mobile experience for the Omaha platform with features like vault discovery, investment management, portfolio tracking, and multi-step withdrawal flows.

## Technology Stack

- **Framework**: Expo SDK 54
- **React Native**: 0.81.x
- **React**: 19.1.x
- **Navigation**: Expo Router (file-based routing)
- **TypeScript**: 5.7.x (strict mode)
- **Validation**: Zod via `@repo/shared`
- **Styling**: Tailwind CSS v4 + Glass UI (iOS 26+)

## Directory Structure

```
apps/native/
├── app/                    # Expo Router (file-based routing) - ROUTES ONLY
│   ├── _layout.tsx         # Root layout + navigation setup
│   ├── (tabs)/             # Tab navigator group
│   │   ├── (home)/         # Vault discovery & list
│   │   ├── (profile)/      # Portfolio dashboard & settings
│   │   └── (settings)/     # User preferences
│   ├── landing/            # Landing/onboarding
│   └── auth/               # Authentication flows
├── components/             # All components (organized by feature)
│   ├── home/               # Home/vault discovery components
│   ├── profile/            # Portfolio, theses, withdrawals
│   ├── vault/              # Vault detail & investment flows
│   ├── navigation/         # Navigation UI (tab bar, etc.)
│   ├── auth/               # Authentication UI
│   ├── ui/                 # Reusable UI components & Glass views
│   └── shared/             # Shared logic & utilities
├── hooks/                  # Custom React hooks (queries, effects)
├── lib/                    # Utilities (glass config, query keys, etc.)
├── contexts/               # React Context providers
├── assets/                 # Static assets (icons, images, fonts)
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

## Screen Structure (March 2026)

### Home Tab - Vault Discovery

- **Route**: `app/(tabs)/(home)/index.tsx`
- **Components**: `components/home/VaultList.tsx`, `VaultRow.tsx`, `VaultCard.tsx`
- **Features**: Search by vault name/Quant username, infinite scroll pagination, real performance metrics

### Profile Tab - Portfolio Dashboard (March 2026)

- **Route**: `app/(tabs)/(profile)/index.tsx`
- **New Design**: Premium portfolio dashboard with net worth, asset grid, performance chart
- **Components**:
  - `PortfolioHeader.tsx` - User wallet address & net worth
  - `AssetCardsGrid.tsx` - Holdings display (SPL tokens + vault shares + SOL with Fund button)
  - `SolAssetCard.tsx` - SOL balance card with "Fund SOL" button for USDC→SOL swaps
  - `PortfolioPerformanceChart.tsx` - Connected to backend portfolio chart endpoint
  - `ActiveThesisList.tsx` - Real vaults from user's wallet (March 2026)
  - `ActiveThesisRow.tsx` - Navigate to vault detail pages
- **Features**: Real wallet balances, active theses from on-chain vaults, performance history, fund SOL flow

### Fund SOL Modal Screen (March 2026)

> Full flow documentation: [`docs/flow/FUND-SOL.md`](../../docs/flow/FUND-SOL.md)

- **Route**: `app/(app)/(tabs)/(profile)/fund-sol.tsx`
- **Components**:
  - `FundSolSheet.tsx` - Main modal container ($/amount, confirm, success states)
  - `AmountPicker.tsx` - Quick picker buttons ($1, $2, $5, $10)
  - `FundSolSuccess.tsx` - Success confirmation screen
- **Features**: Quick USDC→SOL swaps, platform fee display (2%), transaction builder + signing flow

### Vault Detail Screen

- **Route**: `app/(app)/(tabs)/(home)/vault/[id].tsx`
- **Components**: `components/vault/VaultDetail.tsx`, `VaultHeader.tsx`, `VaultThesis.tsx`, `VaultAllocationCard.tsx`
- **Features**: Investment thesis, allocations, performance chart, subscribe/redeem buttons

### Withdrawal Flow (Multi-Step - March 2026)

- **Route**: `app/(tabs)/(profile)/withdraw.tsx`
- **Components**: `components/profile/withdraw/`
  - `WithdrawFlow.tsx` - State machine controller
  - `TokenPicker.tsx` - Select token to withdraw
  - `TransferForm.tsx` - Input amount
  - `TransferReview.tsx` - Confirm details
  - `TransferSuccess.tsx` - Completion screen
  - `TokenAvatar.tsx` - Token display
- **Features**: Token selection, SPL token transfer, multi-step confirmation, batch window waiting

## Component Organization

**Expo Router limitation**: All files inside `app/` are treated as routes. Components CANNOT be colocated inside the `app/` directory.

**Solution**: Use a parallel folder structure in `components/` that mirrors the route structure.

### Rules

1. **Screen-specific components**: Place in `components/{feature-name}/` folder
2. **Shared components**: Place in `components/shared/` or `components/ui/` folder
3. **NEVER place components inside `app/`** - they will become routes

### Feature-Based Organization

```
components/
├── home/                    # Vault discovery & listing
│   ├── VaultList.tsx
│   ├── VaultRow.tsx
│   └── vault-mock-data.ts   # Mock data for development
├── profile/                 # Portfolio dashboard & settings
│   ├── PortfolioHeader.tsx
│   ├── AssetCard.tsx
│   ├── AssetCardsGrid.tsx
│   ├── SolAssetCard.tsx     # SOL card with Fund SOL button
│   ├── PortfolioPerformanceChart.tsx
│   ├── ActiveThesisList.tsx
│   ├── ActiveThesisRow.tsx
│   ├── withdraw/            # Withdrawal multi-step flow
│   │   ├── WithdrawFlow.tsx
│   │   ├── TokenPicker.tsx
│   │   ├── TransferForm.tsx
│   │   ├── TransferReview.tsx
│   │   ├── TransferSuccess.tsx
│   │   ├── TokenAvatar.tsx
│   │   └── index.ts
│   ├── fund-sol/            # Fund SOL (USDC → SOL swap)
│   │   ├── FundSolSheet.tsx
│   │   ├── AmountPicker.tsx
│   │   ├── FundSolSuccess.tsx
│   │   └── index.ts
│   └── WithdrawForm.tsx
├── vault/                   # Vault detail page
│   ├── VaultDetail.tsx
│   ├── VaultHeader.tsx
│   ├── VaultThesis.tsx
│   ├── VaultAllocationCard.tsx
│   ├── VaultPerformanceChart.tsx
│   └── VaultChanges.tsx
├── ui/                      # Reusable UI components
│   ├── glass/               # Glass UI (platform-specific)
│   │   ├── GlassView.ios.tsx
│   │   ├── GlassView.android.tsx
│   │   ├── GlassView.tsx
│   │   └── GlassContainer.tsx
│   ├── Button.tsx           # Primary button (glass variant)
│   ├── Card.tsx             # Card container (glass variant)
│   ├── Modal.tsx
│   └── ...other components
├── navigation/              # Navigation UI
│   ├── FloatingGlassTabBar.tsx
│   └── BottomTabNavigator.tsx
└── shared/                  # Shared logic & utilities
    ├── LoadingSpinner.tsx
    └── ErrorBoundary.tsx
```

### Import Pattern

```typescript
// In app/(tabs)/(home)/index.tsx
import { VaultList } from "../../../components/home/VaultList";
import { Button } from "../../../components/ui/Button";

// In components/profile/PortfolioPerformanceChart.tsx (uses hooks)
import { usePortfolioChart } from "../../hooks/queries/use-portfolio-chart";
```

### Context & Hooks

```typescript
// lib/query-keys.ts - React Query key factory
export const vaultKeys = {
  all: ["vaults"] as const,
  lists: () => [...vaultKeys.all, "list"] as const,
  list: (filters: VaultFilters) => [...vaultKeys.lists(), filters] as const,
  details: () => [...vaultKeys.all, "detail"] as const,
  detail: (id: string) => [...vaultKeys.details(), id] as const,
};

// hooks/queries/use-vaults.ts - React Query hook
export function useVaults(filters?: VaultFilters) {
  return useQuery({
    queryKey: vaultKeys.list(filters),
    queryFn: () => fetchVaults(filters),
  });
}

// contexts/tab-bar-visibility.tsx - Context for controlling tab bar
export const TabBarVisibilityContext = createContext<{
  visible: boolean;
  setVisible: (visible: boolean) => void;
}>({ visible: true, setVisible: () => {} });
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
