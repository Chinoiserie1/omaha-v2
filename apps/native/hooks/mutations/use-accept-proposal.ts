import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

interface ProposalPayload {
  thesisSummary: string;
  allocations: Array<{
    asset: string;
    percentage: number;
    conviction: string;
    reasoning: string;
    since: string;
    lastSignal: string;
  }>;
  changes: string[];
}

interface AcceptProposalResponse {
  snapshotId: string;
  rebalanceTriggered: boolean;
}

export function useAcceptProposal(quantId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProposalPayload) =>
      apiClient.post<AcceptProposalResponse>(
        `/api/quants/${quantId}/accept-proposal`,
        payload,
      ),
    onSuccess: () => {
      if (quantId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.quant.portfolio(quantId),
        });
      }
    },
  });
}
