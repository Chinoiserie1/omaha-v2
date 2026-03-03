import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { NetWorthSkeleton } from "./skeletons";

interface NetWorthDisplayProps {
  totalUsd: number;
  dailyChangePercent: number;
  isLoading?: boolean;
}

function formatTotalUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${value.toFixed(2)}`;
}

export function NetWorthDisplay({
  totalUsd,
  dailyChangePercent,
  isLoading = false,
}: NetWorthDisplayProps) {
  const isPositive = dailyChangePercent >= 0;
  const sign = isPositive ? "+" : "";

  return (
    <View className="mb-6 items-center">
      {isLoading ? (
        <NetWorthSkeleton />
      ) : (
        <>
          <Text className="text-4xl font-bold">{formatTotalUsd(totalUsd)}</Text>
          <View
            className={`mt-2 rounded-full px-3 py-1 ${
              isPositive ? "bg-emerald-400/15" : "bg-red-400/15"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                isPositive ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {sign}
              {dailyChangePercent.toFixed(2)}% today
            </Text>
          </View>
        </>
      )}
    </View>
  );
}
