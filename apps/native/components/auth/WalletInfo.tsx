import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { usePrivy, useEmbeddedSolanaWallet } from "@privy-io/expo";

export function WalletInfo() {
  const { user, logout } = usePrivy();
  const { wallets } = useEmbeddedSolanaWallet();

  const solanaWallet = wallets?.[0];
  const email = user?.linked_accounts?.find(
    (account) => account.type === "email"
  );
  const twitter = user?.linked_accounts?.find(
    (account) => account.type === "twitter_oauth"
  );

  const handleLogout = async () => {
    await logout();
  };

  if (!user) {
    return (
      <View className="items-center justify-center py-8">
        <ActivityIndicator size="large" color="#18181B" />
      </View>
    );
  }

  return (
    <View className="w-full">
      {twitter && "username" in twitter && (
        <View className="bg-zinc-50 rounded-lg p-4 mb-4 border border-zinc-200">
          <Text className="text-sm text-zinc-500 mb-1">Username</Text>
          <Text className="text-base font-medium text-zinc-900">
            @{String(twitter.username)}
          </Text>
        </View>
      )}

      <View className="bg-zinc-50 rounded-lg p-4 mb-4 border border-zinc-200">
        <Text className="text-sm text-zinc-500 mb-1">Signed in as</Text>
        <Text className="text-base font-medium text-zinc-900">
          {email?.address ?? "Unknown"}
        </Text>
      </View>

      {solanaWallet && (
        <View className="bg-zinc-100 rounded-lg p-4 mb-4 border border-zinc-200">
          <Text className="text-sm text-zinc-600 mb-1">Solana Wallet</Text>
          <Text
            className="text-sm font-mono text-zinc-800"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {solanaWallet.address}
          </Text>
        </View>
      )}

      {!solanaWallet && (
        <View className="bg-zinc-100 rounded-lg p-4 mb-4 border border-zinc-200">
          <Text className="text-sm text-zinc-600">
            Creating your Solana wallet...
          </Text>
          <ActivityIndicator size="small" color="#71717A" className="mt-2" />
        </View>
      )}

      <TouchableOpacity
        className="mt-4 py-3 rounded-lg bg-zinc-200"
        onPress={handleLogout}
      >
        <Text className="text-zinc-700 text-center font-semibold text-base">
          Sign Out
        </Text>
      </TouchableOpacity>
    </View>
  );
}
