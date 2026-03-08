import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiError } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import type { Allocation } from "@repo/shared";

interface SnapshotData {
  id: string;
  quantId: string;
  thesisSummary: string;
  allocations: Allocation[];
  changes: string[];
  createdAt: string;
}

interface PortfolioApiResponse {
  quantId: string;
  username: string | null;
  snapshot: SnapshotData;
}

export function useQuantPortfolio(quantId: string | null) {
  return useQuery({
    queryKey: queryKeys.quant.portfolio(quantId ?? ""),
    queryFn: async () => {
      try {
        const raw = await apiClient.get<PortfolioApiResponse>(
          `/api/quants/${quantId}/portfolio`,
        );
        return raw.snapshot;
      } catch (err) {
        // 404 = no snapshot yet, return null instead of throwing
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: !!quantId,
  });
}
