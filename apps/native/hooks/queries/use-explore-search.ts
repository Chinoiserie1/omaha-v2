import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { queryKeys } from "../../lib/query-keys";
import type { ExploreSearchResponse, AssetSuggestion } from "@repo/shared";

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
