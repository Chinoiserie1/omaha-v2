import { useEffect, useState } from "react";
import { Stack, Redirect } from "expo-router";
import { AuthBoundary, usePrivy } from "@privy-io/expo";
import { FullScreenLoader } from "../../components/shared/FullScreenLoader";
import { ErrorScreen } from "../../components/shared/ErrorScreen";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4001";

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = usePrivy();
  const [checked, setChecked] = useState(false);
  const [onboarded, setOnboarded] = useState(true);

  useEffect(() => {
    if (!user) return;

    const checkOnboarding = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/users?privyId=${user.id}`
        );

        if (response.ok) {
          const data = await response.json();
          setOnboarded(data.data?.onboardingCompleted ?? false);
        }
      } catch {
        // If backend is unavailable, allow through
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

export default function AppLayout() {
  return (
    <AuthBoundary
      loading={<FullScreenLoader />}
      error={(error) => <ErrorScreen error={error} />}
      unauthenticated={<Redirect href="/" />}
    >
      <OnboardingGate>
        <Stack>
          <Stack.Screen name="index" options={{ title: "Home", headerShown: false }} />
        </Stack>
      </OnboardingGate>
    </AuthBoundary>
  );
}
