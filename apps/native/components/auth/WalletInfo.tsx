import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { usePrivy, useEmbeddedSolanaWallet } from "@privy-io/expo";

export function WalletInfo() {
  const { user, logout } = usePrivy();
  const { wallets } = useEmbeddedSolanaWallet();

  const solanaWallet = wallets?.[0];
  const email = user?.linked_accounts?.find(
    (account) => account.type === "email"
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
      <View className="bg-gray-50 rounded-lg p-4 mb-4">
        <Text className="text-sm text-gray-500 mb-1">Signed in as</Text>
        <Text className="text-base font-medium text-gray-900">
          {email?.address ?? "Unknown"}
        </Text>
      </View>

      {solanaWallet && (
        <View className="bg-gray-100 rounded-lg p-4 mb-4 border border-gray-200">
          <Text className="text-sm text-gray-600 mb-1">Solana Wallet</Text>
          <Text
            className="text-sm font-mono text-gray-800"
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {solanaWallet.address}
          </Text>
        </View>
      )}

      {!solanaWallet && (
        <View className="bg-gray-100 rounded-lg p-4 mb-4 border border-gray-200">
          <Text className="text-sm text-gray-600">
            Creating your Solana wallet...
          </Text>
          <ActivityIndicator size="small" color="#71717A" className="mt-2" />
        </View>
      )}

      <TouchableOpacity
        className="mt-4 py-3 rounded-lg bg-gray-200"
        onPress={handleLogout}
      >
        <Text className="text-gray-700 text-center font-semibold text-base">
          Sign Out
        </Text>
      </TouchableOpacity>
    </View>
  );
}
