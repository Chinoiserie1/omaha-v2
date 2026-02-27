import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

interface VaultActionsProps {
  hasMintAddress: boolean;
  onWithdraw: () => void;
}

export function VaultActions({
  hasMintAddress,
  onWithdraw,
}: VaultActionsProps) {
  if (!hasMintAddress) return null;

  return (
    <View className="mx-5 mt-4">
      <Button
        variant="outline"
        onPress={onWithdraw}
        className="border-red-600"
      >
        <Text className="text-sm font-semibold text-red-400">Withdraw</Text>
      </Button>
    </View>
  );
}
