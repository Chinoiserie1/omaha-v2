import { Text, View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UserForm } from "../components/home/UserForm.js";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView contentContainerClassName="p-5">
        <Text className="text-2xl font-bold text-gray-900 mb-5">
          Autopilot - Native App
        </Text>

        <UserForm />

        <View className="bg-gray-50 p-4 rounded-lg mt-6">
          <Text className="text-lg font-semibold text-gray-900 mb-2">
            Shared Package Demo
          </Text>
          <Text className="text-sm text-gray-600">
            This form uses Zod schemas from @repo/shared for validation.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
