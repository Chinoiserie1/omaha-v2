import { View } from "react-native";
import {
  LiquidGlassView as RawLiquidGlassView,
  LiquidGlassContainerView as RawLiquidGlassContainerView,
} from "@callstack/liquid-glass";
import { cssInterop } from "nativewind";
import { isNativeLiquidGlassSupported, GLASS_CONFIG } from "@/lib/glass";
import { cn } from "@/lib/utils";
import type { GlassViewProps, GlassContainerProps } from "./types";

// Bridge NativeWind's className prop → native `style` for liquid glass views.
// Without this, Tailwind classes wouldn't apply to the native components.
cssInterop(RawLiquidGlassView, { className: "style" });
cssInterop(RawLiquidGlassContainerView, { className: "style" });

/**
 * iOS implementation of the glass morphism surface.
 *
 * Renders one of two variants:
 *
 * 1. **iOS 26+ with `effect !== "none"`** — Native `UIGlassEffect` via
 *    `@callstack/liquid-glass`. Provides real-time blur, refraction, and
 *    optional interactive feedback (grow + shimmer on touch).
 *
 * 2. **iOS < 26 or `effect="none"`** — Falls back to a semi-transparent
 *    dark background (no blur). Same cheap fallback used on Android/web.
 *
 * The `blur` prop is accepted for cross-platform API compatibility but
 * ignored on iOS — the native liquid glass handles blur natively.
 *
 * @param props - See {@link GlassViewProps}.
 */
export function GlassView({
  effect = "regular",
  blur: _blur,
  tintColor,
  interactive = false,
  colorScheme: _colorScheme,
  className,
  style,
  children,
  ...props
}: GlassViewProps) {
  // ── Path 1: Native liquid glass (iOS 26+) ──
  if (isNativeLiquidGlassSupported && effect !== "none") {
    const glassProps = {
      effect,
      interactive,
      style,
      className: cn("overflow-hidden rounded-xl", className),
      ...(tintColor != null ? { tintColor } : {}),
    };

    return <RawLiquidGlassView {...glassProps}>{children}</RawLiquidGlassView>;
  }

  // ── Path 2: Fallback — semi-transparent background, no blur ──
  return (
    <View
      className={cn("overflow-hidden rounded-xl", className)}
      style={[
        effect !== "none" ? { backgroundColor: GLASS_CONFIG.fallbackBgDark } : undefined,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

/**
 * iOS GlassContainer — merges adjacent glass views on iOS 26+.
 *
 * When `spacing` is set, child {@link GlassView} elements within that
 * distance visually merge into a single glass surface (native UIKit API).
 * On iOS < 26, renders a plain `View` (no merging available).
 *
 * @param props - See {@link GlassContainerProps}.
 */
export function GlassContainer({
  spacing = 0,
  className,
  children,
  ...props
}: GlassContainerProps) {
  // No native container support below iOS 26 — plain View wrapper.
  if (!isNativeLiquidGlassSupported) {
    return (
      <View className={cn(className)} {...props}>
        {children}
      </View>
    );
  }

  // Native liquid glass container with configurable merge distance.
  return (
    <RawLiquidGlassContainerView spacing={spacing} className={cn(className)}>
      {children}
    </RawLiquidGlassContainerView>
  );
}
