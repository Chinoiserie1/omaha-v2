import { Text, TouchableOpacity, ActivityIndicator, View } from "react-native";
import { useLoginWithOAuth, useLinkWithOAuth, usePrivy } from "@privy-io/expo";
import type { User } from "@privy-io/expo";

interface TwitterLoginButtonProps {
  onSuccess: (user: { twitterUsername?: string; twitterId?: string }) => void;
  onError?: (error: Error) => void;
}

function extractTwitterData(user: User): { twitterUsername?: string; twitterId?: string } {
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
  return result;
}

export function TwitterLoginButton({ onSuccess, onError }: TwitterLoginButtonProps) {
  const { user } = usePrivy();
  const isAuthenticated = !!user;

  const loginOAuth = useLoginWithOAuth({
    onSuccess: (user) => onSuccess(extractTwitterData(user)),
    onError: (error) => onError?.(error),
  });

  const linkOAuth = useLinkWithOAuth({
    onSuccess: (user) => onSuccess(extractTwitterData(user)),
    onError: (error) => onError?.(error),
  });

  const activeState = isAuthenticated ? linkOAuth.state : loginOAuth.state;
  const isLoading = activeState.status === "loading";

  const handlePress = () => {
    if (isAuthenticated) {
      linkOAuth.link({ provider: "twitter" });
    } else {
      loginOAuth.login({ provider: "twitter" });
    }
  };

  return (
    <View>
      <TouchableOpacity
        className={`py-4 rounded-xl ${isLoading ? "bg-zinc-400 dark:bg-zinc-600" : "bg-zinc-900 dark:bg-white"}`}
        onPress={handlePress}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white dark:text-zinc-950 text-center font-semibold text-lg">
            Continue with Twitter
          </Text>
        )}
      </TouchableOpacity>

      {activeState.status === "error" && activeState.error && (
        <Text className="text-red-500 dark:text-red-400 text-sm mt-3 text-center">
          {activeState.error.message}
        </Text>
      )}
    </View>
  );
}
