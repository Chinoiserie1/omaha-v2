# Share & Deep Linking

Share vault links that open the correct screen in the native app.

## Overview

Users can share vault links from the vault detail screen via the native share sheet. When a recipient taps the link, it opens the vault directly in the Omaha app (iOS Universal Links / Android App Links). If the app isn't installed, the link opens a web fallback page with an "Open in App" button.

## Architecture

```
User taps "Share" in vault menu
        │
        ▼
Native Share Sheet (iOS/Android)
        │
        ▼
Shared URL: https://omaha.sh/vault/{id}
        │
        ▼
Recipient taps link
        │
        ├── App installed?
        │     YES → iOS Universal Link / Android App Link
        │           → Expo Router resolves to /(app)/(tabs)/(home)/vault/{id}
        │           → VaultDetail screen opens
        │
        └── App NOT installed?
              → Browser opens https://omaha.sh/vault/{id}
              → Next.js fallback page
              → "Open in App" button (autopilot:// deep link)
              → "Learn more" link to omaha.sh
```

## URL Scheme

| Type | Format | When Used |
|------|--------|-----------|
| Universal Link | `https://omaha.sh/vault/{id}` | Shared externally (clickable in all apps) |
| Custom Scheme | `autopilot:///vault/{id}` | Internal redirects, web fallback button |

Expo Router strips group segments (`(app)`, `(tabs)`, `(home)`) automatically, so `https://omaha.sh/vault/ABC123` resolves to the file route at `app/(app)/(tabs)/(home,profile)/vault/[id]/index.tsx`.

## Implementation

### Native App (Share Action)

**File**: `apps/native/app/(app)/(tabs)/(home,profile)/vault/[id]/index.tsx`

The vault header context menu includes a "Share" action that calls React Native's `Share.share()` API:

```typescript
import { Share } from "react-native";

const handleShare = async () => {
  const url = `https://omaha.sh/vault/${id}`;
  await Share.share({
    message: `Check out ${vault.name} on Omaha: ${url}`,
    url, // iOS shows this separately in the share sheet
  });
};
```

Menu item uses SF Symbol `square.and.arrow.up` (standard iOS share icon).

### Deep Link Configuration

**File**: `apps/native/app.json`

```json
{
  "scheme": "autopilot",
  "ios": {
    "bundleIdentifier": "com.omaha.app",
    "associatedDomains": ["applinks:omaha.sh"]
  },
  "android": {
    "package": "com.omaha.app",
    "intentFilters": [
      {
        "action": "VIEW",
        "autoVerify": true,
        "data": [{ "scheme": "https", "host": "omaha.sh", "pathPrefix": "/vault" }],
        "category": ["BROWSABLE", "DEFAULT"]
      }
    ]
  }
}
```

### Domain Verification Files

Hosted on the web app (`apps/web/public/.well-known/`):

**iOS** — `apple-app-site-association` (no file extension):
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.omaha.app",
        "paths": ["/vault/*"]
      }
    ]
  }
}
```

**Android** — `assetlinks.json`:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.omaha.app",
      "sha256_cert_fingerprints": ["SHA256_FROM_EAS_BUILD"]
    }
  }
]
```

**Content-Type header** — `apps/web/next.config.ts` serves the AASA file with `application/json` content type (required by Apple).

### Web Fallback Page

**File**: `apps/web/app/vault/[id]/page.tsx`

A server-rendered Next.js page that:
1. Auto-redirects to `autopilot:///vault/{id}` after 500ms
2. Shows an "Open in App" button as manual fallback
3. Links to `omaha.sh` for users without the app
4. Includes OpenGraph metadata for link previews in messaging apps

## Production Setup Checklist

### 1. Apple Team ID

Replace `TEAMID` in `apps/web/public/.well-known/apple-app-site-association` with your Apple Developer Team ID.

Find it at: [developer.apple.com/account](https://developer.apple.com/account) → Membership Details.

### 2. Android SHA256 Fingerprint

Replace the placeholder in `apps/web/public/.well-known/assetlinks.json` with your signing key fingerprint:

```bash
eas credentials -p android
```

### 3. Deploy Web App

The `.well-known` files must be accessible at:
- `https://omaha.sh/.well-known/apple-app-site-association`
- `https://omaha.sh/.well-known/assetlinks.json`

Deploy the web app to Vercel and ensure the domain `omaha.sh` points to it.

### 4. New Native Build

Changes to `associatedDomains` and `intentFilters` require a new EAS build:

```bash
eas build --platform ios
eas build --platform android
```

These settings are embedded in the native binary and cannot be tested in Expo Go.

### 5. Verify

- **iOS**: Apple fetches the AASA file automatically when the app is installed. Test by texting yourself a `https://omaha.sh/vault/...` link.
- **Android**: Use `adb shell am start -a android.intent.action.VIEW -d "https://omaha.sh/vault/TEST"` to verify intent resolution.

## Source Files

| File | Purpose |
|------|---------|
| `apps/native/app/(app)/(tabs)/(home,profile)/vault/[id]/index.tsx` | Share menu action |
| `apps/native/app.json` | Deep link scheme + associated domains + intent filters |
| `apps/web/public/.well-known/apple-app-site-association` | iOS Universal Links verification |
| `apps/web/public/.well-known/assetlinks.json` | Android App Links verification |
| `apps/web/app/vault/[id]/page.tsx` | Web fallback / redirect page |
| `apps/web/next.config.ts` | AASA content-type header |

## Constraints

- Universal links require the app to be installed via a signed build (not Expo Go)
- The web domain must serve the `.well-known` files over HTTPS
- Apple caches the AASA file — changes may take time to propagate (reinstall the app to force refresh)
- Android `autoVerify` requires the `assetlinks.json` to be accessible at install time
