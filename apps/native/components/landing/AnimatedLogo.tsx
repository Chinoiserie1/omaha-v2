import { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from "react-native-reanimated";

export function AnimatedLogo() {
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);
  const taglineOpacity = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    logoOpacity.value = withSpring(1, { damping: 20 });
    taglineOpacity.value = withDelay(
      300,
      withSpring(1, { damping: 20 })
    );
  }, [logoScale, logoOpacity, taglineOpacity]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }));

  return (
    <View className="items-center">
      <Animated.View style={logoStyle}>
        <View className="w-20 h-20 bg-zinc-900 dark:bg-white rounded-2xl items-center justify-center mb-6">
          <Text className="text-white dark:text-zinc-950 text-3xl font-bold">A</Text>
        </View>
      </Animated.View>

      <Animated.View style={logoStyle}>
        <Text className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight">
          Autopilot
        </Text>
      </Animated.View>

      <Animated.View style={taglineStyle}>
        <Text className="text-base text-zinc-500 dark:text-zinc-400 mt-3 text-center">
          Your crypto portfolio on autopilot
        </Text>
      </Animated.View>
    </View>
  );
}
