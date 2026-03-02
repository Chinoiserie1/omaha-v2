import { useQuery } from "@tanstack/react-query";
import type { VaultFavoriteStatus } from "@repo/shared";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import { useAuth } from "../../contexts/auth-context";

export function useVaultFavorite(vaultId: string) {
  const { status } = useAuth();
  const isAuthenticated = status === "authenticated";

  return useQuery({
    queryKey: queryKeys.vaults.favoriteStatus(vaultId),
    queryFn: () =>
      apiClient.get<VaultFavoriteStatus>(`/api/vaults/${vaultId}/favorite`),
    enabled: !!vaultId && isAuthenticated,
  });
}
