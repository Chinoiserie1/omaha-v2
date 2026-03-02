import { View, Platform, StyleSheet, Keyboard } from "react-native";
import { useEffect, useState } from "react";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { GlassView } from "@/components/ui/glass";
import { GlassTabBarItem } from "./GlassTabBarItem";
import { useTabBarVisibility } from "@/contexts/tab-bar-visibility";
import {
  TAB_BAR_HEIGHT,
  TAB_BAR_BOTTOM_MARGIN,
  TAB_BAR_HORIZONTAL_MARGIN,
  TAB_BAR_BORDER_RADIUS,
  TAB_BAR_ACTIVE_COLOR_DARK,
  TAB_BAR_INACTIVE_COLOR_DARK,
  TAB_BAR_BORDER_COLOR,
} from "./tab-bar-constants";

/**
 * Custom floating tab bar with glass morphism styling.
 *
 * Renders a pill-shaped bar that hovers above screen content, positioned
 * absolutely at the bottom of the viewport. Uses {@link GlassView} for
 * blur/translucency on iOS and Android.
 *
 * **Visibility behaviour:**
 * - Returns `null` when the keyboard is open (full unmount).
 * - Returns `null` when `isTabBarVisible` is false (controlled via context).
 * - On each remount, the `SlideInDown` entering animation replays.
 *
 * **Android overlay concern:**
 * Returning `null` causes a full unmount → remount cycle. On Android the
 * inner {@link GlassView} re-creates its `BlurView` layer each time, which
 * may cause stale blur layers to stack if the native view isn't fully
 * cleaned up between cycles. See `GlassView.android.tsx` for details.
 *
 * @param props - Standard bottom-tab-bar props supplied by React Navigation.
 */
export function FloatingGlassTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  // Read global show/hide flag from TabBarVisibilityContext
  const { isTabBarVisible } = useTabBarVisibility();

  // Track whether the software keyboard is currently visible
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Subscribe to keyboard show/hide events.
  // iOS uses "will" events for smoother animation coordination;
  // Android only fires "did" events reliably.
  useEffect(() => {
    const showListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setIsKeyboardVisible(true),
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setIsKeyboardVisible(false),
    );

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // Full unmount when hidden — triggers a fresh mount + entering animation
  // when becoming visible again.
  // NOTE: This unmount/remount cycle is a suspected cause of the Android
  // overlay bug. Each remount re-creates the BlurView layer inside GlassView.
  if (isKeyboardVisible || !isTabBarVisible) {
    return null;
  }

  return (
    // Outer wrapper: absolutely positioned at the bottom of the screen.
    // `pointerEvents="box-none"` lets touches pass through the transparent
    // area around the pill while the pill itself remains tappable.
    // NOTE: No explicit `height` — the container sizes itself from the
    // child `pill` style. During animation start frames the height may be
    // briefly indeterminate on Android.
    <Animated.View
      entering={SlideInDown.duration(400).springify().damping(18)}
      pointerEvents="box-none"
      style={[
        styles.outerContainer,
        { bottom: insets.bottom + TAB_BAR_BOTTOM_MARGIN },
      ]}
    >
      {/* Glass surface: liquid glass on iOS, solid dark pill on Android.
          Android's BlurView causes a full-screen overlay bug during Stack
          transitions (RN core bug #16093), so Android skips blur entirely. */}
      {Platform.OS === "ios" ? (
        <GlassView
          effect="regular"
          blur
          className="overflow-hidden"
          style={[styles.pill, styles.shadow]}
        >
          <View style={styles.border}>
            {state.routes.map((route, index) => {
              const descriptor = descriptors[route.key];
              if (!descriptor) return null;

              const tabBarItemStyle = descriptor.options.tabBarItemStyle;
              if (
                tabBarItemStyle &&
                "display" in tabBarItemStyle &&
                tabBarItemStyle.display === "none"
              ) {
                return null;
              }

              return (
                <GlassTabBarItem
                  key={route.key}
                  route={route}
                  descriptor={descriptor}
                  navigation={navigation}
                  isFocused={state.index === index}
                  activeTintColor={TAB_BAR_ACTIVE_COLOR_DARK}
                  inactiveTintColor={TAB_BAR_INACTIVE_COLOR_DARK}
                />
              );
            })}
          </View>
        </GlassView>
      ) : (
        <View style={[styles.pill, styles.androidPill, styles.shadow]}>
          <View style={styles.border}>
            {state.routes.map((route, index) => {
              const descriptor = descriptors[route.key];
              if (!descriptor) return null;

              const tabBarItemStyle = descriptor.options.tabBarItemStyle;
              if (
                tabBarItemStyle &&
                "display" in tabBarItemStyle &&
                tabBarItemStyle.display === "none"
              ) {
                return null;
              }

              return (
                <GlassTabBarItem
                  key={route.key}
                  route={route}
                  descriptor={descriptor}
                  navigation={navigation}
                  isFocused={state.index === index}
                  activeTintColor={TAB_BAR_ACTIVE_COLOR_DARK}
                  inactiveTintColor={TAB_BAR_INACTIVE_COLOR_DARK}
                />
              );
            })}
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /** Absolutely positioned wrapper — pinned to left/right with horizontal
   *  margins, bottom offset calculated from safe-area insets. */
  outerContainer: {
    position: "absolute",
    left: TAB_BAR_HORIZONTAL_MARGIN,
    right: TAB_BAR_HORIZONTAL_MARGIN,
  },
  /** Pill shape: fixed height, fully-rounded corners (radius = height/2). */
  pill: {
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_BORDER_RADIUS,
  },
  /** Android-only: solid dark background replacing GlassView blur. */
  androidPill: {
    backgroundColor: "#0F172A",
    overflow: "hidden",
  },
  /** Inner row: distributes tab items evenly with a thin white border. */
  border: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRadius: TAB_BAR_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: TAB_BAR_BORDER_COLOR,
  },
  /** Platform-specific shadow for depth.
   *  iOS: native shadow properties. Android: elevation (also affects z-order). */
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});
