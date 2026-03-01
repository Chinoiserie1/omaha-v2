import { View, Text, Image } from "react-native";
import { memo, useState } from "react";

interface VaultProfilePictureProps {
  name: string;
  avatarUrl?: string | null | undefined;
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
  avatarUrl,
  size = 80,
}: VaultProfilePictureProps) {
  const initials = getInitials(name) || "V";
  const fontSize = size * 0.35;
  const [imgError, setImgError] = useState(false);

  const showImage = avatarUrl && !imgError;

  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: size + 4,
        height: size + 4,
        borderWidth: 2,
        borderColor: "rgba(59, 130, 246, 0.5)",
      }}
    >
      {showImage ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setImgError(true)}
        />
      ) : (
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: size,
            height: size,
            backgroundColor: "#1E293B",
          }}
        >
          <Text
            style={{ fontSize, lineHeight: fontSize * 1.2 }}
            className="font-bold text-muted-foreground"
          >
            {initials}
          </Text>
        </View>
      )}
    </View>
  );
});
