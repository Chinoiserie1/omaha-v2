import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";

interface ActiveThesisRowProps {
  name: string;
  kolUsername: string;
  assetCount: number;
  pnlAmount: number;
  pnlPercent: number;
  onPress?: () => void;
}

function formatPnl(amount: number): string {
  const sign = amount >= 0 ? "+" : "";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

export function ActiveThesisRow({
  name,
  kolUsername,
  assetCount,
  pnlAmount,
  pnlPercent,
  onPress,
}: ActiveThesisRowProps) {
  const isPositive = pnlAmount >= 0;
  const pnlColor = isPositive ? "text-emerald-400" : "text-red-400";
  const sign = pnlPercent >= 0 ? "+" : "";

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between py-3"
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-semibold">{name}</Text>
        <Text className="text-xs text-muted-foreground">
          @{kolUsername} · {assetCount} assets
        </Text>
      </View>

      <View className="items-end gap-0.5">
        <Text className={`text-sm font-bold ${pnlColor}`}>
          {formatPnl(pnlAmount)}
        </Text>
        <Text className={`text-xs ${pnlColor}`}>
          {sign}{pnlPercent.toFixed(1)}%
        </Text>
      </View>
    </Pressable>
  );
}
