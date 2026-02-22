import { useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { AnimatedLogo } from "../components/landing/AnimatedLogo";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4001";

export default function LandingScreen() {
  const { isReady, user } = usePrivy();
  const router = useRouter();

  const contentOpacity = useSharedValue(1);
  const contentTranslateY = useSharedValue(0);

  const checkOnboardingStatus = useCallback(async () => {
    if (!user) return;

    try {
      const privyId = user.id;
      const response = await fetch(
        `${API_URL}/api/users?privyId=${privyId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.data?.onboardingCompleted) {
          router.replace("/(app)");
          return;
        }
      }
    } catch {
      // If backend unavailable, continue to onboarding
    }

    // Authenticated but not onboarded
    router.replace("/(onboarding)/connect-twitter");
  }, [user, router]);

  // Check auth state and redirect
  useEffect(() => {
    if (!isReady) return;

    if (user) {
      checkOnboardingStatus();
    }
  }, [isReady, user, checkOnboardingStatus]);

  const navigateToOnboarding = useCallback(() => {
    router.push("/(onboarding)/connect-twitter");
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

  // Show loading while Privy initializes
  if (!isReady) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#18181B" />
      </SafeAreaView>
    );
  }

  // Show loading while checking auth state for logged-in users
  if (user) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#18181B" />
        <Text className="mt-4 text-zinc-500 text-sm">Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Animated.View
        style={contentStyle}
        className="flex-1 justify-center items-center px-6"
      >
        <AnimatedLogo />

        <View className="w-full mt-16">
          <TouchableOpacity
            className="bg-zinc-900 py-4 rounded-xl"
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <Text className="text-white text-center font-semibold text-lg">
              Get Started
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
