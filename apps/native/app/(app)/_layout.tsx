import { useEffect, useState, useRef } from "react";
import { Stack, useRouter } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { FullScreenLoader } from "../../components/shared/FullScreenLoader";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4001";

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = usePrivy();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [onboarded, setOnboarded] = useState(true);
  const hasRedirected = useRef(false);

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

  useEffect(() => {
    if (checked && !onboarded && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace("/(onboarding)/connect-twitter");
    }
  }, [checked, onboarded, router]);

  if (!checked || (!onboarded && !hasRedirected.current)) {
    return <FullScreenLoader />;
  }

  return <>{children}</>;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isReady, user } = usePrivy();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!isReady) return;

    if (!user && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace("/");
    }
  }, [isReady, user, router]);

  useEffect(() => {
    if (user) {
      hasRedirected.current = false;
    }
  }, [user]);

  if (!isReady || (!user && !hasRedirected.current)) {
    return <FullScreenLoader />;
  }

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
          <Stack.Screen name="index" options={{ title: "Home", headerShown: false }} />
        </Stack>
      </OnboardingGate>
    </AuthGate>
  );
}
