import { View } from "react-native";
import { Text } from "@/components/ui/text";

interface UsdcBalanceLabelProps {
  amount: number;
}

function formatUsdcAmount(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function UsdcBalanceLabel({ amount }: UsdcBalanceLabelProps) {
  return (
    <View className="mb-4 items-center">
      <Text className="text-sm text-muted-foreground">
        {formatUsdcAmount(amount)} USDC available
      </Text>
    </View>
  );
}
