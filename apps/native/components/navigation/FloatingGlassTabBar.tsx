import { View, Platform, StyleSheet, Keyboard } from "react-native";
import { useEffect, useState } from "react";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { GlassView } from "@/components/ui/glass";
import { GlassTabBarItem } from "./GlassTabBarItem";
import {
  TAB_BAR_HEIGHT,
  TAB_BAR_BOTTOM_MARGIN,
  TAB_BAR_HORIZONTAL_MARGIN,
  TAB_BAR_BORDER_RADIUS,
  TAB_BAR_ACTIVE_COLOR_DARK,
  TAB_BAR_INACTIVE_COLOR_DARK,
  TAB_BAR_BORDER_COLOR,
} from "./tab-bar-constants";

export function FloatingGlassTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

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

  if (isKeyboardVisible) {
    return null;
  }

  return (
    <Animated.View
      entering={SlideInDown.duration(400).springify().damping(18)}
      pointerEvents="box-none"
      style={[
        styles.outerContainer,
        { bottom: insets.bottom + TAB_BAR_BOTTOM_MARGIN },
      ]}
    >
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

            // Skip hidden tabs (Expo Router sets display: "none" for href: null)
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: "absolute",
    left: TAB_BAR_HORIZONTAL_MARGIN,
    right: TAB_BAR_HORIZONTAL_MARGIN,
  },
  pill: {
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_BORDER_RADIUS,
  },
  border: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderRadius: TAB_BAR_BORDER_RADIUS,
    borderWidth: 1,
    borderColor: TAB_BAR_BORDER_COLOR,
  },
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
