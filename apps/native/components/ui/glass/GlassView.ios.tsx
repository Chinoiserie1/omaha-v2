import { View } from "react-native";
import {
  LiquidGlassView,
  LiquidGlassContainerView,
} from "@callstack/liquid-glass";
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

  if (!isNativeLiquidGlassSupported || effect === "none") {
    return (
      <View
        className={cn("overflow-hidden rounded-xl", className)}
        style={[
          {
            backgroundColor: isDark
              ? GLASS_CONFIG.fallbackBgDark
              : GLASS_CONFIG.fallbackBgLight,
          },
          style,
        ]}
        {...props}
      >
        {children}
      </View>
    );
  }

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
