import { useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { usePrivy, useEmbeddedSolanaWallet } from "@privy-io/expo";
import { useAuth } from "../../contexts/auth-context";

export function WalletInfo() {
  const { user } = usePrivy();
  const { signOut } = useAuth();

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // AuthContext handles cleanup; error is non-actionable here
    }
  }, [signOut]);
  const { wallets } = useEmbeddedSolanaWallet();

  const solanaWallet = wallets?.[0];
  const email = user?.linked_accounts?.find(
    (account) => account.type === "email"
  );
  const twitter = user?.linked_accounts?.find(
    (account) => account.type === "twitter_oauth"
  );

  if (!user) {
    return (
      <View className="items-center justify-center py-8">
        <ActivityIndicator size="large" color="#F8FAFC" />
      </View>
    );
  }

  return (
    <View className="w-full">
      {twitter && "username" in twitter && (
        <View className="bg-card rounded-lg p-4 mb-4 border border-border">
          <Text className="text-sm text-muted-foreground mb-1">Username</Text>
          <Text className="text-base font-medium text-foreground">
            @{String(twitter.username)}
          </Text>
        </View>
      )}

      <View className="bg-card rounded-lg p-4 mb-4 border border-border">
        <Text className="text-sm text-muted-foreground mb-1">Signed in as</Text>
        <Text className="text-base font-medium text-foreground">
          {email?.address ?? "Unknown"}
        </Text>
      </View>

      {solanaWallet && (
        <View className="bg-secondary rounded-lg p-4 mb-4 border border-border">
          <Text className="text-sm text-muted-foreground mb-1">Solana Wallet</Text>
          <Text
            className="text-sm font-mono text-foreground"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {solanaWallet.address}
          </Text>
        </View>
      )}

      {!solanaWallet && (
        <View className="bg-secondary rounded-lg p-4 mb-4 border border-border">
          <Text className="text-sm text-muted-foreground">
            Creating your Solana wallet...
          </Text>
          <ActivityIndicator size="small" color="#94A3B8" className="mt-2" />
        </View>
      )}

      <TouchableOpacity
        className="mt-4 py-3 rounded-lg bg-secondary"
        onPress={handleSignOut}
      >
        <Text className="text-muted-foreground text-center font-semibold text-base">
          Sign Out
        </Text>
      </TouchableOpacity>
    </View>
  );
}
