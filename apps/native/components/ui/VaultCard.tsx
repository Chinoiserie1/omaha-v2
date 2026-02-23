import { View, Text, Pressable } from "react-native";
import { memo } from "react";

interface Allocation {
  asset: string;
  percentage: number;
}

interface VaultCardProps {
  name: string;
  description: string;
  allocations: Allocation[];
  onPress?: () => void;
}

export const VaultCard = memo(function VaultCard({
  name,
  description,
  allocations,
  onPress,
}: VaultCardProps) {
  return (
    <Pressable
      className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4 mb-3 border border-zinc-200 dark:border-zinc-800 active:opacity-80"
      onPress={onPress}
    >
      <Text className="text-base font-semibold text-zinc-900 dark:text-white mb-1">
        {name}
      </Text>
      <Text
        className="text-sm text-zinc-500 dark:text-zinc-400 mb-3 leading-5"
        numberOfLines={2}
      >
        {description}
      </Text>
      {allocations.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5">
          {allocations.map((a) => (
            <View
              key={a.asset}
              className="bg-zinc-200 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full"
            >
              <Text className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {a.asset}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
});
