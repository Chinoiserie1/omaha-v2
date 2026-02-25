import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { useWalletPortfolio } from "../../hooks/queries/use-wallet-portfolio";
import { ExpandableTokenList } from "./ExpandableTokenList";

function formatTotalUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${value.toFixed(2)}`;
}

export function WalletOverview() {
  const router = useRouter();
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];

  const { data: portfolio, isLoading } = useWalletPortfolio(wallet?.address);

  if (!wallet) {
    return (
      <View className="p-5 mb-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900">
        <View className="flex-row items-center">
          <ActivityIndicator size="small" color="#71717A" />
          <Text className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">
            Setting up wallet...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="p-5 mb-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900">
      <Text className="mb-1 text-xs tracking-wider uppercase text-zinc-500 dark:text-zinc-400">
        Total Balance
      </Text>
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color="#71717A"
          className="self-start my-2"
        />
      ) : (
        <Text className="mb-4 text-3xl font-bold text-zinc-900 dark:text-white">
          {portfolio ? formatTotalUsd(portfolio.totalUsd) : "$0.00"}
        </Text>
      )}

      <Text
        className="mb-4 font-mono text-xs text-zinc-500 dark:text-zinc-400"
        numberOfLines={1}
        ellipsizeMode="middle"
        selectable
      >
        {wallet.address}
      </Text>

      <View className="flex-row gap-3 mb-4">
        <TouchableOpacity
          className="flex-1 py-3 rounded-xl bg-zinc-900 dark:bg-white"
          onPress={() =>
            router.push("/(app)/(tabs)/(profile)/deposit" as never)
          }
          activeOpacity={0.8}
        >
          <Text className="font-semibold text-center text-white dark:text-zinc-950">
            Deposit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 py-3 rounded-xl bg-zinc-200 dark:bg-zinc-800"
          onPress={() =>
            router.push("/(app)/(tabs)/(profile)/withdraw" as never)
          }
          activeOpacity={0.8}
        >
          <Text className="font-semibold text-center text-zinc-900 dark:text-white">
            Withdraw
          </Text>
        </TouchableOpacity>
      </View>

      {!isLoading && portfolio && portfolio.items.length > 0 && (
        <ExpandableTokenList items={portfolio.items} />
      )}
    </View>
  );
}
