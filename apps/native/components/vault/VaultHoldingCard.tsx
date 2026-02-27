import { View } from "react-native";
import { memo } from "react";
import type { VaultHoldingWithPct } from "@repo/shared";
import { Text } from "@/components/ui/text";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface VaultHoldingCardProps {
  holding: VaultHoldingWithPct;
}

function formatUsd(value: number): string {
  return value >= 1
    ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${value.toFixed(4)}`;
}

function formatAmount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value >= 1 ? value.toFixed(2) : value.toFixed(4);
}

export const VaultHoldingCard = memo(function VaultHoldingCard({
  holding,
}: VaultHoldingCardProps) {
  const barValue = Math.min(holding.percentage, 100);

  return (
    <Card className="mx-5 mb-2 gap-3 p-4 py-4">
      <CardContent className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold">{holding.symbol}</Text>
          <Text className="text-base font-bold">
            {holding.percentage.toFixed(1)}%
          </Text>
        </View>
        <Progress
          value={barValue}
          className="h-1.5"
          indicatorClassName="bg-indigo-400"
        />
        <View className="flex-row items-center justify-between">
          <Text className="text-xs text-muted-foreground">
            {formatAmount(holding.uiAmount)} tokens
          </Text>
          <Text className="text-xs text-muted-foreground">
            {formatUsd(holding.valueUsd)}
          </Text>
        </View>
      </CardContent>
    </Card>
  );
});
