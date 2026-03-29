import { FlatList, TouchableOpacity, View } from "react-native";
import { Text } from "@/components/ui/text";
import type { AssetSuggestion } from "@repo/shared";

const CATEGORY_COLORS: Record<string, string> = {
  crypto: "#818CF8",
  stock: "#34D399",
  commodity: "#FBBF24",
  index: "#60A5FA",
  fixed_income: "#A78BFA",
};

interface AssetSuggestionListProps {
  suggestions: AssetSuggestion[];
  onSelect: (symbol: string) => void;
}

export function AssetSuggestionList({
  suggestions,
  onSelect,
}: AssetSuggestionListProps) {
  if (suggestions.length === 0) return null;

  return (
    <View className="flex-1">
      <FlatList
        data={suggestions}
        keyExtractor={(item) => item.symbol}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-row items-center justify-between px-4 py-3"
            onPress={() => onSelect(item.symbol)}
          >
            <View className="flex-row items-center gap-3">
              <Text className="text-base font-bold text-foreground">
                {item.symbol}
              </Text>
              <Text
                className="text-sm text-muted-foreground"
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </View>
            <View
              className="rounded-full px-2 py-0.5"
              style={{
                backgroundColor: `${CATEGORY_COLORS[item.category] ?? "#94A3B8"}20`,
              }}
            >
              <Text
                className="text-xs font-medium"
                style={{
                  color: CATEGORY_COLORS[item.category] ?? "#94A3B8",
                }}
              >
                {item.category}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
