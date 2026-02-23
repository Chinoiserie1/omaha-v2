import { View, Text } from "react-native";
import { ProfilePicture } from "../shared/ProfilePicture";

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
      <View className="flex-row items-center mb-4">
        <ProfilePicture imageUrl={profileImageUrl} name={name ?? username} size={72} />
        <View className="ml-4 flex-1">
          <Text className="text-xl font-bold text-zinc-900 dark:text-white">
            {name ?? username ?? "Anonymous"}
          </Text>
          {twitterUsername && (
            <Text className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              @{twitterUsername}
            </Text>
          )}
        </View>
      </View>

      <View className="flex-row">
        <View className="mr-6">
          <Text className="text-lg font-bold text-zinc-900 dark:text-white">
            {followersCount}
          </Text>
          <Text className="text-xs text-zinc-500 dark:text-zinc-400">Followers</Text>
        </View>
        <View>
          <Text className="text-lg font-bold text-zinc-900 dark:text-white">
            {followingCount}
          </Text>
          <Text className="text-xs text-zinc-500 dark:text-zinc-400">Following</Text>
        </View>
      </View>
    </View>
  );
}
