import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

interface ReconcileParams {
  vaultId: string;
  walletAddress: string;
}

export function useReconcileWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vaultId, walletAddress }: ReconcileParams) =>
      apiClient.post(`/api/withdrawals/${vaultId}/reconcile`, {
        walletAddress,
      }),
    onSuccess: (_data, { vaultId, walletAddress }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.withdrawals.all() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.vaults.investorStatus(vaultId, walletAddress),
      });
    },
  });
}
