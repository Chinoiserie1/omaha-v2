import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { Card, CardContent } from "@/components/ui/card";

interface AssetCardProps {
  symbol: string;
  name: string;
  amount: number;
  valueUsd: number;
  label?: string;
}

function formatAmount(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`;
  if (amount < 0.01) return amount.toFixed(6);
  return amount.toFixed(2);
}

function formatUsd(value: number): string {
  if (value >= 1_000) {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${value.toFixed(2)}`;
}

export function AssetCard({ symbol, name, amount, valueUsd, label }: AssetCardProps) {
  return (
    <Card className="flex-1">
      <CardContent className="gap-2">
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
            <Text className="text-xs font-bold">
              {symbol.slice(0, 3).toUpperCase()}
            </Text>
          </View>
          <Text className="text-sm font-medium" numberOfLines={1}>
            {label ?? name}
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground">
          {formatAmount(amount)} {symbol}
        </Text>
        <Text className="text-base font-bold">{formatUsd(valueUsd)}</Text>
      </CardContent>
    </Card>
  );
}
