import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

interface ErrorScreenProps {
  error: Error;
  onRetry?: () => void;
}

export function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="mb-4 text-6xl">!</Text>
        <Text className="mb-2 text-center text-xl font-semibold">
          Something went wrong
        </Text>
        <Text className="mb-6 text-center text-base text-muted-foreground">
          {error.message}
        </Text>
        {onRetry && (
          <Button variant="classic" onPress={onRetry}>
            <Text className="font-semibold text-primary-foreground">
              Try Again
            </Text>
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}
