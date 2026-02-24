import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

interface PendingRequest {
  type: "SUBSCRIPTION" | "REDEMPTION";
  amount: number;
  createdAt: number;
}

export interface InvestorStatus {
  sharePrice: number | null;
  pendingRequest: PendingRequest | null;
  redeemNoticePeriod: number;
}

export function useInvestorStatus(vaultId: string, wallet: string | undefined) {
  return useQuery({
    queryKey: queryKeys.vaults.investorStatus(vaultId, wallet ?? ""),
    queryFn: () =>
      apiClient.get<InvestorStatus>(
        `/api/vaults/${vaultId}/investor-status?wallet=${wallet}`,
      ),
    enabled: !!vaultId && !!wallet,
    refetchInterval: 30_000,
  });
}
