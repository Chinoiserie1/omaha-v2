import { View, Pressable, ActivityIndicator } from "react-native";
import { useState, memo } from "react";
import { Text } from "@/components/ui/text";
import { Card, CardContent } from "@/components/ui/card";
import { LineChartView } from "@/components/ui/LineChartView";
import { usePortfolioChart } from "@/hooks/queries/use-portfolio-chart";
import type { PortfolioChartPeriod } from "@repo/shared";

const PERIODS: { label: string; value: PortfolioChartPeriod }[] = [
  { label: "1D", value: "1d" },
  { label: "1W", value: "7d" },
  { label: "1M", value: "30d" },
  { label: "All", value: "all" },
];

interface PortfolioPerformanceChartProps {
  walletAddress: string | undefined;
}

export const PortfolioPerformanceChart = memo(
  function PortfolioPerformanceChart({
    walletAddress,
  }: PortfolioPerformanceChartProps) {
    const [period, setPeriod] = useState<PortfolioChartPeriod>("7d");
    const { data, isLoading } = usePortfolioChart(walletAddress, period, 60);

    const points = data?.points ?? [];
    const percentChange = data?.percentChange;
    const isPositive = (percentChange ?? 0) >= 0;
    const lineColor = isPositive ? "#14B8A6" : "#EF4444";

    return (
      <Card className="mb-4">
        <CardContent className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold">Portfolio Performance</Text>
            {percentChange !== null && percentChange !== undefined && (
              <Text
                className={`text-sm font-semibold ${
                  isPositive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {isPositive ? "+" : ""}
                {percentChange.toFixed(2)}%
              </Text>
            )}
          </View>

          {isLoading ? (
            <View className="h-[160px] items-center justify-center">
              <ActivityIndicator size="small" color="#94A3B8" />
            </View>
          ) : points.length > 1 ? (
            <LineChartView
              data={points}
              height={160}
              color={lineColor}
              showCursor
              showTooltip
              showGradient
            />
          ) : (
            <View className="h-[160px] items-center justify-center">
              <Text className="text-sm text-muted-foreground">
                No performance data yet
              </Text>
            </View>
          )}

          <View className="flex-row gap-2">
            {PERIODS.map((p) => {
              const active = p.value === period;
              return (
                <Pressable
                  key={p.value}
                  onPress={() => setPeriod(p.value)}
                  className={`flex-1 items-center rounded-lg py-1.5 ${
                    active ? "bg-secondary" : "bg-transparent"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      active ? "text-white" : "text-muted-foreground"
                    }`}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </CardContent>
      </Card>
    );
  },
);
