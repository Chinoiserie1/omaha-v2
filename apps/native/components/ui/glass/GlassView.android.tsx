import { View, StyleSheet } from "react-native";
import { BlurView } from "@sbaiahmed1/react-native-blur";
import { useColorScheme } from "nativewind";
import { GLASS_CONFIG } from "@/lib/glass";
import { cn } from "@/lib/utils";
import type { GlassViewProps, GlassContainerProps } from "./types";

export function GlassView({
  effect = "regular",
  tintColor: _tintColor,
  interactive: _interactive,
  colorScheme: _colorScheme,
  className,
  style,
  children,
  ...props
}: GlassViewProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

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
