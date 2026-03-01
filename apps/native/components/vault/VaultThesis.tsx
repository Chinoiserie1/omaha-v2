import { View, Text } from "react-native";
import { memo } from "react";

interface VaultThesisProps {
  thesisSummary: string;
  updatedAt: string;
}

export const VaultThesis = memo(function VaultThesis({
  thesisSummary,
  updatedAt,
}: VaultThesisProps) {
  const date = new Date(updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <View className="mx-5 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Investment Thesis
        </Text>
        <Text className="text-[10px] text-zinc-600">{date}</Text>
      </View>
      <Text className="text-sm text-zinc-300 leading-5">{thesisSummary}</Text>
    </View>
  );
});
