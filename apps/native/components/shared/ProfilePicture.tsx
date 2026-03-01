import { View, Text } from "react-native";
import { Image } from "expo-image";
import { memo } from "react";

interface ProfilePictureProps {
  imageUrl?: string | null | undefined;
  name?: string | null | undefined;
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

export const ProfilePicture = memo(function ProfilePicture({
  imageUrl,
  name,
  size = 72,
}: ProfilePictureProps) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: "#334155",
        }}
        contentFit="cover"
        transition={200}
      />
    );
  }

  const initials = getInitials(name ?? "") || "?";
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
