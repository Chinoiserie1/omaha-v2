import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Transaction, Connection, type SendOptions } from "@solana/web3.js";
import { Buffer } from "buffer";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import { SOLANA_RPC_URL } from "../../lib/solana";
import { waitForConfirmation } from "../../lib/confirm-transaction";

interface RequestWithdrawalParams {
  vaultId: string;
  amount: number;
  signerPublicKey: string;
  signAndSend: (
    transaction: Transaction,
    connection: Connection,
    options?: SendOptions,
  ) => Promise<{ signature: string }>;
}

interface RequestResponse {
  transaction: string;
  withdrawalId: string;
}

/**
 * Request a withdrawal: backend builds unsigned queuedRedeem tx,
 * user signs via Privy, submits to Solana, then confirms with backend.
 */
export function useRequestWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vaultId,
      amount,
      signerPublicKey,
      signAndSend,
    }: RequestWithdrawalParams): Promise<{ withdrawalId: string }> => {
      // Step 1: Build unsigned tx on backend (creates DB record)
      const { transaction: txBase64, withdrawalId } =
        await apiClient.post<RequestResponse>(
          `/api/withdrawals/${vaultId}/request`,
          { amount, signerPublicKey },
        );

      // Step 2: Deserialize and sign+send via Privy
      const transaction = Transaction.from(Buffer.from(txBase64, "base64"));
      const connection = new Connection(SOLANA_RPC_URL);
      const { signature } = await signAndSend(transaction, connection, {
        skipPreflight: true,
      });

      // Step 2.5: Poll signature status until confirmed (resilient to devnet drops)
      await waitForConfirmation(connection, signature);

      // Step 3: Confirm the redeem tx with backend → REQUESTED → PROCESSING
      await apiClient.post(
        `/api/withdrawals/${withdrawalId}/confirm-redeem`,
        { txSignature: signature },
      );

      return { withdrawalId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.withdrawals.all() });
    },
  });
}
