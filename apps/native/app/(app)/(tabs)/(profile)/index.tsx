import { ScrollView, ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProfileHeader } from "../../../../components/profile/ProfileHeader";
import { WalletOverview } from "../../../../components/profile/WalletOverview";
import { SettingsButton } from "../../../../components/profile/SettingsButton";
import { useMyProfile } from "../../../../hooks/queries/use-profile";

export default function ProfileScreen() {
  const { data: profile, isLoading } = useMyProfile();

  console.log("[ProfileScreen] Profile:", JSON.stringify(profile, null, 2));

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-zinc-950">
        <ActivityIndicator size="large" color="#71717A" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false}>
        <ProfileHeader
          profileImageUrl={profile?.profileImageUrl}
          username={profile?.username}
          name={profile?.name}
          twitterUsername={profile?.twitterUsername}
          followersCount={profile?.followersCount ?? 0}
          followingCount={profile?.followingCount ?? 0}
        />

        <WalletOverview />

        <View className="mt-4">
          <SettingsButton />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
