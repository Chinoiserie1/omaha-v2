import { View, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";

export function FullScreenLoader() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#FAFAFA" />
        <Text className="mt-4 text-muted-foreground">Loading...</Text>
      </View>
    </SafeAreaView>
  );
}
