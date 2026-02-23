import { View, Text } from "react-native";
import { memo } from "react";

interface VaultChangesProps {
  changes: string[];
}

export const VaultChanges = memo(function VaultChanges({
  changes,
}: VaultChangesProps) {
  if (changes.length === 0) return null;

  return (
    <View className="mx-5 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
        Recent Changes
      </Text>
      {changes.map((change, i) => (
        <View key={i} className="flex-row items-start mb-2 last:mb-0">
          <Text className="text-zinc-600 mr-2 text-xs mt-0.5">*</Text>
          <Text className="text-sm text-zinc-300 leading-5 flex-1">
            {change}
          </Text>
        </View>
      ))}
    </View>
  );
});
