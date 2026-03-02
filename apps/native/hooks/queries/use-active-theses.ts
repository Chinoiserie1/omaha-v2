import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import type { ActiveThesisItem } from "@repo/shared";

export function useActiveTheses(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.wallet.activeTheses(address ?? ""),
    queryFn: () =>
      apiClient.get<ActiveThesisItem[]>(
        `/api/wallet/portfolio/${address}/active-theses`,
      ),
    enabled: !!address,
    refetchInterval: 60_000,
  });
}
