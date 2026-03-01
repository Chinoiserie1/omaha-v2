import { View } from "react-native";
import { Text } from "@/components/ui/text";

interface TokenAvatarProps {
  symbol: string;
  size?: number;
}

export function TokenAvatar({ symbol, size = 40 }: TokenAvatarProps) {
  const initials = symbol.slice(0, 2).toUpperCase();

  return (
    <View
      className="items-center justify-center rounded-full bg-secondary"
      style={{ width: size, height: size }}
    >
      <Text
        className="font-bold text-muted-foreground"
        style={{ fontSize: size * 0.35 }}
      >
        {initials}
      </Text>
    </View>
  );
}
