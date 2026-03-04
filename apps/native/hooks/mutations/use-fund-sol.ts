import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Transaction, Connection, type SendOptions } from "@solana/web3.js";
import { Buffer } from "buffer";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import { SOLANA_RPC_URL } from "../../lib/solana";
import type { FundSolResponse } from "@repo/shared";

interface FundSolParams {
  amountUsd: number;
  signerPublicKey: string;
  signAndSend: (
    transaction: Transaction,
    connection: Connection,
    options?: SendOptions,
  ) => Promise<{ signature: string }>;
}

export function useFundSol() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      amountUsd,
      signerPublicKey,
      signAndSend,
    }: FundSolParams): Promise<{
      signature: string;
      signerPublicKey: string;
      quote: FundSolResponse["quote"];
    }> => {
      // Step 1: Build partially-signed transaction on backend
      const { transaction: txBase64, quote } =
        await apiClient.post<FundSolResponse>("/api/swap/fund-sol", {
          amountUsd,
          signerPublicKey,
        });

      // Step 2: Deserialize the partially-signed transaction
      const transaction = Transaction.from(Buffer.from(txBase64, "base64"));

      // Step 3: Sign and send via Privy (skip preflight — RPC mismatch)
      const connection = new Connection(SOLANA_RPC_URL);
      const { signature } = await signAndSend(transaction, connection, {
        skipPreflight: true,
      });

      // Step 4: Wait for on-chain confirmation
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );

      return { signature, signerPublicKey, quote };
    },
    onSuccess: ({ signerPublicKey }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.wallet.portfolio(signerPublicKey),
      });
    },
  });
}
