import { View, Pressable } from "react-native";
import { useState } from "react";
import { Text } from "@/components/ui/text";
import { Card, CardContent } from "@/components/ui/card";
import { LineChartView } from "@/components/ui/LineChartView";
import {
  MOCK_PERFORMANCE_DATA,
  type PerformancePeriod,
} from "./portfolio-mock-data";

const PERIODS: { label: string; value: PerformancePeriod }[] = [
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "1M", value: "1M" },
];

export function PortfolioPerformanceChart() {
  const [period, setPeriod] = useState<PerformancePeriod>("1W");
  const data = MOCK_PERFORMANCE_DATA[period];

  const firstValue = data[0]?.value ?? 0;
  const lastValue = data[data.length - 1]?.value ?? 0;
  const isPositive = lastValue >= firstValue;
  const lineColor = isPositive ? "#14B8A6" : "#EF4444";

  return (
    <Card className="mb-4">
      <CardContent className="gap-3">
        <Text className="text-sm font-semibold">Portfolio Performance</Text>

        <LineChartView
          data={data}
          height={160}
          color={lineColor}
          showCursor
          showTooltip
          showGradient
        />

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
                    active ? "text-foreground" : "text-muted-foreground"
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
}
