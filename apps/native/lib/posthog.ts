import PostHog from "posthog-react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";

const POSTHOG_API_KEY =
  Constants.expoConfig?.extra?.posthogApiKey ?? process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "";

const isSimulator = !Device.isDevice;
const isDisabled = !POSTHOG_API_KEY || isSimulator;

if (!POSTHOG_API_KEY) {
  console.error("[posthog] EXPO_PUBLIC_POSTHOG_API_KEY is not set — analytics will be disabled");
}

if (isSimulator) {
  console.warn("[posthog] Running on simulator — analytics disabled");
}

export const posthogClient = new PostHog(POSTHOG_API_KEY || "phc_disabled", {
  host: "https://eu.i.posthog.com",
  disabled: isDisabled,
  enableSessionReplay: true,
  captureAppLifecycleEvents: true,
  personProfiles: "identified_only",
  sessionReplayConfig: {
    maskAllTextInputs: true,
    maskAllImages: true,
    captureLog: true,
    captureNetworkTelemetry: true,
  },
});

export const posthogAutocapture = {
  captureTouches: true,
  captureScreens: false, // Manual tracking via PostHogScreenTracker inside navigator
};
