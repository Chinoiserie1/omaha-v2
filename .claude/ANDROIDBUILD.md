# Android EAS Build — Fix Log & Recommendations

## Build Failures Fixed (chronological)

### 1. `native` is a Java reserved keyword
- **Error**: Gradle couldn't compile — `native` used as Android package name
- **Fix**: Renamed to `com.omaha.app` in `app.json` (both `ios.bundleIdentifier` and `android.package`)

### 2. SDK 52 dependency version mismatches
- **Error**: Various Expo module version conflicts
- **Fix**: `npx expo install --fix` pinned all 13 packages to SDK 52 compatible versions

### 3. Post-install building entire monorepo
- **Error**: `eas-build-post-install` tried to build everything, failing on missing native deps
- **Fix**: Scoped to only `@repo/shared` and `@repo/solana` builds

### 4. `app.config.js` not reading EAS environment variables
- **Error**: Privy config values empty during EAS cloud build
- **Fix**: `app.config.js` updated to read `process.env` (EAS injects env vars) with `.env` file fallback

### 5. Missing `expo-asset` package
- **Error**: `The required package expo-asset cannot be found` during Metro bundling
- **Fix**: Added `expo-asset@~11.0.5` as explicit dependency + added to `app.json` plugins

### 6. `expo.core.ExpoModulesPackage` not found (LATEST)
- **Error**: `PackageList.java:16: error: cannot find symbol — import expo.core.ExpoModulesPackage;`
- **Fix**: Added `node-linker=hoisted` to `.npmrc`

## Root Cause Deep Dive — Build #6

The actual class lives at `expo.modules.ExpoModulesPackage` (package `expo.modules`), but the generated `PackageList.java` was importing from `expo.core` (wrong).

### Why this happened

1. `expo-modules-autolinking` loads each dependency's `react-native.config.js` using `require-from-string`
2. Expo's config file calls `require('expo-modules-autolinking/exports')` to detect project setup
3. **With pnpm's default symlinked node_modules**, this `require()` fails — `expo-modules-autolinking` is NOT resolvable from the symlink path `apps/native/node_modules/expo`
4. The `loadConfigAsync` catch block **silently returns null** (no error logged)
5. The autolinking resolver falls back to parsing `expo/android/build.gradle` → finds `namespace "expo.core"`
6. Generates fallback import: `import expo.core.ExpoModulesPackage;` — **wrong namespace**

### The fix

Added `node-linker=hoisted` to `.npmrc`. This switches pnpm from symlinked to flat `node_modules` (like npm/yarn), which is [Expo's official recommendation for monorepos](https://docs.expo.dev/guides/monorepos/). With hoisted layout, all `require()` calls resolve correctly.

**Verified locally**: autolinking now outputs `import expo.modules.ExpoModulesPackage;` (correct).

## Files Modified (across all fixes)

| File | Change |
|------|--------|
| `apps/native/app.json` | `com.omaha.app` package name, `expo-asset` plugin |
| `apps/native/app.config.js` | Read `process.env` for EAS env vars |
| `apps/native/package.json` | SDK 52 pinned deps, `expo-asset`, scoped post-install |
| `.npmrc` | `node-linker=hoisted` |

## Next Steps to Deploy

### 1. Regenerate Android prebuild

```bash
cd apps/native && npx expo prebuild --platform android --clean
```

### 2. Trigger EAS build

```bash
cd apps/native && npx eas-cli@latest build --platform android --profile preview
```

### 3. Verify

- Build passes `:app:compileReleaseJavaWithJavac` (the step that was failing)
- Build completes and produces a downloadable APK

## Recommendations

1. **Keep `node-linker=hoisted`** — React Native / Expo tooling (Metro, autolinking, Gradle) assumes flat `node_modules`. pnpm's default symlink layout causes silent resolution failures that are extremely hard to debug.

2. **Watch for phantom dependency issues** — With hoisted layout, packages can accidentally import undeclared dependencies. Run `pnpm lint` and `pnpm typecheck` after the switch to catch any issues.

3. **Consider adding `expo-modules-autolinking` as explicit dep** — As a belt-and-suspenders measure, you could add it to `apps/native/package.json`. This is optional with hoisted layout but provides extra safety.
