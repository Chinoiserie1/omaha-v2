import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { VaultFavoriteStatus } from "@repo/shared";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

export function useToggleVaultFavorite(vaultId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.vaults.favoriteStatus(vaultId);

  return useMutation({
    mutationFn: () =>
      apiClient.post<VaultFavoriteStatus>(`/api/vaults/${vaultId}/favorite`),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });

      const previous =
        queryClient.getQueryData<VaultFavoriteStatus>(queryKey);

      queryClient.setQueryData<VaultFavoriteStatus>(queryKey, (old) => ({
        isFavorited: !old?.isFavorited,
      }));

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
