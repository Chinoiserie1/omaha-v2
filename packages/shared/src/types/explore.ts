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
