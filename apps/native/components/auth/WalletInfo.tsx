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
        <ActivityIndicator size="large" color="#FAFAFA" />
      </View>
    );
  }

  return (
    <View className="w-full">
      {twitter && "username" in twitter && (
        <View className="bg-zinc-900 rounded-lg p-4 mb-4 border border-zinc-700">
          <Text className="text-sm text-zinc-400 mb-1">Username</Text>
          <Text className="text-base font-medium text-white">
            @{String(twitter.username)}
          </Text>
        </View>
      )}

      <View className="bg-zinc-900 rounded-lg p-4 mb-4 border border-zinc-700">
        <Text className="text-sm text-zinc-400 mb-1">Signed in as</Text>
        <Text className="text-base font-medium text-white">
          {email?.address ?? "Unknown"}
        </Text>
      </View>

      {solanaWallet && (
        <View className="bg-zinc-800 rounded-lg p-4 mb-4 border border-zinc-700">
          <Text className="text-sm text-zinc-400 mb-1">Solana Wallet</Text>
          <Text
            className="text-sm font-mono text-zinc-200"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {solanaWallet.address}
          </Text>
        </View>
      )}

      {!solanaWallet && (
        <View className="bg-zinc-800 rounded-lg p-4 mb-4 border border-zinc-700">
          <Text className="text-sm text-zinc-400">
            Creating your Solana wallet...
          </Text>
          <ActivityIndicator size="small" color="#A1A1AA" className="mt-2" />
        </View>
      )}

      <TouchableOpacity
        className="mt-4 py-3 rounded-lg bg-zinc-800"
        onPress={handleSignOut}
      >
        <Text className="text-zinc-300 text-center font-semibold text-base">
          Sign Out
        </Text>
      </TouchableOpacity>
    </View>
  );
}
