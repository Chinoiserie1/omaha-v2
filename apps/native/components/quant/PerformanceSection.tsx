import { View } from "react-native";
import { memo } from "react";
import { Text } from "@/components/ui/text";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatUsd } from "@/lib/format";

interface PerformanceSectionProps {
  currentValue: number;
  change24h: number;
  change7d: number;
  change30d: number;
  changeAll: number;
}

function ChangeRow({ label, value }: { label: string; value: number }) {
  const isPositive = value >= 0;
  const color = isPositive ? "text-emerald-400" : "text-red-400";
  const sign = isPositive ? "+" : "";

  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className={`text-sm font-semibold ${color}`}>
        {sign}
        {value.toFixed(2)}%
      </Text>
    </View>
  );
}

export const PerformanceSection = memo(function PerformanceSection({
  currentValue,
  change24h,
  change7d,
  change30d,
  changeAll,
}: PerformanceSectionProps) {
  const isPositive = change24h >= 0;

  return (
    <Card className="mx-5">
      <CardHeader>
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Portfolio Value
        </Text>
        <Text className="text-2xl font-bold text-foreground">
          {formatUsd(currentValue)}
        </Text>
        <Text
          className={`text-sm font-medium ${isPositive ? "text-emerald-400" : "text-red-400"}`}
        >
          {isPositive ? "+" : ""}
          {change24h.toFixed(2)}% today
        </Text>
      </CardHeader>
      <CardContent className="gap-3">
        <ChangeRow label="7 days" value={change7d} />
        <ChangeRow label="30 days" value={change30d} />
        <ChangeRow label="All time" value={changeAll} />
      </CardContent>
    </Card>
  );
});
