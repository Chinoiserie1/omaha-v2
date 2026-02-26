import { useEffect, useRef } from "react";
import { Redirect, Stack } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { usePostHog } from "posthog-react-native";
import { useColorScheme } from "nativewind";
import { FullScreenLoader } from "../../components/shared/FullScreenLoader";
import { useTwitterSync } from "../../hooks/useTwitterSync";
import { useOnboardingStatus } from "../../hooks/queries/use-onboarding";
import { setTokenProvider } from "../../lib/api-client";

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = usePrivy();

  useTwitterSync();

  const { data, isLoading, isError } = useOnboardingStatus(user?.id);

  if (isLoading) {
    return <FullScreenLoader />;
  }

  // If the query errored, optimistically render children
  // (user already passed AuthGate, so they're authenticated)
  if (isError) {
    return <>{children}</>;
  }

  if (!data?.onboardingCompleted) {
    return <Redirect href="/(onboarding)/connect-twitter" />;
  }

  return <>{children}</>;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isReady, user, getAccessToken } = usePrivy();
  const posthog = usePostHog();
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    setTokenProvider(getAccessToken);
  }, [getAccessToken]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      if (wasAuthenticated.current) {
        posthog.reset();
      }
      return;
    }

    wasAuthenticated.current = true;

    const twitter = user?.linked_accounts?.find(
      (a: { type: string }) => a.type === "twitter_oauth",
    );

    const twitterUsername = twitter
      ? (twitter as { username?: string }).username
      : null;

    posthog.identify(userId, {
      ...(twitterUsername ? { linked_twitter: twitterUsername } : {}),
    });
  }, [userId, posthog]);

  if (!isReady) {
    return <FullScreenLoader />;
  }

  // Never had a user (deep link without auth) — redirect once
  if (!user && !wasAuthenticated.current) {
    return <Redirect href="/" />;
  }

  // User logged out — show loader while SettingsButton navigates away
  if (!user) {
    return <FullScreenLoader />;
  }

  return <>{children}</>;
}

export default function AppLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <AuthGate>
      <OnboardingGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: isDark ? "#09090B" : "#FFFFFF" },
          }}
        >
          <Stack.Screen name="(tabs)" />
        </Stack>
      </OnboardingGate>
    </AuthGate>
  );
}
