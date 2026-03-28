import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import type { PaginatedRebalances } from "./use-vault-rebalances";

const PAGE_SIZE = 10;

export function useInfiniteVaultRebalances(vaultId: string) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.vaults.rebalances(vaultId), "infinite"],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        page: String(pageParam),
        pageSize: String(PAGE_SIZE),
      });
      return apiClient.get<PaginatedRebalances>(
        `/api/vaults/${vaultId}/rebalances?${params.toString()}`,
      );
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: !!vaultId,
  });
}
