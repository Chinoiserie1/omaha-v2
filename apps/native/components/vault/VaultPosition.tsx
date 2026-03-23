import { useState, useEffect, useCallback } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import { getConnection, getTokenBalances } from "@repo/solana";
import { SOLANA_RPC_URL } from "../../lib/solana";

interface VaultPositionProps {
  shareMint: string;
}

export function VaultPosition({ shareMint }: VaultPositionProps) {
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];

  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!wallet?.address) return;
    setLoading(true);
    try {
      const connection = getConnection(SOLANA_RPC_URL);
      const tokens = await getTokenBalances(connection, wallet.address);
      const share = tokens.find((t) => t.mint === shareMint);
      setBalance(share?.uiAmount ?? 0);
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [wallet?.address, shareMint]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return (
    <View className="mx-5 mt-4 p-4 rounded-2xl bg-card border border-border">
      <Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Your Position
      </Text>
      {loading ? (
        <ActivityIndicator size="small" color="#94A3B8" />
      ) : balance === null ? (
        <Text className="text-sm text-muted-foreground">Unable to load balance</Text>
      ) : balance === 0 ? (
        <Text className="text-sm text-muted-foreground">No position</Text>
      ) : (
        <View className="flex-row items-baseline">
          <Text className="text-2xl font-bold text-foreground">
            {balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
          </Text>
          <Text className="text-sm text-muted-foreground ml-2">shares</Text>
        </View>
      )}
    </View>
  );
}
