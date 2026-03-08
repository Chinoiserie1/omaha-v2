import { View, Text } from "react-native";
import { memo } from "react";

interface ThesisCardProps {
  thesisSummary: string;
  updatedAt: string;
}

export const ThesisCard = memo(function ThesisCard({
  thesisSummary,
  updatedAt,
}: ThesisCardProps) {
  const date = new Date(updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <View className="mx-5 bg-card border border-border rounded-xl overflow-hidden">
      <View className="flex-row">
        <View
          style={{
            width: 4,
            backgroundColor: "#3B82F6",
            borderTopLeftRadius: 4,
            borderBottomLeftRadius: 4,
          }}
        />
        <View className="flex-1 p-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Strategy Thesis
            </Text>
            <Text className="text-[10px] text-muted-foreground">{date}</Text>
          </View>
          <Text className="text-sm text-muted-foreground leading-relaxed">
            {thesisSummary}
          </Text>
        </View>
      </View>
    </View>
  );
});
