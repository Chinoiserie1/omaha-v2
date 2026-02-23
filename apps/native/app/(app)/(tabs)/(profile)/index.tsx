import { useEffect, useState, useCallback } from "react";
import { ScrollView, ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePrivy } from "@privy-io/expo";
import { ProfileHeader } from "../../../../components/profile/ProfileHeader";
import { WalletOverview } from "../../../../components/profile/WalletOverview";
import { SettingsButton } from "../../../../components/profile/SettingsButton";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4001";

interface ProfileData {
  id: string;
  username: string | null;
  name: string | null;
  twitterUsername: string | null;
  profileImageUrl: string | null;
  followersCount: number;
  followingCount: number;
}

export default function ProfileScreen() {
  const { getAccessToken } = usePrivy();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/api/profile/me`, { headers });

      if (response.ok) {
        const data = await response.json();
        if (data.success) setProfile(data.data);
      }
    } catch {
      // Graceful degradation
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#71717A" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-zinc-950">
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
