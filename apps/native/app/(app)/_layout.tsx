import { useEffect, useRef } from "react";
import { Redirect, Stack } from "expo-router";
import { usePrivy } from "@privy-io/expo";
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
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    setTokenProvider(getAccessToken);
  }, [getAccessToken]);

  if (user) {
    wasAuthenticated.current = true;
  }

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
  return (
    <AuthGate>
      <OnboardingGate>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </OnboardingGate>
    </AuthGate>
  );
}
