import { View, TouchableOpacity } from "react-native";
import { Text } from "@/components/ui/text";
import { useRouter } from "expo-router";
import { CheckCircle } from "lucide-react-native";

interface FundSolSuccessProps {
  signature: string;
}

export function FundSolSuccess({ signature }: FundSolSuccessProps) {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center px-6">
      <CheckCircle size={64} color="#22c55e" />
      <Text className="mt-4 text-xl font-bold text-foreground">
        SOL Funded!
      </Text>
      <Text className="mt-2 text-sm text-muted-foreground text-center">
        Your SOL balance has been updated. You can now pay transaction fees.
      </Text>
      <Text
        className="mt-4 text-xs text-muted-foreground font-mono text-center"
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {signature}
      </Text>
      <TouchableOpacity
        className="mt-8 w-full bg-white py-4 rounded-xl"
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <Text className="text-background text-center font-semibold text-base">
          Done
        </Text>
      </TouchableOpacity>
    </View>
  );
}
