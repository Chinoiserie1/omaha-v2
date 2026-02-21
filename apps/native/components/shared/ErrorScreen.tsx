import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ErrorScreenProps {
  error: Error;
  onRetry?: () => void;
}

export function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-6xl mb-4">!</Text>
        <Text className="text-xl font-semibold text-gray-900 mb-2 text-center">
          Something went wrong
        </Text>
        <Text className="text-base text-gray-600 text-center mb-6">
          {error.message}
        </Text>
        {onRetry && (
          <TouchableOpacity
            className="bg-gray-900 py-3 px-6 rounded-lg"
            onPress={onRetry}
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
