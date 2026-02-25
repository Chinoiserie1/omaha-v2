import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import type { VaultPerformancePeriod, VaultPerformanceResponse } from "@repo/shared";

export function useVaultPerformance(
  vaultId: string,
  period: VaultPerformancePeriod,
  maxPoints?: number,
) {
  const qs = maxPoints
    ? `period=${period}&maxPoints=${maxPoints}`
    : `period=${period}`;

  return useQuery({
    queryKey: queryKeys.vaults.performance(vaultId, period),
    queryFn: () =>
      apiClient.get<VaultPerformanceResponse>(
        `/api/vaults/${vaultId}/performance?${qs}`,
      ),
    enabled: !!vaultId,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
