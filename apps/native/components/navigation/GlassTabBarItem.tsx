import { Pressable, View, Text } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useEffect } from "react";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { TAB_BAR_ICON_SIZE, TAB_BAR_LABEL_SIZE } from "./tab-bar-constants";

/** Single tab descriptor extracted from React Navigation's descriptors map. */
type Descriptor =
  BottomTabBarProps["descriptors"][keyof BottomTabBarProps["descriptors"]];

/** Props for an individual tab button inside the floating glass tab bar. */
interface GlassTabBarItemProps {
  /** Route object for this tab (contains `name`, `key`, `params`). */
  route: BottomTabBarProps["state"]["routes"][number];
  /** Descriptor holding this tab's `options` (icon, label, accessibility). */
  descriptor: Descriptor;
  /** Navigation object used to emit events and navigate between tabs. */
  navigation: BottomTabBarProps["navigation"];
  /** Whether this tab is the currently active/selected tab. */
  isFocused: boolean;
  /** Tint colour applied to the icon and label when the tab is active. */
  activeTintColor: string;
  /** Tint colour applied to the icon and label when the tab is inactive. */
  inactiveTintColor: string;
}

/**
 * A single tab button rendered inside {@link FloatingGlassTabBar}.
 *
 * **Visual behaviour:**
 * - The icon scales up (1 → 1.12) with a spring animation when focused.
 * - A small circular dot appears below the label for the active tab.
 * - Light haptic feedback fires on press (only when navigating to a new tab).
 *
 * **Accessibility:**
 * - `accessibilityRole="tab"` and `accessibilityState.selected` are set.
 * - Custom `accessibilityLabel` from tab options is forwarded.
 *
 * @param props - See {@link GlassTabBarItemProps}.
 */
export function GlassTabBarItem({
  route,
  descriptor,
  navigation,
  isFocused,
  activeTintColor,
  inactiveTintColor,
}: GlassTabBarItemProps) {
  const { options } = descriptor;

  // Shared value driving the icon scale animation (runs on the UI thread).
  const scale = useSharedValue(1);

  // Animate icon scale whenever focus state changes.
  // Focused: scale up to 1.12x. Unfocused: return to 1x.
  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.12 : 1, {
      damping: 15,
      stiffness: 200,
    });
  }, [isFocused, scale]);

  // Animated style applied to the icon wrapper — transforms on UI thread.
  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Resolve colour based on focus state.
  const color = isFocused ? activeTintColor : inactiveTintColor;

  // Resolve the display label: tabBarLabel → title → route.name (fallback).
  const label =
    typeof options.tabBarLabel === "string"
      ? options.tabBarLabel
      : typeof options.title === "string"
        ? options.title
        : route.name;

  /**
   * Handle a tab press.
   * Emits a `tabPress` event so listeners (e.g., scroll-to-top) can react.
   * Only navigates and triggers haptics when pressing a *different* tab and
   * the event was not prevented by a listener.
   */
  const onPress = () => {
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate(route.name, route.params);
    }
  };

  /**
   * Handle a long press on the tab.
   * Emits a `tabLongPress` event for any listeners that need it.
   */
  const onLongPress = () => {
    navigation.emit({
      type: "tabLongPress",
      target: route.key,
    });
  };

  return (
    // Pressable wrapper: fills available flex space so all tabs are equal width.
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={options.tabBarAccessibilityLabel}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      {/* Animated icon — scales on focus via spring animation. */}
      <Animated.View style={animatedIconStyle}>
        {options.tabBarIcon?.({
          focused: isFocused,
          color,
          size: TAB_BAR_ICON_SIZE,
        })}
      </Animated.View>

      {/* 2pt spacer between icon and label. */}
      <View style={{ height: 2 }} />

      {/* Tab label text — semibold, single line, coloured by focus state. */}
      <Text
        style={{
          fontSize: TAB_BAR_LABEL_SIZE,
          fontWeight: "600",
          color,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>

      {/* Active-tab indicator: small filled circle below the label. */}
      {isFocused && (
        <View
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: activeTintColor,
            marginTop: 3,
          }}
        />
      )}
    </Pressable>
  );
}
