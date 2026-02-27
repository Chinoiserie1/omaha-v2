import { View } from "react-native";
import { memo } from "react";
import { Text } from "@/components/ui/text";
import { Card, CardContent } from "@/components/ui/card";

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
    <Card className="flex-1 gap-1 py-3">
      <CardContent className="gap-1">
        <Text className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Text>
        <Text
          className={`text-sm font-semibold ${accent ? "text-emerald-400" : ""}`}
          numberOfLines={1}
        >
          {value}
        </Text>
      </CardContent>
    </Card>
  );
}

export const VaultStats = memo(function VaultStats({
  jupiterEnabled,
  lastRebalancedAt,
  vaultSymbol,
  glamVaultPda,
}: VaultStatsProps) {
  return (
    <View className="mb-2 gap-3 px-5">
      <View className="flex-row gap-3">
        <StatCard label="Symbol" value={vaultSymbol} />
        <StatCard
          label="Jupiter"
          value={jupiterEnabled ? "Enabled" : "Disabled"}
          accent={jupiterEnabled}
        />
      </View>
      <View className="flex-row gap-3">
        <StatCard
          label="Last Rebalanced"
          value={formatDate(lastRebalancedAt)}
        />
        <StatCard
          label="Vault PDA"
          value={glamVaultPda ? `${glamVaultPda.slice(0, 6)}...` : "Pending"}
        />
      </View>
    </View>
  );
});
