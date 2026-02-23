import { View, Text } from "react-native";
import { memo } from "react";

interface VaultAllocationCardProps {
  asset: string;
  percentage: number;
  conviction: "low" | "medium" | "high" | "stale";
  reasoning: string;
}

const convictionConfig = {
  high: { label: "High", bg: "bg-emerald-900/40", text: "text-emerald-400", bar: "#4ade80" },
  medium: { label: "Medium", bg: "bg-amber-900/40", text: "text-amber-400", bar: "#fbbf24" },
  low: { label: "Low", bg: "bg-red-900/40", text: "text-red-400", bar: "#fb7185" },
  stale: { label: "Stale", bg: "bg-zinc-800", text: "text-zinc-500", bar: "#71717a" },
};

export const VaultAllocationCard = memo(function VaultAllocationCard({
  asset,
  percentage,
  conviction,
  reasoning,
}: VaultAllocationCardProps) {
  const config = convictionConfig[conviction] ?? convictionConfig.stale;
  const barWidth = Math.min(percentage, 100);

  return (
    <View className="mx-5 bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-2">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-base font-semibold text-white">{asset}</Text>
        <Text className="text-base font-bold text-white">{percentage}%</Text>
      </View>
      <View className="h-1.5 bg-zinc-800 rounded-full mb-3 overflow-hidden">
        <View
          style={{ width: `${barWidth}%`, backgroundColor: config.bar }}
          className="h-full rounded-full"
        />
      </View>
      <View className="flex-row items-center gap-2 mb-2">
        <View className={`px-2 py-0.5 rounded-full ${config.bg}`}>
          <Text className={`text-[10px] font-semibold ${config.text}`}>
            {config.label}
          </Text>
        </View>
      </View>
      {reasoning ? (
        <Text className="text-xs text-zinc-400 leading-4" numberOfLines={2}>
          {reasoning}
        </Text>
      ) : null}
    </View>
  );
});
