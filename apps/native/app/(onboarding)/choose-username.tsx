import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { UsernameInput } from "../../components/onboarding/UsernameInput";

export default function ChooseUsernameScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [isAvailable, setIsAvailable] = useState(false);

  const handleAvailabilityChange = useCallback((available: boolean) => {
    setIsAvailable(available);
  }, []);

  const handleContinue = () => {
    if (!isAvailable || !username.trim()) return;

    router.push({
      pathname: "/(onboarding)/connect-email",
      params: {
        fromTwitter: "false",
        username: username.trim(),
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-6">
          <View className="items-center mb-10">
            <Text className="text-3xl font-bold text-zinc-900 mb-3">
              Choose your username
            </Text>
            <Text className="text-base text-zinc-500 text-center leading-6">
              This is how others will find you on Autopilot.
            </Text>
          </View>

          <UsernameInput
            value={username}
            onChangeText={setUsername}
            onAvailabilityChange={handleAvailabilityChange}
          />

          <TouchableOpacity
            className={`mt-6 py-4 rounded-xl ${
              isAvailable ? "bg-zinc-900" : "bg-zinc-300"
            }`}
            onPress={handleContinue}
            disabled={!isAvailable}
            activeOpacity={0.8}
          >
            <Text
              className={`text-center font-semibold text-lg ${
                isAvailable ? "text-white" : "text-zinc-500"
              }`}
            >
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
