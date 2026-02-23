import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useColorScheme } from "nativewind";
import { usePrivy, useEmbeddedSolanaWallet } from "@privy-io/expo";

export function WalletInfo() {
  const { user, logout } = usePrivy();
  const { wallets } = useEmbeddedSolanaWallet();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

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
        <ActivityIndicator size="large" color={isDark ? "#FAFAFA" : "#18181B"} />
      </View>
    );
  }

  return (
    <View className="w-full">
      {twitter && "username" in twitter && (
        <View className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 mb-4 border border-zinc-200 dark:border-zinc-700">
          <Text className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Username</Text>
          <Text className="text-base font-medium text-zinc-900 dark:text-white">
            @{String(twitter.username)}
          </Text>
        </View>
      )}

      <View className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 mb-4 border border-zinc-200 dark:border-zinc-700">
        <Text className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">Signed in as</Text>
        <Text className="text-base font-medium text-zinc-900 dark:text-white">
          {email?.address ?? "Unknown"}
        </Text>
      </View>

      {solanaWallet && (
        <View className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 mb-4 border border-zinc-200 dark:border-zinc-700">
          <Text className="text-sm text-zinc-600 dark:text-zinc-400 mb-1">Solana Wallet</Text>
          <Text
            className="text-sm font-mono text-zinc-800 dark:text-zinc-200"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {solanaWallet.address}
          </Text>
        </View>
      )}

      {!solanaWallet && (
        <View className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 mb-4 border border-zinc-200 dark:border-zinc-700">
          <Text className="text-sm text-zinc-600 dark:text-zinc-400">
            Creating your Solana wallet...
          </Text>
          <ActivityIndicator size="small" color={isDark ? "#A1A1AA" : "#71717A"} className="mt-2" />
        </View>
      )}

      <TouchableOpacity
        className="mt-4 py-3 rounded-lg bg-zinc-200 dark:bg-zinc-800"
        onPress={handleLogout}
      >
        <Text className="text-zinc-700 dark:text-zinc-300 text-center font-semibold text-base">
          Sign Out
        </Text>
      </TouchableOpacity>
    </View>
  );
}
