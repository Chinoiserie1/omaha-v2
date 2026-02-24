import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
  withSequence,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface InvestHeaderButtonProps {
  onPress: () => void;
}

export function InvestHeaderButton({ onPress }: InvestHeaderButtonProps) {
  const breath = useSharedValue(0);
  const pressed = useSharedValue(1);

  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [breath]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.25, 0.7]),
    transform: [
      { scale: interpolate(breath.value, [0, 1], [1, 1.25]) },
    ],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pressed.value * interpolate(breath.value, [0, 1], [1, 1.02]) },
    ],
  }));

  const handlePressIn = () => {
    pressed.value = withTiming(0.95, { duration: 100 });
  };

  const handlePressOut = () => {
    pressed.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.back(1.5)) });
  };

  return (
    <View className="items-center justify-center">
      {/* Glow layer */}
      <Animated.View
        style={[
          {
            position: "absolute",
            width: "100%",
            height: "100%",
            borderRadius: 12,
            backgroundColor: "#34d399",
          },
          glowStyle,
        ]}
      />
      {/* Button */}
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#059669",
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 12,
          },
          buttonStyle,
        ]}
      >
        <Ionicons name="flash" size={14} color="#ffffff" />
        <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 14 }}>
          Invest
        </Text>
      </AnimatedPressable>
    </View>
  );
}
