import { View, Text, Pressable } from "react-native";
import { memo, useState } from "react";
import { LineChartView } from "../ui/LineChartView";
import { useVaultPerformance } from "../../hooks/queries/use-vault-performance";
import type { VaultPerformancePeriod } from "@repo/shared";

const PERIODS: { label: string; value: VaultPerformancePeriod }[] = [
  { label: "1D", value: "1d" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "All", value: "all" },
];

function formatPrice(price: number | null): string {
  if (price === null) return "--";
  if (price < 0.01) return `$${price.toFixed(6)}`;
  return `$${price.toFixed(2)}`;
}

function formatPercent(pct: number | null): string {
  if (pct === null) return "";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

interface VaultPerformanceChartProps {
  vaultId: string;
}

export const VaultPerformanceChart = memo(function VaultPerformanceChart({
  vaultId,
}: VaultPerformanceChartProps) {
  const [period, setPeriod] = useState<VaultPerformancePeriod>("7d");
  const { data, isLoading } = useVaultPerformance(vaultId, period, 60);

  console.log("VaultPerformanceChart data", data);

  const points = data?.points ?? [];
  const currentPrice = data?.currentPrice ?? null;
  const percentChange = data?.percentChange ?? null;
  const isPositive = percentChange !== null && percentChange >= 0;
  const lineColor = isPositive ? "#10b981" : "#ef4444";

  return (
    <View className="px-5 mb-2">
      <View className="px-4 pt-4 pb-3 rounded-xl border bg-zinc-900 border-zinc-800">
        {/* Price + change */}
        <View className="flex-row gap-2 items-baseline mb-3">
          <Text className="text-xl font-bold text-white">
            {formatPrice(currentPrice)}
          </Text>
          {percentChange !== null && (
            <Text
              className={`text-sm font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}
            >
              {formatPercent(percentChange)}
            </Text>
          )}
          <Text className="text-xs text-zinc-500">share price</Text>
        </View>

        {/* Chart */}
        <LineChartView
          data={points}
          height={160}
          color={lineColor}
          loading={isLoading}
          showCursor
          showTooltip
          showGradient
        />

        {/* Period tabs */}
        <View className="flex-row gap-2 mt-3">
          {PERIODS.map((p) => {
            const active = p.value === period;
            return (
              <Pressable
                key={p.value}
                onPress={() => setPeriod(p.value)}
                className={`flex-1 items-center py-1.5 rounded-lg ${
                  active ? "bg-zinc-700" : "bg-zinc-800"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    active ? "text-white" : "text-zinc-500"
                  }`}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
});
