import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import type { WalletPortfolio } from "@repo/shared";

export function useWalletPortfolio(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.wallet.portfolio(address ?? ""),
    queryFn: () =>
      apiClient.get<WalletPortfolio>(`/api/wallet/portfolio/${address}`),
    enabled: !!address,
    refetchInterval: 60_000,
  });
}
