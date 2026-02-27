import type { View, ColorValue, ViewProps } from "react-native";
import type { GlassEffect } from "@/lib/glass";

/**
 * Workaround for React 19 ref type conflict between react-native's
 * bundled React types and @types/react. Omit ref from ViewProps and
 * re-add it via React.RefAttributes from @types/react.
 */
type ViewPropsCompat = Omit<ViewProps, "ref"> & React.RefAttributes<View>;

export interface GlassViewProps extends ViewPropsCompat {
  /** Visual effect variant. Default: "regular" */
  effect?: GlassEffect;

  /** Overlay tint color applied to the glass surface */
  tintColor?: ColorValue;

  /** Enable interactive touch feedback (grow + shimmer on iOS) */
  interactive?: boolean;

  /** Force a specific color scheme instead of system default */
  colorScheme?: "light" | "dark" | "system";

  /** NativeWind className */
  className?: string;
}

export interface GlassContainerProps extends ViewPropsCompat {
  /**
   * Distance (in points) at which child glass views begin to merge.
   * Only has a visible effect on iOS 26+; ignored on other platforms.
   */
  spacing?: number;

  /** NativeWind className */
  className?: string;
}
