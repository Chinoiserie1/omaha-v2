import { View } from "react-native";
import { GLASS_CONFIG } from "@/lib/glass";
import { cn } from "@/lib/utils";
import type { GlassViewProps, GlassContainerProps } from "./types";

/**
 * Web / fallback GlassView — semi-transparent background, no blur.
 */
export function GlassView({
  effect = "regular",
  blur: _blur,
  tintColor: _tintColor,
  interactive: _interactive,
  colorScheme: _colorScheme,
  className,
  style,
  children,
  ...props
}: GlassViewProps) {
  const bgColor = effect === "none" ? undefined : GLASS_CONFIG.fallbackBgDark;

  return (
    <View
      className={cn("overflow-hidden rounded-xl", className)}
      style={[bgColor ? { backgroundColor: bgColor } : undefined, style]}
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
