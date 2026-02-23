import { View, ActivityIndicator, Text } from "react-native";
import { useColorScheme } from "nativewind";
import { SafeAreaView } from "react-native-safe-area-context";

export function FullScreenLoader() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950">
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={isDark ? "#FAFAFA" : "#18181B"} />
        <Text className="mt-4 text-gray-600 dark:text-zinc-400">Loading...</Text>
      </View>
    </SafeAreaView>
  );
}
