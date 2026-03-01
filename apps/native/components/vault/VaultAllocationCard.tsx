import { View } from "react-native";
import { memo } from "react";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";

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

const tokenColors: Record<string, string> = {
  S: "#14F195",
  B: "#F7931A",
  E: "#627EEA",
  J: "#00D4AA",
  R: "#E42575",
  W: "#2775CA",
  M: "#6E4AFF",
};

function getTokenColor(asset: string): string {
  const firstChar = asset.charAt(0).toUpperCase();
  return tokenColors[firstChar] ?? "#3B82F6";
}

export const VaultAllocationCard = memo(function VaultAllocationCard({
  asset,
  percentage,
  conviction,
  reasoning,
}: VaultAllocationCardProps) {
  const config = convictionConfig[conviction] ?? convictionConfig.stale;
  const tokenColor = getTokenColor(asset);
  const initial = asset.charAt(0).toUpperCase();

  return (
    <View className="mx-5 bg-card border border-border rounded-xl p-4 flex-row items-center">
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: `${tokenColor}20`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{ color: tokenColor, fontSize: 16, fontWeight: "700" }}
        >
          {initial}
        </Text>
      </View>

      <View className="flex-1 ml-3">
        <Text className="text-base font-semibold">{asset}</Text>
        {reasoning ? (
          <Text
            className="text-xs text-muted-foreground mt-0.5"
            numberOfLines={1}
          >
            {reasoning}
          </Text>
        ) : null}
      </View>

      <View className="items-end">
        <Text className="text-base font-bold">{percentage}%</Text>
        <Badge variant="secondary" className={`mt-1 ${config.bg}`}>
          <Text className={`text-[10px] font-semibold ${config.text}`}>
            {config.label}
          </Text>
        </Badge>
      </View>
    </View>
  );
});
