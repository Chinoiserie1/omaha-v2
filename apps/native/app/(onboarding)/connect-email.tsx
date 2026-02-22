import { useCallback } from "react";
import { View, Text, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { usePrivy } from "@privy-io/expo";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmailLinkForm } from "../../components/onboarding/EmailLinkForm";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4001";

export default function ConnectEmailScreen() {
  const router = useRouter();
  const { user } = usePrivy();
  const params = useLocalSearchParams<{
    fromTwitter: string;
    twitterUsername?: string;
    twitterId?: string;
    username?: string;
  }>();

  const fromTwitter = params.fromTwitter === "true";

  const handleEmailSuccess = useCallback(
    async (email: string) => {
      const privyId = user?.id;
      if (!privyId) return;

      try {
        await fetch(`${API_URL}/api/onboarding/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            privyId,
            email,
            username: params.username ?? params.twitterUsername ?? "",
            twitterId: params.twitterId ?? undefined,
            twitterUsername: params.twitterUsername ?? undefined,
          }),
        });
      } catch {
        // Continue even if backend call fails — user is authenticated
      }

      router.replace("/(app)");
    },
    [user, params, router]
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-6">
          <View className="items-center mb-10">
            <View className="w-16 h-16 bg-zinc-100 rounded-2xl items-center justify-center mb-6">
              <Text className="text-3xl">✉️</Text>
            </View>
            <Text className="text-3xl font-bold text-zinc-900 mb-3">
              {fromTwitter ? "Link your email" : "Sign in with email"}
            </Text>
            <Text className="text-base text-zinc-500 text-center leading-6">
              {fromTwitter
                ? "Add your email for account recovery and notifications."
                : "Enter your email to create your account."}
            </Text>
          </View>

          <EmailLinkForm
            fromTwitter={fromTwitter}
            onSuccess={handleEmailSuccess}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
