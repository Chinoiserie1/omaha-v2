import { View, Text, ActivityIndicator } from "react-native";
import { useVaultHoldings } from "../../hooks/queries/use-vault-holdings";
import { VaultHoldingCard } from "./VaultHoldingCard";

interface VaultHoldingsSectionProps {
  vaultId: string;
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function VaultHoldingsSection({ vaultId }: VaultHoldingsSectionProps) {
  const { data, isLoading, error } = useVaultHoldings(vaultId);

  if (isLoading) {
    return (
      <View className="items-center py-6">
        <ActivityIndicator size="small" color="#a1a1aa" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="mx-5 py-4">
        <Text className="text-sm text-zinc-500">
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
        <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          On-Chain Holdings
        </Text>
        <Text className="text-xs text-zinc-500">
          {formatUsd(data.totalEquityUsd)}
        </Text>
      </View>
      {data.holdings.map((holding) => (
        <VaultHoldingCard key={holding.mint} holding={holding} />
      ))}
    </View>
  );
}
