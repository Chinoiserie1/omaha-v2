import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TrackerScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950">
      <View className="flex-1 p-5">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Tracker</Text>
        <Text className="text-sm text-gray-500 dark:text-zinc-400">
          Track your portfolio and transactions here.
        </Text>
      </View>
    </SafeAreaView>
  );
}
