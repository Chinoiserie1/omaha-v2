import { useMutation } from "@tanstack/react-query";
import { Transaction, Connection, type SendOptions } from "@solana/web3.js";
import { Buffer } from "buffer";
import { apiClient } from "../../lib/api-client";

const RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

interface RedeemParams {
  vaultId: string;
  amount: number;
  signerPublicKey: string;
  signAndSend: (
    transaction: Transaction,
    connection: Connection,
    options?: SendOptions,
  ) => Promise<{ signature: string }>;
}

interface RedeemResponse {
  transaction: string;
}

export function useRedeemVault() {
  return useMutation({
    mutationFn: async ({
      vaultId,
      amount,
      signerPublicKey,
      signAndSend,
    }: RedeemParams): Promise<string> => {
      // Step 1: Build unsigned transaction on backend
      const { transaction: txBase64 } = await apiClient.post<RedeemResponse>(
        `/api/vaults/${vaultId}/redeem`,
        { amount, signerPublicKey },
      );

      // Step 2: Deserialize the unsigned transaction
      const transaction = Transaction.from(Buffer.from(txBase64, "base64"));

      // Step 3: Sign and send via Privy, skipping preflight simulation.
      const connection = new Connection(RPC_URL);
      const result = await signAndSend(transaction, connection, {
        skipPreflight: true,
      });

      return result.signature;
    },
  });
}
