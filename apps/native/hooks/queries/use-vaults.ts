import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

interface Allocation {
  asset: string;
  percentage: number;
}

export interface VaultSummary {
  id: string;
  name: string;
  description: string;
  kolUsername: string;
  portfolio: {
    allocations: Allocation[];
  } | null;
}

interface PaginatedVaults {
  items: VaultSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface VaultAllocation {
  asset: string;
  mint?: string;
  percentage: number;
  conviction: "low" | "medium" | "high" | "stale";
  reasoning: string;
  since: string;
  lastSignal: string;
}

interface VaultData {
  id: string;
  name: string;
  description: string;
  kolUsername: string;
  kolId: string;
  glamStatePda: string;
  glamVaultPda: string | null;
  mintAddress: string | null;
  isActive: boolean;
  about: string;
  dataSource: string;
  performanceCalc: string;
  disclosure: string;
  kol: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
  };
  portfolio: {
    thesisSummary: string;
    allocations: VaultAllocation[];
    changes: string[];
    updatedAt: string;
  } | null;
}

const VAULTS_PAGE_SIZE = 10;

export function useVaults() {
  return useInfiniteQuery({
    queryKey: queryKeys.vaults.all(),
    queryFn: ({ pageParam }) =>
      apiClient.get<PaginatedVaults>(
        `/api/vaults?page=${pageParam}&pageSize=${VAULTS_PAGE_SIZE}`
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });
}

export function useVault(id: string) {
  return useQuery({
    queryKey: queryKeys.vaults.detail(id),
    queryFn: () => apiClient.get<VaultData>(`/api/vaults/${id}`),
    enabled: !!id,
  });
}
