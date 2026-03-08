import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

export function ChatButton() {
  return (
    <View className="mx-5">
      <Button
        variant="classic"
        className="flex-row gap-2"
        size="lg"
        onPress={() => router.push("/(app)/(tabs)/(chat)")}
      >
        <Ionicons name="chatbubble-outline" size={18} color="#FAFAFA" />
        <Text className="text-primary-foreground font-semibold">
          Chat with AI
        </Text>
      </Button>
    </View>
  );
}
