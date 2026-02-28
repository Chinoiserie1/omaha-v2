import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import type { WithdrawalRequest } from "@repo/shared";

interface RequestWithdrawalParams {
  vaultId: string;
  amount: number;
  signerPublicKey: string;
}

export function useRequestWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vaultId,
      amount,
      signerPublicKey,
    }: RequestWithdrawalParams): Promise<WithdrawalRequest> => {
      return apiClient.post<WithdrawalRequest>(
        `/api/withdrawals/${vaultId}/request`,
        { amount, signerPublicKey },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.withdrawals.all() });
    },
  });
}
