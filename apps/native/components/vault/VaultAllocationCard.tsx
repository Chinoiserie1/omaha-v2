import { View } from "react-native";
import { memo } from "react";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface VaultAllocationCardProps {
  asset: string;
  percentage: number;
  conviction: "low" | "medium" | "high" | "stale";
  reasoning: string;
}

const convictionConfig = {
  high: { label: "High", bg: "bg-emerald-900/40", text: "text-emerald-400" },
  medium: { label: "Medium", bg: "bg-amber-900/40", text: "text-amber-400" },
  low: { label: "Low", bg: "bg-red-900/40", text: "text-red-400" },
  stale: { label: "Stale", bg: "bg-secondary", text: "text-muted-foreground" },
};

export const VaultAllocationCard = memo(function VaultAllocationCard({
  asset,
  percentage,
  conviction,
  reasoning,
}: VaultAllocationCardProps) {
  const config = convictionConfig[conviction] ?? convictionConfig.stale;
  const barValue = Math.min(percentage, 100);

  return (
    <Card className="mx-5 mb-2 gap-3 p-4 py-4">
      <CardContent className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold">{asset}</Text>
          <Text className="text-base font-bold">{percentage}%</Text>
        </View>
        <Progress value={barValue} className="h-1.5" />
        <View className="flex-row items-center gap-2">
          <Badge variant="secondary" className={config.bg}>
            <Text className={`text-[10px] font-semibold ${config.text}`}>
              {config.label}
            </Text>
          </Badge>
        </View>
        {reasoning ? (
          <Text
            className="text-xs leading-4 text-muted-foreground"
            numberOfLines={2}
          >
            {reasoning}
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
});
