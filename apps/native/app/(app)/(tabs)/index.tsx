import { Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WalletInfo } from "../../../components/auth/WalletInfo";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950">
      <ScrollView contentContainerClassName="p-5">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-5">
          Welcome to Autopilot
        </Text>

        <WalletInfo />

        <View className="bg-gray-50 dark:bg-zinc-900 p-4 rounded-lg mt-6">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Your Solana Wallet
          </Text>
          <Text className="text-sm text-gray-600 dark:text-zinc-400">
            Your embedded Solana wallet is ready. You can use it to sign
            transactions and interact with the Solana blockchain.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
