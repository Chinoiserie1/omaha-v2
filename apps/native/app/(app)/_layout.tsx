import { useEffect, useRef } from "react";
import { Redirect, Stack } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { usePostHog } from "posthog-react-native";
import { FullScreenLoader } from "../../components/shared/FullScreenLoader";
import { useTwitterSync } from "../../hooks/useTwitterSync";
import { useOnboardingStatus } from "../../hooks/queries/use-onboarding";
import { useAuth } from "../../contexts/auth-context";
import { useWithdrawalWebSocket } from "../../hooks/use-withdrawal-ws";

export default function AppLayout() {
  const { status } = useAuth();
  const { user } = usePrivy();
  const posthog = usePostHog();
  const wasIdentified = useRef(false);

  useTwitterSync();
  useWithdrawalWebSocket();

  // PostHog identify/reset based on auth state
  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      if (wasIdentified.current) {
        posthog.reset();
        wasIdentified.current = false;
      }
      return;
    }

    wasIdentified.current = true;

    const twitter = user?.linked_accounts?.find(
      (a: { type: string }) => a.type === "twitter_oauth",
    );
    const twitterUsername = twitter
      ? (twitter as { username?: string }).username
      : null;

    posthog.identify(userId, {
      ...(twitterUsername ? { linked_twitter: twitterUsername } : {}),
    });
  }, [userId, posthog, user?.linked_accounts]);

  // Only fetch onboarding status when authenticated
  const onboardingUserId = status === "authenticated" ? user?.id : undefined;
  const {
    data: onboardingData,
    isLoading: onboardingLoading,
    isError: onboardingError,
  } = useOnboardingStatus(onboardingUserId);

  // Navigation away from (app) is handled by RootNavigator in _layout.tsx.
  // This layout just shows a loader while the redirect settles.
  if (status !== "authenticated") {
    return <FullScreenLoader />;
  }

  // Check onboarding status (only when authenticated)
  if (onboardingLoading) {
    return <FullScreenLoader />;
  }

  // If onboarding query errored, optimistically render the app
  // Guard against undefined data (cache miss before query resolves)
  if (
    !onboardingError &&
    onboardingData !== undefined &&
    !onboardingData.onboardingCompleted
  ) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#09090B" },
      }}
    >
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
