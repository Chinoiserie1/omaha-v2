import { Platform } from "react-native";

const DEV_FALLBACK =
  Platform.OS === "android" ? "http://10.0.2.2:4001" : "http://localhost:4001";

const PROD_FALLBACK = "http://localhost:4001";

function resolveDevUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!envUrl) return DEV_FALLBACK;

  // 10.0.2.2 is Android-emulator-only; swap to localhost on iOS
  if (Platform.OS === "ios" && envUrl.includes("10.0.2.2")) {
    return envUrl.replace("10.0.2.2", "localhost");
  }

  return envUrl;
}

export const BASE_URL = __DEV__
  ? resolveDevUrl()
  : (process.env.EXPO_PUBLIC_API_URL_PROD ??
    process.env.EXPO_PUBLIC_API_URL ??
    PROD_FALLBACK);

export const WS_BASE = BASE_URL.replace(/^http/, "ws");
