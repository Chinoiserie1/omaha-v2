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

type Descriptor =
  BottomTabBarProps["descriptors"][keyof BottomTabBarProps["descriptors"]];

interface GlassTabBarItemProps {
  route: BottomTabBarProps["state"]["routes"][number];
  descriptor: Descriptor;
  navigation: BottomTabBarProps["navigation"];
  isFocused: boolean;
  activeTintColor: string;
  inactiveTintColor: string;
}

export function GlassTabBarItem({
  route,
  descriptor,
  navigation,
  isFocused,
  activeTintColor,
  inactiveTintColor,
}: GlassTabBarItemProps) {
  const { options } = descriptor;
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.12 : 1, {
      damping: 15,
      stiffness: 200,
    });
  }, [isFocused, scale]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const color = isFocused ? activeTintColor : inactiveTintColor;

  const label =
    typeof options.tabBarLabel === "string"
      ? options.tabBarLabel
      : typeof options.title === "string"
        ? options.title
        : route.name;

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

  const onLongPress = () => {
    navigation.emit({
      type: "tabLongPress",
      target: route.key,
    });
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={options.tabBarAccessibilityLabel}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View style={animatedIconStyle}>
        {options.tabBarIcon?.({
          focused: isFocused,
          color,
          size: TAB_BAR_ICON_SIZE,
        })}
      </Animated.View>
      <View style={{ height: 2 }} />
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
