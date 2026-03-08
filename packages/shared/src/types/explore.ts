export interface ExploreSignal {
  quant: {
    id: string;
    username: string | null;
    avatarUrl: string | null;
    followerCount: number | null;
  };
  tweet: {
    tweetId: string;
    fullText: string;
    postedAt: string;
    favoriteCount: number;
    retweetCount: number;
    replyCount: number;
    viewsCount: number | null;
  };
  impact: {
    assets: string[];
    conviction: string;
    sentiment: string;
    impactType: string;
    category: string;
    allocationDelta: number;
    significanceScore: number;
  };
  popularityScore: number;
}

export interface ExploreSearchResponse {
  results: ExploreSignal[];
  total: number;
  asset: string;
  limit: number;
  offset: number;
}

export interface AssetSuggestion {
  symbol: string;
  name: string;
  category: string;
}

export interface TrendingAsset {
  symbol: string;
  name: string;
  category: string;
  signalCount: number;
  quantCount: number;
  latestSignalAt: string;
}

export interface TrendingQuant {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  followerCount: number;
  signalCount: number;
  vaultId: string | null;
}

export interface ExploreTrendingResponse {
  trendingAssets: TrendingAsset[];
  topQuants: TrendingQuant[];
}
