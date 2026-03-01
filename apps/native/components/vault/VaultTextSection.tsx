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
      <Text className="mb-3 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
        {title}
      </Text>
      <Text className="text-sm leading-5 text-muted-foreground">{content}</Text>
    </View>
  );
});
