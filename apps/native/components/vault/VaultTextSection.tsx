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
    <View className="p-4 mx-5 mt-3">
      <Text className="mb-3 text-xs font-semibold tracking-wider uppercase text-zinc-500">
        {title}
      </Text>
      <Text className="text-sm leading-5 text-zinc-700 dark:text-zinc-300">{content}</Text>
    </View>
  );
});
