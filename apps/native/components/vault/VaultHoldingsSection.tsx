import { View, Text, ActivityIndicator } from "react-native";
import { useVaultHoldings } from "../../hooks/queries/use-vault-holdings";
import { VaultHoldingCard } from "./VaultHoldingCard";
import { formatUsd } from "../../lib/format";

interface VaultHoldingsSectionProps {
  vaultId: string;
}

export function VaultHoldingsSection({ vaultId }: VaultHoldingsSectionProps) {
  const { data, isLoading, error } = useVaultHoldings(vaultId);

  if (isLoading) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator size="small" color="#94A3B8" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="mx-5 py-4">
        <Text className="text-sm text-muted-foreground">
          Unable to load on-chain holdings.
        </Text>
      </View>
    );
  }

  if (data.holdings.length === 0) {
    return null;
  }

  return (
    <View>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          On-Chain Holdings
        </Text>
        <Text className="text-xs text-muted-foreground">
          {formatUsd(data.totalEquityUsd)}
        </Text>
      </View>
      {data.holdings.map((holding) => (
        <VaultHoldingCard key={holding.mint} holding={holding} />
      ))}
    </View>
  );
}
