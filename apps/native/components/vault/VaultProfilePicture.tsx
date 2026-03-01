import { View, Text } from "react-native";
import { memo } from "react";

interface VaultProfilePictureProps {
  name: string;
  size?: number;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export const VaultProfilePicture = memo(function VaultProfilePicture({
  name,
  size = 80,
}: VaultProfilePictureProps) {
  const initials = getInitials(name) || "V";
  const fontSize = size * 0.35;

  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: "#1E293B",
        borderWidth: 2,
        borderColor: "#334155",
      }}
    >
      <Text
        style={{ fontSize, lineHeight: fontSize * 1.2 }}
        className="font-bold text-muted-foreground"
      >
        {initials}
      </Text>
    </View>
  );
});
