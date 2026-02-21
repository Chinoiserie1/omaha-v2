import { View, ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function FullScreenLoader() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#18181B" />
        <Text className="mt-4 text-gray-600">Loading...</Text>
      </View>
    </SafeAreaView>
  );
}
