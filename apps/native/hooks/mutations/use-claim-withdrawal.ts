import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Transaction, Connection, type SendOptions } from "@solana/web3.js";
import { Buffer } from "buffer";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import { SOLANA_RPC_URL } from "../../lib/solana";
import { waitForConfirmation } from "../../lib/confirm-transaction";

interface ClaimWithdrawalParams {
  withdrawalId: string;
  signerPublicKey: string;
  signAndSend: (
    transaction: Transaction,
    connection: Connection,
    options?: SendOptions,
  ) => Promise<{ signature: string }>;
}

type ClaimResponse =
  | { transaction: string; withdrawalId: string; alreadyClaimed?: never }
  | { withdrawalId: string; status: string; alreadyClaimed: true; transaction?: never };

export function useClaimWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      withdrawalId,
      signerPublicKey,
      signAndSend,
    }: ClaimWithdrawalParams): Promise<string> => {
      // Step 1: Get unsigned claim tx from backend
      const response = await apiClient.post<ClaimResponse>(
        `/api/withdrawals/${withdrawalId}/claim`,
        { signerPublicKey },
      );

      // Backend auto-recovered: claim was already consumed on-chain
      if (response.alreadyClaimed) {
        return "already_claimed";
      }

      const txBase64 = response.transaction;

      // Step 2: Deserialize
      const transaction = Transaction.from(Buffer.from(txBase64, "base64"));

      // Step 3: User signs + sends via Privy
      const connection = new Connection(SOLANA_RPC_URL);
      const result = await signAndSend(transaction, connection, {
        skipPreflight: true,
      });

      // Step 3.5: Poll signature status until confirmed (resilient to devnet drops)
      await waitForConfirmation(connection, result.signature);

      // Step 4: Confirm claim on backend
      await apiClient.post(
        `/api/withdrawals/${withdrawalId}/confirm-claim`,
        { txSignature: result.signature },
      );

      return result.signature;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.withdrawals.all(),
      });
    },
  });
}
