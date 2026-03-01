import { View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

interface TransferSuccessProps {
  txSignature: string;
  onDone: () => void;
}

export function TransferSuccess({ txSignature, onDone }: TransferSuccessProps) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Animated.View entering={ZoomIn.springify()}>
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
          <Ionicons name="checkmark-circle" size={40} color="#10B981" />
        </View>
      </Animated.View>

      <Text className="mb-2 text-2xl font-bold">Sent!</Text>
      <Text className="mb-6 text-center text-sm text-muted-foreground">
        Your transaction has been submitted successfully.
      </Text>

      <Text
        className="mb-8 text-center font-mono text-xs text-muted-foreground"
        numberOfLines={2}
        selectable
      >
        {txSignature}
      </Text>

      <Button variant="classic" className="w-full" size="lg" onPress={onDone}>
        <Text className="font-semibold text-primary-foreground">Done</Text>
      </Button>
    </View>
  );
}
