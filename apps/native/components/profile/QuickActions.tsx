import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

interface QuickActionsProps {
  onDeposit: () => void;
  onWithdraw: () => void;
}

export function QuickActions({ onDeposit, onWithdraw }: QuickActionsProps) {
  return (
    <View className="mb-6 flex-row gap-3">
      <Button variant="classic" className="flex-1" onPress={onDeposit}>
        <Text className="font-semibold text-primary-foreground">Deposit</Text>
      </Button>
      <Button variant="secondary" className="flex-1" onPress={onWithdraw}>
        <Text className="font-semibold text-secondary-foreground">Withdraw</Text>
      </Button>
    </View>
  );
}
