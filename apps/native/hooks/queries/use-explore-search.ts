import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import type {
  ExploreSearchResponse,
  AssetSuggestion,
  ExploreTrendingResponse,
} from "@repo/shared";

export function useExploreSearch(asset: string) {
  return useQuery({
    queryKey: queryKeys.explore.search(asset),
    queryFn: () =>
      apiClient.get<ExploreSearchResponse>(
        `/api/explore/search?asset=${encodeURIComponent(asset)}`,
      ),
    enabled: asset.length > 0,
    staleTime: 60_000,
  });
}

export function useAssetAutocomplete(query: string) {
  return useQuery({
    queryKey: queryKeys.explore.assets(query),
    queryFn: () =>
      apiClient.get<AssetSuggestion[]>(
        `/api/explore/assets?q=${encodeURIComponent(query)}`,
      ),
    enabled: query.length >= 1,
    staleTime: 120_000,
  });
}

export function useExploreTrending() {
  return useQuery({
    queryKey: queryKeys.explore.trending(),
    queryFn: () =>
      apiClient.get<ExploreTrendingResponse>("/api/explore/trending"),
    staleTime: 300_000,
  });
}

interface QuantDetail {
  id: string;
  isActive: boolean;
  user: {
    twitterUsername: string | null;
    profileImageUrl: string | null;
    bio: string | null;
    twitterFollowerCount: number | null;
    name: string | null;
  };
  tweets: {
    id: string;
    tweetId: string;
    fullText: string;
    postedAt: string;
    favoriteCount: number;
    retweetCount: number;
    viewsCount: number | null;
  }[];
}

export function useQuantDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.explore.quant(id),
    queryFn: () => apiClient.get<QuantDetail>(`/api/quants/${id}`),
    enabled: id.length > 0,
    staleTime: 120_000,
  });
}
