import { useMutation } from "@tanstack/react-query";
import { Transaction, Connection, type SendOptions } from "@solana/web3.js";
import { Buffer } from "buffer";
import { apiClient } from "../../lib/api-client";
import { SOLANA_RPC_URL } from "../../lib/solana";

interface ClaimParams {
  vaultId: string;
  signerPublicKey: string;
  signAndSend: (
    transaction: Transaction,
    connection: Connection,
    options?: SendOptions,
  ) => Promise<{ signature: string }>;
}

interface ClaimResponse {
  transaction: string;
}

export function useClaimRedemption() {
  return useMutation({
    mutationFn: async ({
      vaultId,
      signerPublicKey,
      signAndSend,
    }: ClaimParams): Promise<string> => {
      const { transaction: txBase64 } = await apiClient.post<ClaimResponse>(
        `/api/vaults/${vaultId}/claim`,
        { signerPublicKey },
      );

      const transaction = Transaction.from(Buffer.from(txBase64, "base64"));

      const connection = new Connection(SOLANA_RPC_URL);
      const result = await signAndSend(transaction, connection, {
        skipPreflight: true,
      });

      return result.signature;
    },
  });
}
