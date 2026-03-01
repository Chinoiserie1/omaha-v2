import { useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

export function AnimatedLogo() {
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    logoOpacity.value = withSpring(1, { damping: 20 });
  }, [logoScale, logoOpacity]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  return (
    <Animated.View style={[styles.row, logoStyle]}>
      <View style={styles.iconContainer}>
        <Text style={styles.iconText}>A</Text>
      </View>
      <Text style={styles.appName}>Omaha</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: "rgba(59,130,246,0.2)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.4)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 8,
  },
  iconText: {
    color: "#3B82F6",
    fontSize: 30,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  appName: {
    color: "#F8FAFC",
    fontSize: 24,
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: 4,
    textTransform: "uppercase",
  },
});
