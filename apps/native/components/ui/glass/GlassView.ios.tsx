import { View, StyleSheet } from "react-native";
import {
  LiquidGlassView,
  LiquidGlassContainerView,
} from "@callstack/liquid-glass";
import { BlurView } from "@sbaiahmed1/react-native-blur";
import { useColorScheme } from "nativewind";
import { isNativeLiquidGlassSupported, GLASS_CONFIG } from "@/lib/glass";
import { cn } from "@/lib/utils";
import type { GlassViewProps, GlassContainerProps } from "./types";

export function GlassView({
  effect = "regular",
  tintColor,
  interactive = false,
  colorScheme: _colorScheme,
  className,
  style,
  children,
  ...props
}: GlassViewProps) {
  const { colorScheme: systemScheme } = useColorScheme();
  const isDark = systemScheme === "dark";

  // iOS 26+: native liquid glass
  if (isNativeLiquidGlassSupported && effect !== "none") {
    const glassProps = {
      effect,
      interactive,
      style,
      className: cn("overflow-hidden rounded-xl", className),
      ...(tintColor != null ? { tintColor } : {}),
    };

    return (
      <LiquidGlassView {...glassProps}>
        {children}
      </LiquidGlassView>
    );
  }

  // No effect requested: plain view
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

  // iOS < 26: blur fallback (same strategy as Android)
  const blurType = isDark
    ? GLASS_CONFIG.androidBlurTypeDark
    : GLASS_CONFIG.androidBlurTypeLight;

  return (
    <View
      className={cn("overflow-hidden rounded-xl", className)}
      style={style}
      {...props}
    >
      <BlurView
        blurType={blurType}
        blurAmount={GLASS_CONFIG.androidBlurAmount}
        reducedTransparencyFallbackColor={
          isDark ? GLASS_CONFIG.fallbackBgDark : GLASS_CONFIG.fallbackBgLight
        }
        style={StyleSheet.absoluteFill}
      />
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
    <LiquidGlassContainerView spacing={spacing} className={cn(className)}>
      {children}
    </LiquidGlassContainerView>
  );
}
