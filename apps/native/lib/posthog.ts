import Constants from "expo-constants";

const POSTHOG_API_KEY =
  Constants.expoConfig?.extra?.posthogApiKey ?? process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "";

if (!POSTHOG_API_KEY) {
  console.error("[posthog] EXPO_PUBLIC_POSTHOG_API_KEY is not set — analytics will be disabled");
}

const POSTHOG_HOST = "https://eu.i.posthog.com";

export const posthogConfig = {
  apiKey: POSTHOG_API_KEY,
  options: {
    host: POSTHOG_HOST,
    enableSessionReplay: true,
    captureAppLifecycleEvents: true,
    personProfiles: "identified_only" as const,
    sessionReplayConfig: {
      maskAllTextInputs: true,
      maskAllImages: true,
    },
  },
  autocapture: {
    captureTouches: true,
    captureScreens: false, // Manual tracking via PostHogScreenTracker inside navigator
  },
  debug: false,
} as const;
