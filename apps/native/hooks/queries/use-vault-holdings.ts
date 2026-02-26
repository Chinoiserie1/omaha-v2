import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import type { VaultHoldingsResponse } from "@repo/shared";

export function useVaultHoldings(vaultId: string) {
  return useQuery({
    queryKey: queryKeys.vaults.holdings(vaultId),
    queryFn: () =>
      apiClient.get<VaultHoldingsResponse>(
        `/api/vaults/${vaultId}/holdings`,
      ),
    enabled: !!vaultId,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
}
