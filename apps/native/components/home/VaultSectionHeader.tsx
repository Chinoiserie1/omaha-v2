import { View, Text, Pressable } from "react-native";

interface VaultSectionHeaderProps {
  onSeeAll?: () => void;
}

export function VaultSectionHeader({ onSeeAll }: VaultSectionHeaderProps) {
  return (
    <View className="mb-3 mt-4 flex-row items-center justify-between">
      <Text className="text-xs font-semibold tracking-widest text-muted-foreground">
        TOP VAULTS
      </Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text className="text-xs font-semibold text-primary">SEE ALL</Text>
        </Pressable>
      )}
    </View>
  );
}
