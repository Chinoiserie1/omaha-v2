import { Text, TouchableOpacity, ActivityIndicator, View } from "react-native";
import { useLoginWithOAuth } from "@privy-io/expo";

interface TwitterLoginButtonProps {
  onSuccess: (user: { twitterUsername?: string; twitterId?: string }) => void;
  onError?: (error: Error) => void;
}

export function TwitterLoginButton({ onSuccess, onError }: TwitterLoginButtonProps) {
  const { login, state } = useLoginWithOAuth({
    onSuccess: (user) => {
      const twitterAccount = user.linked_accounts?.find(
        (account) => account.type === "twitter_oauth"
      );

      const twitterUsername = twitterAccount && "username" in twitterAccount
        ? String(twitterAccount.username)
        : undefined;
      const twitterId = twitterAccount?.subject;

      const result: { twitterUsername?: string; twitterId?: string } = {};
      if (twitterUsername) result.twitterUsername = twitterUsername;
      if (twitterId) result.twitterId = twitterId;

      onSuccess(result);
    },
    onError: (error) => {
      onError?.(error);
    },
  });

  const isLoading = state.status === "loading";

  return (
    <View>
      <TouchableOpacity
        className={`py-4 rounded-xl ${isLoading ? "bg-zinc-400" : "bg-zinc-900"}`}
        onPress={() => login({ provider: "twitter" })}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-center font-semibold text-lg">
            Continue with Twitter
          </Text>
        )}
      </TouchableOpacity>

      {state.status === "error" && state.error && (
        <Text className="text-red-500 text-sm mt-3 text-center">
          {state.error.message}
        </Text>
      )}
    </View>
  );
}
