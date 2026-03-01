import { useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
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
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>A</Text>
        </View>
      </Animated.View>

      <Animated.View style={logoStyle}>
        <Text style={styles.appName}>AUTOPILOT</Text>
      </Animated.View>

      <Animated.View style={taglineStyle}>
        <Text style={styles.tagline}>Your crypto portfolio on autopilot</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: "rgba(0,112,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(0,112,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#0070FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 8,
  },
  iconText: {
    color: "#0070FF",
    fontSize: 30,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  tagline: {
    color: "#94A3B8",
    fontSize: 14,
    fontFamily: "SpaceGrotesk_400Regular",
    marginTop: 8,
    textAlign: "center",
  },
});
