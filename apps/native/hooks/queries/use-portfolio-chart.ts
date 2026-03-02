import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import type {
  PortfolioChartPeriod,
  PortfolioChartResponse,
} from "@repo/shared";

export function usePortfolioChart(
  address: string | undefined,
  period: PortfolioChartPeriod,
  maxPoints?: number,
) {
  const qs = maxPoints
    ? `period=${period}&maxPoints=${maxPoints}`
    : `period=${period}`;

  return useQuery({
    queryKey: queryKeys.wallet.portfolioChart(address ?? "", period),
    queryFn: () =>
      apiClient.get<PortfolioChartResponse>(
        `/api/wallet/portfolio/${address}/chart?${qs}`,
      ),
    enabled: !!address,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
