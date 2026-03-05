import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";

interface ActiveThesisRowProps {
  name: string;
  quantUsername: string;
  assetCount: number;
  valueUsd: number;
  pnlPercent: number;
  onPress?: () => void;
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ActiveThesisRow({
  name,
  quantUsername,
  assetCount,
  valueUsd,
  pnlPercent,
  onPress,
}: ActiveThesisRowProps) {
  const isPositive = pnlPercent >= 0;
  const pnlColor = isPositive ? "text-emerald-400" : "text-red-400";
  const sign = isPositive ? "+" : "";

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between py-3"
    >
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-semibold">{name}</Text>
        <Text className="text-xs text-muted-foreground">
          @{quantUsername} · {assetCount} assets
        </Text>
      </View>

      <View className="items-end gap-0.5">
        <Text className="text-sm font-bold text-foreground">
          {formatUsd(valueUsd)}
        </Text>
        <Text className={`text-xs ${pnlColor}`}>
          {sign}{pnlPercent.toFixed(1)}%
        </Text>
      </View>
    </Pressable>
  );
}
