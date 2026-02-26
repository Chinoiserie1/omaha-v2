import { useCallback, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useColorScheme } from "nativewind";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { AnimatedLogo } from "../components/landing/AnimatedLogo";
import { useAuth } from "../contexts/auth-context";

export default function LandingScreen() {
  const { status } = useAuth();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const didRedirectToApp = useRef(false);

  const contentOpacity = useSharedValue(1);
  const contentTranslateY = useSharedValue(0);

  // Auto-redirect to app exactly once when already authenticated.
  // Using useEffect (not <Redirect>) to avoid re-firing if this screen
  // stays mounted during the navigation transition.
  useEffect(() => {
    console.log("[LandingScreen] useEffect fired — status:", status, "didRedirectToApp:", didRedirectToApp.current);
    if (status === "authenticated" && !didRedirectToApp.current) {
      didRedirectToApp.current = true;
      console.log("[LandingScreen] REDIRECTING to /(app)/(tabs)/(home)");
      router.replace("/(app)/(tabs)/(home)");
    }
    if (status === "unauthenticated") {
      didRedirectToApp.current = false;
    }
  }, [status, router]);

  const navigateToOnboarding = useCallback(() => {
    router.replace("/(onboarding)/connect-twitter");
  }, [router]);

  const handleGetStarted = useCallback(() => {
    contentOpacity.value = withTiming(0, {
      duration: 250,
      easing: Easing.out(Easing.ease),
    });
    contentTranslateY.value = withTiming(
      -20,
      {
        duration: 250,
        easing: Easing.out(Easing.ease),
      },
      () => {
        runOnJS(navigateToOnboarding)();
      }
    );
  }, [contentOpacity, contentTranslateY, navigateToOnboarding]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  if (status === "loading" || status === "authenticated") {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color={isDark ? "#FAFAFA" : "#18181B"} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950">
      <Animated.View
        style={contentStyle}
        className="flex-1 justify-center items-center px-6"
      >
        <AnimatedLogo />

        <View className="w-full mt-16">
          <TouchableOpacity
            className="bg-zinc-900 dark:bg-white py-4 rounded-xl"
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <Text className="text-white dark:text-zinc-950 text-center font-semibold text-lg">
              Get Started
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
