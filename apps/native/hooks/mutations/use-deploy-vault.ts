import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

interface DeployVaultResponse {
  id: string;
  statePda: string;
  shareMint: string;
  vaultName: string;
  vaultSymbol: string;
  dryRun: boolean;
  txSig: string;
}

export function useDeployVault(quantId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiClient.post<DeployVaultResponse>("/api/vaults", {
        quantId,
        dryRun: false,
      }),
    onSuccess: () => {
      if (quantId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.quant.vault(quantId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.vaults.all(),
      });
    },
  });
}
