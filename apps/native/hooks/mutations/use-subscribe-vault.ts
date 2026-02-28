import { useMutation } from "@tanstack/react-query";
import { Transaction, Connection, type SendOptions } from "@solana/web3.js";
import { Buffer } from "buffer";
import { apiClient } from "../../lib/api-client";
import { SOLANA_RPC_URL } from "../../lib/solana";

interface SubscribeParams {
  vaultId: string;
  amount: number;
  signerPublicKey: string;
  signAndSend: (
    transaction: Transaction,
    connection: Connection,
    options?: SendOptions,
  ) => Promise<{ signature: string }>;
}

interface SubscribeResponse {
  transaction: string;
}

export function useSubscribeVault() {
  return useMutation({
    mutationFn: async ({
      vaultId,
      amount,
      signerPublicKey,
      signAndSend,
    }: SubscribeParams): Promise<string> => {
      // Step 1: Build unsigned transaction on backend
      const { transaction: txBase64 } = await apiClient.post<SubscribeResponse>(
        `/api/vaults/${vaultId}/subscribe`,
        { amount, signerPublicKey },
      );

      console.log("[useSubscribeVault] Transaction:", txBase64);

      // Step 2: Deserialize the unsigned transaction
      const transaction = Transaction.from(Buffer.from(txBase64, "base64"));

      console.log(
        "[useSubscribeVault] Transaction:",
        JSON.stringify(transaction, null, 2),
      );

      // Step 3: Sign and send via Privy, skipping preflight simulation.
      // Privy's internal RPC may not recognize the blockhash from our backend's RPC,
      // causing "Blockhash not found" during simulation. skipPreflight bypasses
      // simulation and sends directly to the leader.
      const connection = new Connection(SOLANA_RPC_URL);
      const result = await signAndSend(transaction, connection, {
        skipPreflight: true,
      });

      return result.signature;
    },
  });
}
