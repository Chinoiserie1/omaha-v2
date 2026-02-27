import { View } from "react-native";
import { ProfilePicture } from "../shared/ProfilePicture";
import { Text } from "@/components/ui/text";
import { Separator } from "@/components/ui/separator";

interface ProfileHeaderProps {
  profileImageUrl?: string | null | undefined;
  username?: string | null | undefined;
  name?: string | null | undefined;
  twitterUsername?: string | null | undefined;
  followersCount: number;
  followingCount: number;
}

export function ProfileHeader({
  profileImageUrl,
  username,
  name,
  twitterUsername,
  followersCount,
  followingCount,
}: ProfileHeaderProps) {
  return (
    <View className="mb-6">
      <View className="mb-4 flex-row items-center">
        <ProfilePicture
          imageUrl={profileImageUrl}
          name={name ?? username}
          size={72}
        />
        <View className="ml-4 flex-1">
          <Text className="text-xl font-bold">
            {name ?? username ?? "Anonymous"}
          </Text>
          {twitterUsername && (
            <Text className="mt-0.5 text-sm text-muted-foreground">
              @{twitterUsername}
            </Text>
          )}
        </View>
      </View>

      <View className="flex-row">
        <View className="mr-6">
          <Text className="text-lg font-bold">{followersCount}</Text>
          <Text className="text-xs text-muted-foreground">Followers</Text>
        </View>
        <Separator orientation="vertical" className="mr-6" />
        <View>
          <Text className="text-lg font-bold">{followingCount}</Text>
          <Text className="text-xs text-muted-foreground">Following</Text>
        </View>
      </View>
    </View>
  );
}
