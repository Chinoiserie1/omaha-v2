import { View } from "react-native";
import {
  LiquidGlassView as RawLiquidGlassView,
  LiquidGlassContainerView as RawLiquidGlassContainerView,
} from "@callstack/liquid-glass";
import { cssInterop } from "nativewind";
import { isNativeLiquidGlassSupported, GLASS_CONFIG } from "@/lib/glass";
import { cn } from "@/lib/utils";
import type { GlassViewProps, GlassContainerProps } from "./types";

// Register native liquid glass components with NativeWind so className → style
cssInterop(RawLiquidGlassView, { className: "style" });
cssInterop(RawLiquidGlassContainerView, { className: "style" });

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
  // iOS 26+: native liquid glass
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

  // No effect or iOS < 26: semi-transparent background
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

export function GlassContainer({
  spacing = 0,
  className,
  children,
  ...props
}: GlassContainerProps) {
  if (!isNativeLiquidGlassSupported) {
    return (
      <View className={cn(className)} {...props}>
        {children}
      </View>
    );
  }

  return (
    <RawLiquidGlassContainerView spacing={spacing} className={cn(className)}>
      {children}
    </RawLiquidGlassContainerView>
  );
}
