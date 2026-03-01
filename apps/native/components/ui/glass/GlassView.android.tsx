import { View, StyleSheet } from "react-native";
import { BlurView } from "@sbaiahmed1/react-native-blur";
import { GLASS_CONFIG } from "@/lib/glass";
import { cn } from "@/lib/utils";
import type { GlassViewProps, GlassContainerProps } from "./types";

/**
 * Android GlassView — plain semi-transparent background by default.
 * Pass `blur` to opt into a native BlurView (for floating elements like tab bars).
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

  if (blur) {
    return (
      <View
        className={cn("overflow-hidden rounded-xl", className)}
        style={style}
        {...props}
      >
        <BlurView
          blurType={GLASS_CONFIG.androidBlurTypeDark}
          blurAmount={GLASS_CONFIG.androidBlurAmount}
          reducedTransparencyFallbackColor={GLASS_CONFIG.fallbackBgDark}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    );
  }

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
