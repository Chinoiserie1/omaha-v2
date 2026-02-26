import { View, Text } from "react-native";
import { memo } from "react";
import type { VaultHoldingWithPct } from "@repo/shared";

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
  const barWidth = Math.min(holding.percentage, 100);

  return (
    <View className="mx-5 mb-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-base font-semibold text-white">
          {holding.symbol}
        </Text>
        <Text className="text-base font-bold text-white">
          {holding.percentage.toFixed(1)}%
        </Text>
      </View>
      <View className="mb-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <View
          style={{ width: `${barWidth}%`, backgroundColor: "#818cf8" }}
          className="h-full rounded-full"
        />
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-zinc-400">
          {formatAmount(holding.uiAmount)} tokens
        </Text>
        <Text className="text-xs text-zinc-400">
          {formatUsd(holding.valueUsd)}
        </Text>
      </View>
    </View>
  );
});
