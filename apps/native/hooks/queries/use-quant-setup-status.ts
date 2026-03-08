import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

export type SetupStatus =
  | "pending"
  | "syncing_profile"
  | "fetching_tweets"
  | "classifying"
  | "synthesizing"
  | "complete"
  | "failed";

interface SetupStatusData {
  status: SetupStatus;
  error?: string;
}

export function useQuantSetupStatus(
  quantId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.quant.setupStatus(quantId ?? ""),
    queryFn: () =>
      apiClient.get<SetupStatusData>(
        `/api/quants/${quantId}/setup-status`,
      ),
    enabled: !!quantId && enabled,
    refetchInterval: enabled ? 3000 : false,
  });
}
