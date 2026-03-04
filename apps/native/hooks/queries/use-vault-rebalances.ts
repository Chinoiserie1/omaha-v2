import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";

interface RebalanceTweet {
  tweetId: string;
  fullText: string;
  postedAt: string;
  favoriteCount: number;
  retweetCount: number;
  replyCount: number;
  bookmarkCount: number;
  viewsCount: number;
}

interface RebalanceTopTweet {
  id: string;
  assets: string[];
  impactType: string;
  conviction: string;
  sentiment: string;
  significanceScore: number;
  tweet: RebalanceTweet;
}

interface RebalanceSnapshot {
  id: string;
  thesisSummary: string;
  changes: string[];
  createdAt: string;
  topTweet: RebalanceTopTweet | null;
}

export interface RebalanceWithSnapshot {
  id: string;
  status: string;
  sellCount: number;
  buyCount: number;
  totalSwaps: number;
  vaultEquityUsd: number | null;
  startedAt: string;
  completedAt: string | null;
  snapshot: RebalanceSnapshot;
}

export function useVaultRebalances(vaultId: string, limit = 10) {
  return useQuery({
    queryKey: queryKeys.vaults.rebalances(vaultId),
    queryFn: () =>
      apiClient.get<RebalanceWithSnapshot[]>(
        `/api/vaults/${vaultId}/rebalances?limit=${limit}`,
      ),
    enabled: !!vaultId,
  });
}
