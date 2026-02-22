import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { TwitterLoginButton } from "../../components/onboarding/TwitterLoginButton";

export default function ConnectTwitterScreen() {
  const router = useRouter();

  const handleTwitterSuccess = (twitterData: {
    twitterUsername?: string;
    twitterId?: string;
  }) => {
    router.push({
      pathname: "/(onboarding)/connect-email",
      params: {
        fromTwitter: "true",
        twitterUsername: twitterData.twitterUsername ?? "",
        twitterId: twitterData.twitterId ?? "",
        username: twitterData.twitterUsername ?? "",
      },
    });
  };

  const handleNoTwitter = () => {
    router.push("/(onboarding)/choose-username");
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 justify-center px-6">
        <View className="items-center mb-12">
          <View className="w-16 h-16 bg-zinc-100 rounded-2xl items-center justify-center mb-6">
            <Text className="text-3xl">𝕏</Text>
          </View>
          <Text className="text-3xl font-bold text-zinc-900 mb-3">
            Connect your Twitter
          </Text>
          <Text className="text-base text-zinc-500 text-center leading-6">
            Link your Twitter account to set up your profile automatically.
          </Text>
        </View>

        <TwitterLoginButton onSuccess={handleTwitterSuccess} />

        <TouchableOpacity
          className="mt-6 py-3"
          onPress={handleNoTwitter}
          activeOpacity={0.6}
        >
          <Text className="text-zinc-500 text-center text-base">
            I don&apos;t have a Twitter account
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
