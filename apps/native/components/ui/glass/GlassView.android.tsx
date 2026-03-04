import { View, StyleSheet } from "react-native";
import type { ViewStyle } from "react-native";
import { BlurView } from "@sbaiahmed1/react-native-blur";
import { GLASS_CONFIG } from "@/lib/glass";
import { cn } from "@/lib/utils";
import type { GlassViewProps, GlassContainerProps } from "./types";

/**
 * Android implementation of the glass morphism surface.
 *
 * Renders one of three variants depending on the `effect` and `blur` props:
 *
 * 1. **`effect="none"`** — Plain `View`, no background.
 *
 * 2. **`blur=true`** — Double-wrapper clipping pattern:
 *    - Outer View: has `overflow: hidden` + `borderRadius` (NativeWind).
 *    - Inner clip View: absolute-fill with matching `borderRadius`,
 *      `overflow: hidden`, and `renderToHardwareTextureAndroid` to force
 *      GPU-level clipping (works around RN core bug #16093).
 *    - BlurView: uses `flex: 1` inside the clip wrapper (no absolute
 *      positioning on the blur itself).
 *    - Children: render on top via normal z-order.
 *
 * 3. **Default** — Semi-transparent dark background fallback.
 *
 * @param props - See {@link GlassViewProps}.
 */
export function GlassView({
  effect = "regular",
  blur = false,
  tintColor: _tintColor,
  interactive: _interactive,
  colorScheme: _colorScheme,
  className,
  style,
  children,
  ...props
}: GlassViewProps) {
  // ── Path 1: No glass effect — transparent container only ──
  if (effect === "none") {
    return (
      <View
        className={cn("overflow-hidden rounded-xl", className)}
        style={style}
        {...props}
      >
        {children}
      </View>
    );
  }

  // ── Path 2: Native blur enabled ──
  // Double-wrapper pattern to reliably clip BlurView on Android.
  //
  // Why: Android's overflow:hidden does NOT clip native child views
  // (like BlurView) to borderRadius (RN core bug #16093). The previous
  // approach of BlurView + StyleSheet.absoluteFill caused the blur to
  // escape bounds and cover the entire screen during Stack transitions.
  //
  // Fix: An intermediate View wraps the BlurView with:
  //   - Matching borderRadius + overflow:hidden
  //   - renderToHardwareTextureAndroid → promotes to GPU layer so
  //     clipping happens at composition time
  //   - BlurView uses flex:1 (not absolute positioning)
  if (blur) {
    const flat = style ? (StyleSheet.flatten(style) as ViewStyle) : undefined;
    const radius = flat?.borderRadius as number | undefined;

    return (
      <View
        className={cn("overflow-hidden rounded-xl", className)}
        style={style}
        {...props}
      >
        {/* Clip wrapper — forces Android to clip the blur at the GPU layer. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              overflow: "hidden",
              borderColor: "transparent",
            },
          ]}
          renderToHardwareTextureAndroid
        >
          <BlurView
            blurType={GLASS_CONFIG.androidBlurTypeDark}
            blurAmount={GLASS_CONFIG.androidBlurAmount}
            reducedTransparencyFallbackColor={GLASS_CONFIG.fallbackBgDark}
            style={{ flex: 1 }}
          />
        </View>
        {children}
      </View>
    );
  }

  // ── Path 3: Fallback — semi-transparent dark background, no blur ──
  return (
    <View
      className={cn("overflow-hidden rounded-xl", className)}
      style={[{ backgroundColor: GLASS_CONFIG.fallbackBgDark }, style]}
      {...props}
    >
      {children}
    </View>
  );
}

/**
 * Android GlassContainer — passthrough wrapper (no glass merging on Android).
 *
 * On iOS 26+ the native `GlassContainer` merges adjacent glass views when
 * they're within `spacing` points of each other. Android has no equivalent,
 * so this simply renders a plain `View`.
 *
 * @param props - See {@link GlassContainerProps}. `spacing` is accepted
 *   for API compatibility but ignored on Android.
 */
export function GlassContainer({
  spacing: _spacing,
  className,
  children,
  ...props
}: GlassContainerProps) {
  return (
    <View className={cn(className)} {...props}>
      {children}
    </View>
  );
}
