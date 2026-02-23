import { View, Text, ScrollView } from "react-native";
import { memo } from "react";

interface VaultStatsProps {
  jupiterEnabled: boolean;
  lastRebalancedAt: string | null;
  vaultSymbol: string;
  glamVaultPda: string | null;
}

function formatDate(date: string | null): string {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 mr-3 min-w-[120px]">
      <Text className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
        {label}
      </Text>
      <Text
        className={`text-sm font-semibold ${accent ? "text-emerald-400" : "text-white"}`}
      >
        {value}
      </Text>
    </View>
  );
}

export const VaultStats = memo(function VaultStats({
  jupiterEnabled,
  lastRebalancedAt,
  vaultSymbol,
  glamVaultPda,
}: VaultStatsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20 }}
      className="mb-2"
    >
      <StatCard label="Symbol" value={vaultSymbol} />
      <StatCard
        label="Jupiter"
        value={jupiterEnabled ? "Enabled" : "Disabled"}
        accent={jupiterEnabled}
      />
      <StatCard label="Last Rebalanced" value={formatDate(lastRebalancedAt)} />
      <StatCard
        label="Vault PDA"
        value={glamVaultPda ? `${glamVaultPda.slice(0, 6)}...` : "Pending"}
      />
    </ScrollView>
  );
});
