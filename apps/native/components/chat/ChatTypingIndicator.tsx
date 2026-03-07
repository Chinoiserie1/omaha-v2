import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from "react-native-reanimated";

function Dot({ delay }: { delay: number }) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withDelay(
        delay,
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 }),
        ),
      ),
      -1,
      true,
    ),
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

export function ChatTypingIndicator() {
  return (
    <View style={styles.row}>
      <View style={styles.bubble}>
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    marginVertical: 4,
    alignItems: "flex-start",
  },
  bubble: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#71717A",
  },
});
