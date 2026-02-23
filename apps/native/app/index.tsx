import { useEffect, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useColorScheme } from "nativewind";
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
import { useOnboardingStatus } from "../hooks/queries/use-onboarding";
import { setTokenProvider } from "../lib/api-client";

export default function LandingScreen() {
  const { isReady, user, getAccessToken, logout } = usePrivy();
  const router = useRouter();
  const hasRedirected = useRef(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const contentOpacity = useSharedValue(1);
  const contentTranslateY = useSharedValue(0);

  const { data: onboardingData } = useOnboardingStatus(user?.id);

  // Wire token provider early for any authenticated calls
  useEffect(() => {
    if (user) {
      setTokenProvider(getAccessToken);
    }
  }, [user, getAccessToken]);

  // Validate session and redirect (only once)
  useEffect(() => {
    if (!isReady || hasRedirected.current || !user) return;

    const validateSession = async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          await logout();
        }
      } catch {
        await logout();
      }
    };
    validateSession();
  }, [isReady, user, getAccessToken, logout]);

  // Redirect based on onboarding status
  useEffect(() => {
    if (!user || hasRedirected.current || onboardingData === undefined) return;

    hasRedirected.current = true;
    if (onboardingData.onboardingCompleted) {
      router.replace("/(app)/(tabs)/(home)" as const);
    } else {
      router.replace("/(onboarding)/connect-twitter");
    }
  }, [user, onboardingData, router]);

  const navigateToOnboarding = useCallback(() => {
    hasRedirected.current = true;
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

  // Show loading while Privy initializes
  if (!isReady) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color={isDark ? "#FAFAFA" : "#18181B"} />
      </SafeAreaView>
    );
  }

  // Show loading while checking auth state for logged-in users
  if (user) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color={isDark ? "#FAFAFA" : "#18181B"} />
        <Text className="mt-4 text-zinc-500 dark:text-zinc-400 text-sm">Loading...</Text>
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
