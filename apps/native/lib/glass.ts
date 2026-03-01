import { Platform } from "react-native";
import { isLiquidGlassSupported } from "@callstack/liquid-glass";

/**
 * True when the native iOS liquid glass effect is available (iOS 26+).
 * Always false on Android and web.
 */
export const isNativeLiquidGlassSupported: boolean =
  Platform.OS === "ios" && isLiquidGlassSupported;

export type GlassEffect = "regular" | "clear" | "none";

export const GLASS_CONFIG = {
  /** Default blur amount for the Android BlurView fallback */
  androidBlurAmount: 20,

  /** Default blur type for dark mode on Android */
  androidBlurTypeDark: "dark" as const,

  /** Fallback background for web / reduce-transparency */
  fallbackBgDark: "rgba(30, 41, 59, 0.45)",
} as const;
