import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ProfilePicture } from "../shared/ProfilePicture";
import { Text } from "@/components/ui/text";

interface PortfolioHeaderProps {
  profileImageUrl?: string | null | undefined;
  name?: string | null | undefined;
  username?: string | null | undefined;
  notificationCount?: number;
}

export function PortfolioHeader({
  profileImageUrl,
  name,
  username,
  notificationCount = 0,
}: PortfolioHeaderProps) {
  const displayName = name ?? username ?? "Anonymous";

  return (
    <View className="mb-6 flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        <ProfilePicture
          imageUrl={profileImageUrl}
          name={displayName}
          size={40}
        />
        <View>
          <Text className="text-lg font-bold">{displayName}</Text>
          {username && (
            <Text className="text-xs text-muted-foreground">@{username}</Text>
          )}
        </View>
      </View>

      <View className="relative">
        <Ionicons name="notifications-outline" size={24} color="#94A3B8" />
        {notificationCount > 0 && (
          <View className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-primary">
            <Text className="text-[10px] font-bold text-primary-foreground">
              {notificationCount > 9 ? "9+" : notificationCount}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
