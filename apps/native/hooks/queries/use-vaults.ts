import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

interface Allocation {
  asset: string;
  percentage: number;
}

interface VaultSummary {
  id: string;
  name: string;
  description: string;
  kolUsername: string;
  portfolio: {
    allocations: Allocation[];
  } | null;
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

export function useVaults() {
  return useQuery({
    queryKey: queryKeys.vaults.all(),
    queryFn: () => apiClient.get<VaultSummary[]>("/api/vaults"),
  });
}

export function useVault(id: string) {
  return useQuery({
    queryKey: queryKeys.vaults.detail(id),
    queryFn: () => apiClient.get<VaultData>(`/api/vaults/${id}`),
    enabled: !!id,
  });
}
