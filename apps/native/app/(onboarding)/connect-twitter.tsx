import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { usePrivy, useCreateGuestAccount } from "@privy-io/expo";
import { SafeAreaView } from "react-native-safe-area-context";
import { TwitterLoginButton } from "../../components/onboarding/TwitterLoginButton";
import { useCompleteOnboarding } from "../../hooks/queries/use-onboarding";
import { setTokenProvider } from "../../lib/api-client";
import { ApiError } from "../../lib/api-client";

interface OnboardingData {
  privyId: string;
  username?: string;
  twitterId?: string;
  twitterUsername?: string;
  profileImageUrl?: string;
  name?: string;
}

function buildOnboardingData(
  privyId: string,
  twitter?: {
    username?: string | undefined;
    id?: string | undefined;
    profileImageUrl?: string | undefined;
    name?: string | undefined;
  },
): OnboardingData {
  const data: OnboardingData = { privyId };
  if (twitter?.username) {
    data.username = twitter.username;
    data.twitterUsername = twitter.username;
  }
  if (twitter?.id) data.twitterId = twitter.id;
  if (twitter?.profileImageUrl) data.profileImageUrl = twitter.profileImageUrl;
  if (twitter?.name) data.name = twitter.name;
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

  const mutation = useCompleteOnboarding();

  // Wire token provider for authenticated calls
  useEffect(() => {
    if (user) {
      setTokenProvider(getAccessToken);
    }
  }, [user, getAccessToken]);

  useEffect(() => {
    hasNavigated.current = false;
  }, []);

  const completeOnboarding = (data: OnboardingData) => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    setError(null);
    lastDataRef.current = data;

    mutation.mutate(data, {
      onSuccess: () => {
        router.replace("/(app)/(tabs)/(home)" as const);
      },
      onError: (err) => {
        hasNavigated.current = false;
        setIsCreatingGuest(false);
        if (err instanceof ApiError) {
          const body = err.body as Record<string, string> | null;
          setError(body?.error ?? "Something went wrong. Please try again.");
        } else {
          setError("Network error. Please try again.");
        }
      },
    });
  };

  const handleRetry = () => {
    if (lastDataRef.current) {
      completeOnboarding(lastDataRef.current);
    }
  };

  // If already authenticated, auto-complete onboarding (guest, Twitter, etc.)
  useEffect(() => {
    if (!user || hasNavigated.current) return;

    const twitterAccount = user.linked_accounts?.find(
      (account) => account.type === "twitter_oauth",
    );

    if (twitterAccount) {
      const rawUsername =
        "username" in twitterAccount ? twitterAccount.username : undefined;
      const twitterId = twitterAccount.subject;
      const rawProfileImageUrl =
        "profile_picture_url" in twitterAccount
          ? (twitterAccount as unknown as Record<string, string>)["profile_picture_url"]
          : undefined;
      const rawName =
        "name" in twitterAccount ? twitterAccount.name : undefined;
      completeOnboarding(
        buildOnboardingData(user.id, {
          username: rawUsername ? String(rawUsername) : undefined,
          id: twitterId,
          profileImageUrl: rawProfileImageUrl
            ? String(rawProfileImageUrl)
            : undefined,
          name: rawName ? String(rawName) : undefined,
        }),
      );
    } else {
      // Guest or other auth method — complete without Twitter
      completeOnboarding({ privyId: user.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleTwitterSuccess = (twitterData: {
    privyId: string;
    twitterUsername?: string;
    twitterId?: string;
    profileImageUrl?: string;
    name?: string;
  }) => {
    if (hasNavigated.current) return;
    completeOnboarding(
      buildOnboardingData(twitterData.privyId, {
        username: twitterData.twitterUsername,
        id: twitterData.twitterId,
        profileImageUrl: twitterData.profileImageUrl,
        name: twitterData.name,
      }),
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
          <View className="justify-center items-center mb-6 w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800">
            <Text className="text-3xl text-zinc-900 dark:text-white">𝕏</Text>
          </View>
          <Text className="mb-3 text-3xl font-bold text-zinc-900 dark:text-white">
            Connect your Twitter
          </Text>
          <Text className="text-base leading-6 text-center text-zinc-500 dark:text-zinc-400">
            Link your Twitter account to set up your profile automatically.
          </Text>
        </View>

        <TwitterLoginButton onSuccess={handleTwitterSuccess} />

        {error && (
          <View className="p-4 mt-4 bg-red-50 rounded-xl dark:bg-red-950">
            <Text className="mb-3 text-sm text-center text-red-600 dark:text-red-400">
              {error}
            </Text>
            <TouchableOpacity
              className="self-center px-4 py-2 rounded-lg bg-zinc-900 dark:bg-white"
              onPress={handleRetry}
              activeOpacity={0.8}
            >
              <Text className="text-sm font-semibold text-white dark:text-zinc-950">
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          className="py-3 mt-6"
          onPress={handleGuestLogin}
          disabled={isCreatingGuest}
          activeOpacity={0.6}
        >
          {isCreatingGuest ? (
            <ActivityIndicator color="#71717A" />
          ) : (
            <Text className="text-base text-center text-zinc-500 dark:text-zinc-400">
              Continue as Guest
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
