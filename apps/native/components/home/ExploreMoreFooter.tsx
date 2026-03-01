import { View, Text, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ExploreMoreFooterProps {
  isLoading: boolean;
}

export function ExploreMoreFooter({ isLoading }: ExploreMoreFooterProps) {
  if (isLoading) {
    return (
      <View className="mt-4 items-center py-4">
        <ActivityIndicator size="small" color="#F8FAFC" />
      </View>
    );
  }

  return (
    <View className="mt-4 flex-row items-center justify-center gap-2 py-4">
      <Ionicons name="chevron-down" size={16} color="#94A3B8" />
      <Text className="text-sm font-semibold text-muted-foreground">
        Explore more vaults
      </Text>
      <Ionicons name="chevron-down" size={16} color="#94A3B8" />
    </View>
  );
}
