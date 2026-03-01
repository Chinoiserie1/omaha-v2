import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
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
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breath]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.2, 0.5]),
    transform: [
      { scale: interpolate(breath.value, [0, 1], [1, 1.12]) },
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
            top: -4,
            bottom: -4,
            left: -4,
            right: -4,
            borderRadius: 14,
            backgroundColor: "#14B8A6",
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
            gap: 4,
            backgroundColor: "#14B8A6",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 10,
          },
          buttonStyle,
        ]}
      >
        <Ionicons name="flash" size={12} color="#F8FAFC" />
        <Text style={{ color: "#F8FAFC", fontWeight: "600", fontSize: 12 }}>
          Invest
        </Text>
      </AnimatedPressable>
    </View>
  );
}
