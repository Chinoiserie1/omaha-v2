import { Pressable, Text } from "react-native";

interface ExploreMoreButtonProps {
  onPress?: () => void;
}

export function ExploreMoreButton({ onPress }: ExploreMoreButtonProps) {
  return (
    <Pressable
      className="mt-4 items-center rounded-2xl border border-border bg-secondary/50 py-4 active:opacity-80"
      onPress={onPress}
    >
      <Text className="text-sm font-semibold text-primary">
        Explore more vaults
      </Text>
    </Pressable>
  );
}
