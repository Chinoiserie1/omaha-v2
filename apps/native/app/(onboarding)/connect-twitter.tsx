import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { usePrivy, useCreateGuestAccount } from "@privy-io/expo";
import { SafeAreaView } from "react-native-safe-area-context";
import { TwitterLoginButton } from "../../components/onboarding/TwitterLoginButton";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4001";

interface OnboardingData {
  privyId: string;
  username?: string;
  twitterId?: string;
  twitterUsername?: string;
}

function buildOnboardingData(
  privyId: string,
  twitter?: { username?: string | undefined; id?: string | undefined }
): OnboardingData {
  const data: OnboardingData = { privyId };
  if (twitter?.username) {
    data.username = twitter.username;
    data.twitterUsername = twitter.username;
  }
  if (twitter?.id) data.twitterId = twitter.id;
  return data;
}

export default function ConnectTwitterScreen() {
  const router = useRouter();
  const { user, getAccessToken } = usePrivy();
  const guest = useCreateGuestAccount();
  const hasNavigated = useRef(false);
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastDataRef = useRef<OnboardingData | null>(null);

  useEffect(() => {
    hasNavigated.current = false;
  }, []);

  const completeOnboarding = useCallback(
    async (data: OnboardingData) => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;
      setError(null);
      lastDataRef.current = data;

      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(`${API_URL}/api/onboarding/complete`, {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const message = errorData?.error ?? "Something went wrong. Please try again.";
          hasNavigated.current = false;
          setError(message);
          setIsCreatingGuest(false);
          return;
        }
      } catch {
        // Network error — navigate anyway (graceful degradation)
      }

      router.replace("/(app)/(tabs)" as const);
    },
    [router, getAccessToken]
  );

  const handleRetry = useCallback(() => {
    if (lastDataRef.current) {
      completeOnboarding(lastDataRef.current);
    }
  }, [completeOnboarding]);

  // If already authenticated, auto-complete onboarding (guest, Twitter, etc.)
  useEffect(() => {
    if (!user || hasNavigated.current) return;

    const twitterAccount = user.linked_accounts?.find(
      (account) => account.type === "twitter_oauth"
    );

    if (twitterAccount) {
      const twitterUsername =
        "username" in twitterAccount ? String(twitterAccount.username) : undefined;
      const twitterId = twitterAccount.subject;
      completeOnboarding(buildOnboardingData(user.id, { username: twitterUsername, id: twitterId }));
    } else {
      // Guest or other auth method — complete without Twitter
      completeOnboarding({ privyId: user.id });
    }
  }, [user, completeOnboarding]);

  const handleTwitterSuccess = (twitterData: {
    twitterUsername?: string;
    twitterId?: string;
  }) => {
    if (hasNavigated.current) return;
    completeOnboarding(
      buildOnboardingData(user?.id ?? "", {
        username: twitterData.twitterUsername,
        id: twitterData.twitterId,
      })
    );
  };

  const handleGuestLogin = async () => {
    setIsCreatingGuest(true);
    try {
      const result = await guest.create();
      const privyId = result?.id;
      if (privyId) {
        completeOnboarding({ privyId });
      }
    } catch {
      setIsCreatingGuest(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950">
      <View className="flex-1 justify-center px-6">
        <View className="items-center mb-12">
          <View className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl items-center justify-center mb-6">
            <Text className="text-3xl text-zinc-900 dark:text-white">𝕏</Text>
          </View>
          <Text className="text-3xl font-bold text-zinc-900 dark:text-white mb-3">
            Connect your Twitter
          </Text>
          <Text className="text-base text-zinc-500 dark:text-zinc-400 text-center leading-6">
            Link your Twitter account to set up your profile automatically.
          </Text>
        </View>

        <TwitterLoginButton onSuccess={handleTwitterSuccess} />

        {error && (
          <View className="mt-4 p-4 bg-red-50 dark:bg-red-950 rounded-xl">
            <Text className="text-red-600 dark:text-red-400 text-sm text-center mb-3">{error}</Text>
            <TouchableOpacity
              className="py-2 px-4 bg-zinc-900 dark:bg-white rounded-lg self-center"
              onPress={handleRetry}
              activeOpacity={0.8}
            >
              <Text className="text-white dark:text-zinc-950 text-sm font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          className="mt-6 py-3"
          onPress={handleGuestLogin}
          disabled={isCreatingGuest}
          activeOpacity={0.6}
        >
          {isCreatingGuest ? (
            <ActivityIndicator color="#71717A" />
          ) : (
            <Text className="text-zinc-500 dark:text-zinc-400 text-center text-base">
              Continue as Guest
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
