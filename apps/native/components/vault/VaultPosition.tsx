import { useState, useEffect, useCallback } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { getConnection, getTokenBalances } from "@repo/solana";

const RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

interface VaultPositionProps {
  mintAddress: string;
}

export function VaultPosition({ mintAddress }: VaultPositionProps) {
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];

  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!wallet?.address) return;
    setLoading(true);
    try {
      const connection = getConnection(RPC_URL);
      const tokens = await getTokenBalances(connection, wallet.address);
      const share = tokens.find((t) => t.mint === mintAddress);
      setBalance(share?.uiAmount ?? 0);
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [wallet?.address, mintAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return (
    <View className="mx-5 mt-4 p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
      <Text className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
        Your Position
      </Text>
      {loading ? (
        <ActivityIndicator size="small" color="#71717A" />
      ) : balance === null ? (
        <Text className="text-sm text-zinc-500">Unable to load balance</Text>
      ) : balance === 0 ? (
        <Text className="text-sm text-zinc-500">No position</Text>
      ) : (
        <View className="flex-row items-baseline">
          <Text className="text-2xl font-bold text-white">
            {balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
          </Text>
          <Text className="text-sm text-zinc-400 ml-2">shares</Text>
        </View>
      )}
    </View>
  );
}
