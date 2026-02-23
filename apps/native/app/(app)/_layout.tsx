import { useEffect, useState } from "react";
import { Redirect, Stack } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { FullScreenLoader } from "../../components/shared/FullScreenLoader";
import { useTwitterSync } from "../../hooks/useTwitterSync";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4001";

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = usePrivy();
  const [checked, setChecked] = useState(false);
  const [onboarded, setOnboarded] = useState(true);

  useTwitterSync();

  useEffect(() => {
    if (!user) return;

    const checkOnboarding = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/onboarding/status?privyId=${encodeURIComponent(user.id)}`
        );

        if (response.ok) {
          const data = await response.json();
          setOnboarded(data.success && data.data?.onboardingCompleted);
        }
      } catch {
        setOnboarded(true);
      } finally {
        setChecked(true);
      }
    };

    checkOnboarding();
  }, [user]);

  if (!checked) {
    return <FullScreenLoader />;
  }

  if (!onboarded) {
    return <Redirect href="/(onboarding)/connect-twitter" />;
  }

  return <>{children}</>;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isReady, user } = usePrivy();

  if (!isReady) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <Redirect href="/" />;
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
