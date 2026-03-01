import { View, ActivityIndicator } from "react-native";
import { useLoginWithOAuth, useLinkWithOAuth, usePrivy } from "@privy-io/expo";
import type { User } from "@privy-io/expo";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

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
      "profile_picture_url" in twitterAccount
        ? (twitterAccount as unknown as Record<string, string>)[
            "profile_picture_url"
          ]
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
      <Button
        variant="classic"
        onPress={handlePress}
        disabled={isLoading}
        size="lg"
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-lg font-semibold text-primary-foreground">
            Login with X
          </Text>
        )}
      </Button>

      {activeState.status === "error" && activeState.error && (
        <Text className="mt-3 text-sm text-center text-destructive">
          {activeState.error.message}
        </Text>
      )}
    </View>
  );
}
