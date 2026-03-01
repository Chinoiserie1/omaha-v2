import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import type { WithdrawalRequest } from "@repo/shared";

export function useWithdrawals() {
  return useQuery({
    queryKey: queryKeys.withdrawals.all(),
    queryFn: () => apiClient.get<WithdrawalRequest[]>("/api/withdrawals"),
    refetchInterval: 30_000,
  });
}

export function useWithdrawalStatus(withdrawalId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.withdrawals.detail(withdrawalId ?? ""),
    queryFn: () =>
      apiClient.get<WithdrawalRequest>(
        `/api/withdrawals/${withdrawalId}/status`,
      ),
    enabled: !!withdrawalId,
    refetchInterval: 10_000,
  });
}
