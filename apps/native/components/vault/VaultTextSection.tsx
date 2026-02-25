import { View, Text } from "react-native";
import { memo } from "react";

interface VaultTextSectionProps {
  title: string;
  content: string;
}

export const VaultTextSection = memo(function VaultTextSection({
  title,
  content,
}: VaultTextSectionProps) {
  return (
    <View className="mx-5 mt-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
        {title}
      </Text>
      <Text className="text-sm text-zinc-300 leading-5">{content}</Text>
    </View>
  );
});
