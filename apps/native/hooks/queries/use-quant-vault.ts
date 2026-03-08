import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

interface VaultData {
  id: string;
  quantId: string;
  statePda: string;
  vaultName: string;
  vaultSymbol: string;
  isActive: boolean;
  lastRebalancedAt: string | null;
}

export function useQuantVault(quantId: string | null) {
  return useQuery({
    queryKey: queryKeys.quant.vault(quantId ?? ""),
    queryFn: () =>
      apiClient.get<VaultData | null>(`/api/quants/${quantId}/vault`),
    enabled: !!quantId,
  });
}
