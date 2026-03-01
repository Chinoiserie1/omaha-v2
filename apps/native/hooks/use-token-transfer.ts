import { useState, useCallback } from "react";
import { Connection } from "@solana/web3.js";
import { useEmbeddedSolanaWallet } from "@privy-io/expo";
import {
  SOL_MINT,
  SPL_TOKEN_PROGRAM_ID,
  buildSolTransferTransaction,
  buildTokenTransferTransaction,
} from "@repo/solana";
import type { PortfolioTokenItem } from "@repo/shared";
import { captureError } from "../lib/capture-error";
import { SOLANA_RPC_URL } from "../lib/solana";

interface UseTokenTransferResult {
  send: (
    token: PortfolioTokenItem,
    recipient: string,
    amount: string,
  ) => Promise<string>;
  sending: boolean;
  error: string | null;
}

export function useTokenTransfer(): UseTokenTransferResult {
  const { wallets } = useEmbeddedSolanaWallet();
  const wallet = wallets?.[0];
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (
      token: PortfolioTokenItem,
      recipient: string,
      amount: string,
    ): Promise<string> => {
      setError(null);
      setSending(true);

      try {
        if (!wallet) {
          throw new Error("Wallet not ready");
        }

        const connection = new Connection(SOLANA_RPC_URL);
        const amountNum = parseFloat(amount);

        const isSol = token.mint === SOL_MINT;
        const transaction = isSol
          ? await buildSolTransferTransaction(
              connection,
              wallet.address,
              recipient,
              amountNum,
            )
          : await buildTokenTransferTransaction(
              connection,
              wallet.address,
              recipient,
              token.mint,
              amountNum,
              token.decimals,
              token.programId ?? SPL_TOKEN_PROGRAM_ID,
            );

        const provider = await wallet.getProvider();
        const result = await provider.request({
          method: "signAndSendTransaction",
          params: { transaction, connection },
        });

        return result.signature;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Transaction failed";
        captureError(err, { source: "token_transfer" });
        setError(message);
        throw err;
      } finally {
        setSending(false);
      }
    },
    [wallet],
  );

  return { send, sending, error };
}
