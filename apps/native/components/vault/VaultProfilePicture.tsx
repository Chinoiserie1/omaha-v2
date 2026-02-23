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
      className="items-center justify-center rounded-full bg-zinc-800"
      style={{
        width: size,
        height: size,
        backgroundColor: "#3f3f46",
        borderWidth: 2,
        borderColor: "#52525b",
      }}
    >
      <Text
        style={{ fontSize, lineHeight: fontSize * 1.2 }}
        className="font-bold text-zinc-300"
      >
        {initials}
      </Text>
    </View>
  );
});
