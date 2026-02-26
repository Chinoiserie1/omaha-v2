import PostHog from "posthog-react-native";
import Constants from "expo-constants";

const POSTHOG_API_KEY =
  Constants.expoConfig?.extra?.posthogApiKey ?? process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "";

if (!POSTHOG_API_KEY) {
  console.error("[posthog] EXPO_PUBLIC_POSTHOG_API_KEY is not set — analytics will be disabled");
}

export const posthogClient = new PostHog(POSTHOG_API_KEY || "phc_disabled", {
  host: "https://eu.i.posthog.com",
  disabled: !POSTHOG_API_KEY,
  enableSessionReplay: true,
  captureAppLifecycleEvents: true,
  personProfiles: "identified_only",
  sessionReplayConfig: {
    maskAllTextInputs: true,
    maskAllImages: true,
  },
});

export const posthogAutocapture = {
  captureTouches: true,
  captureScreens: false, // Manual tracking via PostHogScreenTracker inside navigator
};
