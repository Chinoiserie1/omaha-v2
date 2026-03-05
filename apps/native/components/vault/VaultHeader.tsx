import { View } from "react-native";
import { memo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { VaultProfilePicture } from "./VaultProfilePicture";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";

interface VaultHeaderProps {
  name: string;
  quantUsername: string;
  isActive: boolean;
  avatarUrl?: string | null | undefined;
  updatedAt?: string | null | undefined;
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

export const VaultHeader = memo(function VaultHeader({
  name,
  quantUsername,
  isActive,
  avatarUrl,
  updatedAt,
}: VaultHeaderProps) {
  const timeAgo = updatedAt ? formatTimeAgo(updatedAt) : null;

  return (
    <View className="flex-row items-center px-5 pb-4">
      <View style={{ position: "relative" }}>
        <VaultProfilePicture name={name} avatarUrl={avatarUrl} size={56} />
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
        <Text className="text-lg font-bold">{name}</Text>
        <Text className="text-xs text-muted-foreground">
          @{quantUsername}
          {timeAgo ? ` \u00B7 ${timeAgo}` : ""}
        </Text>
      </View>

      <Badge
        variant="secondary"
        className={isActive ? "bg-emerald-900/40" : "bg-red-900/40"}
      >
        <Text
          className={`text-xs font-semibold ${isActive ? "text-emerald-400" : "text-red-400"}`}
        >
          {isActive ? "Active" : "Inactive"}
        </Text>
      </Badge>
    </View>
  );
});
