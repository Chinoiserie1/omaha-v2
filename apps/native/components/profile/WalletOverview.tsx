import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import {
  getConnection,
  getWalletBalances,
  type WalletBalances,
} from "@repo/solana";
import { TokenList } from "./TokenList";

const RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

export function WalletOverview() {
  const router = useRouter();
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBalances = useCallback(async () => {
    if (!wallet?.address) return;
    try {
      const connection = getConnection(RPC_URL);
      const data = await getWalletBalances(connection, wallet.address);
      setBalances(data);
    } catch {
      setBalances(null);
    } finally {
      setLoading(false);
    }
  }, [wallet?.address]);

  console.log("[WalletOverview] Balances:", JSON.stringify(balances, null, 2));

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

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
        Wallet Balance
      </Text>
      {loading ? (
        <ActivityIndicator
          size="small"
          color="#71717A"
          className="self-start my-2"
        />
      ) : (
        <Text className="mb-4 text-3xl font-bold text-zinc-900 dark:text-white">
          {balances !== null ? `${balances.sol.toFixed(4)} SOL` : "-- SOL"}
        </Text>
      )}

      <Text
        className="mb-4 font-mono text-xs text-zinc-500 dark:text-zinc-400"
        numberOfLines={1}
        ellipsizeMode="middle"
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

      {!loading && balances && balances.tokens.length > 0 && (
        <TokenList tokens={balances.tokens} />
      )}
    </View>
  );
}
