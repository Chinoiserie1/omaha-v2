import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import type { WithdrawalRequest } from "@repo/shared";

export function useRetryWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (withdrawalId: string): Promise<WithdrawalRequest> => {
      return apiClient.post<WithdrawalRequest>(
        `/api/withdrawals/${withdrawalId}/retry`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.withdrawals.all(),
      });
    },
  });
}
