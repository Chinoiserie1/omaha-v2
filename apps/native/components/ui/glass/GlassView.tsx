import { View } from "react-native";
import { GLASS_CONFIG } from "@/lib/glass";
import { cn } from "@/lib/utils";
import type { GlassViewProps, GlassContainerProps } from "./types";

/**
 * Web / fallback GlassView — semi-transparent dark background, no blur.
 *
 * Used on web and as the default export for platforms that don't have a
 * platform-specific file (`.ios.tsx` or `.android.tsx`).
 * The `blur`, `tintColor`, `interactive`, and `colorScheme` props are
 * accepted for API compatibility but have no visual effect on this platform.
 *
 * @param props - See {@link GlassViewProps}.
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
  // Only apply the translucent background when a glass effect is requested.
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

/**
 * Web / fallback GlassContainer — plain wrapper with no glass merging.
 *
 * `spacing` is accepted for API compatibility but ignored on web.
 *
 * @param props - See {@link GlassContainerProps}.
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
