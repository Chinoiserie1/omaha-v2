import { View, Pressable } from "react-native";
import { memo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { VaultProfilePicture } from "@/components/vault/VaultProfilePicture";
import { Text } from "@/components/ui/text";

interface QuantHeaderProps {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  updatedAt: string | null;
  onSparklesPress: () => void;
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

export const QuantHeader = memo(function QuantHeader({
  displayName,
  username,
  avatarUrl,
  updatedAt,
  onSparklesPress,
}: QuantHeaderProps) {
  const timeAgo = updatedAt ? formatTimeAgo(updatedAt) : null;

  return (
    <View className="flex-row items-center px-5 pb-4">
      <View style={{ position: "relative" }}>
        <VaultProfilePicture
          name={displayName}
          avatarUrl={avatarUrl}
          size={56}
        />
        <View
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: "#3B82F6",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: "#0F172A",
          }}
        >
          <Ionicons name="checkmark" size={12} color="#FFFFFF" />
        </View>
      </View>

      <View className="flex-1 ml-3">
        <Text className="text-lg font-bold">{displayName}</Text>
        <Text className="text-xs text-muted-foreground">
          @{username}
          {timeAgo ? ` \u00B7 ${timeAgo}` : ""}
        </Text>
      </View>

      <Pressable
        onPress={onSparklesPress}
        className="justify-center items-center w-10 h-10 rounded-full bg-card active:bg-secondary"
      >
        <Ionicons name="sparkles" size={20} color="#3B82F6" />
      </Pressable>
    </View>
  );
});
