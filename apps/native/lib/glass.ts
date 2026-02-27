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
  androidBlurAmount: 50,

  /** Default blur type for light mode on Android */
  androidBlurTypeLight: "systemThinMaterialLight" as const,

  /** Default blur type for dark mode on Android */
  androidBlurTypeDark: "systemThinMaterialDark" as const,

  /** Fallback background for web / reduce-transparency */
  fallbackBgLight: "rgba(255, 255, 255, 0.7)",
  fallbackBgDark: "rgba(9, 9, 11, 0.7)",
} as const;
