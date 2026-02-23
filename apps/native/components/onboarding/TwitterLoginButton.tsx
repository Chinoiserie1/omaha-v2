import { Text, TouchableOpacity, ActivityIndicator, View } from "react-native";
import { useLoginWithOAuth, useLinkWithOAuth, usePrivy } from "@privy-io/expo";
import type { User } from "@privy-io/expo";

interface TwitterData {
  privyId: string;
  twitterUsername?: string;
  twitterId?: string;
  profileImageUrl?: string;
  name?: string;
}

interface TwitterLoginButtonProps {
  onSuccess: (user: TwitterData) => void;
  onError?: (error: Error) => void;
}

function extractTwitterData(user: User): TwitterData {
  const twitterAccount = user.linked_accounts?.find(
    (account) => account.type === "twitter_oauth",
  );

  console.log("[TwitterLoginButton] User:", JSON.stringify(user, null, 2));

  console.log(
    "[TwitterLoginButton] Twitter Account:",
    JSON.stringify(twitterAccount, null, 2),
  );

  const result: TwitterData = { privyId: user.id };

  if (twitterAccount) {
    const username =
      "username" in twitterAccount ? twitterAccount.username : undefined;
    const name = "name" in twitterAccount ? twitterAccount.name : undefined;
    const profilePic =
      "profilePictureUrl" in twitterAccount
        ? twitterAccount.profilePictureUrl
        : undefined;

    if (username) result.twitterUsername = String(username);
    if (name) result.name = String(name);
    if (profilePic) result.profileImageUrl = String(profilePic);
    if (twitterAccount.subject) result.twitterId = twitterAccount.subject;
  }

  return result;
}

export function TwitterLoginButton({
  onSuccess,
  onError,
}: TwitterLoginButtonProps) {
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
          <Text className="text-lg font-semibold text-center text-white dark:text-zinc-950">
            Continue with Twitter
          </Text>
        )}
      </TouchableOpacity>

      {activeState.status === "error" && activeState.error && (
        <Text className="mt-3 text-sm text-center text-red-500 dark:text-red-400">
          {activeState.error.message}
        </Text>
      )}
    </View>
  );
}
