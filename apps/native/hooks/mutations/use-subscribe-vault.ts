import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Transaction, Connection, type SendOptions } from "@solana/web3.js";
import { Buffer } from "buffer";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import { SOLANA_RPC_URL } from "../../lib/solana";
import Toast from "react-native-toast-message";

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

/**
 * Subscribe (invest) in a vault: backend builds unsigned deposit tx,
 * user signs via Privy, submits to Solana, waits for on-chain confirmation,
 * then confirms with backend to trigger rebalancing.
 */
export function useSubscribeVault() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vaultId,
      amount,
      signerPublicKey,
      signAndSend,
    }: SubscribeParams): Promise<{
      signature: string;
      vaultId: string;
      signerPublicKey: string;
    }> => {
      // Step 1: Build unsigned transaction on backend
      const { transaction: txBase64 } = await apiClient.post<SubscribeResponse>(
        `/api/vaults/${vaultId}/subscribe`,
        { amount, signerPublicKey },
      );

      // Step 2: Deserialize the unsigned transaction
      const transaction = Transaction.from(Buffer.from(txBase64, "base64"));

      // Step 3: Sign and send via Privy, skipping preflight simulation.
      // Privy's internal RPC may not recognize the blockhash from our backend's RPC,
      // causing "Blockhash not found" during simulation. skipPreflight bypasses
      // simulation and sends directly to the leader.
      const connection = new Connection(SOLANA_RPC_URL);
      const { signature } = await signAndSend(transaction, connection, {
        skipPreflight: true,
      });

      // Step 4: Wait for on-chain confirmation before notifying backend
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );

      // Step 5: Confirm the deposit with backend → triggers rebalancing
      // On-chain deposit already succeeded, so catch backend errors separately
      try {
        await apiClient.post(`/api/vaults/${vaultId}/confirm-subscribe`, {
          txSignature: signature,
        });
      } catch {
        Toast.show({
          type: "error",
          text1: "Deposit Failed",
          text2: "Please try again",
        });
      }

      return { signature, vaultId, signerPublicKey };
    },
    onSuccess: ({ vaultId, signerPublicKey, signature }) => {
      Toast.show({
        type: "success",
        text1: "Investment Successful",
        text2: `Tx: ${signature.slice(0, 8)}...${signature.slice(-8)}`,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vaults.investorStatus(vaultId, signerPublicKey),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vaults.holdings(vaultId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vaults.detail(vaultId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.wallet.portfolio(signerPublicKey),
      });
    },
  });
}
