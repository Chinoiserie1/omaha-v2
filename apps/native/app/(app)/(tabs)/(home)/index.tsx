import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VaultList } from "../../../../components/home/VaultList";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950" edges={["top"]}>
      <View className="px-5 pt-5 pb-3">
        <Text className="text-2xl font-bold text-zinc-900 dark:text-white">
          Vaults
        </Text>
      </View>
      <VaultList />
    </SafeAreaView>
  );
}
