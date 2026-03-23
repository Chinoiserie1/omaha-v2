import { useState, useEffect, useCallback } from "react";
import { getConnection, getTokenBalances } from "@repo/solana";
import { SOLANA_RPC_URL } from "../lib/solana";

/**
 * Fetch the token balance for a given mint in the user's wallet.
 * Returns balance in UI units (already divided by decimals).
 */
export function useShareBalance(
  shareMint: string | null,
  walletAddress: string | undefined,
) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress || !shareMint) {
      setBalance(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const connection = getConnection(SOLANA_RPC_URL);
      const tokens = await getTokenBalances(connection, walletAddress);
      const share = tokens.find((t) => t.mint === shareMint);
      setBalance(share?.uiAmount ?? 0);
    } catch {
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, shareMint]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, refetch: fetchBalance };
}
