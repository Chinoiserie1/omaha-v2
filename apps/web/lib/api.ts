const API_BASE =
  process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4001";

// --- Response interfaces ---

export interface KolItem {
  id: string;
  username: string;
  displayName: string | null;
  restId: string | null;
  followersCount: number | null;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  lastFetchedAt: string | null;
  tweetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TweetData {
  tweetId: string;
  fullText: string;
  postedAt: string;
  favoriteCount: number;
  retweetCount: number;
  replyCount: number;
  bookmarkCount: number;
  viewsCount: number;
}

export interface SignificantTweetItem {
  id: string;
  kolId: string;
  tweetId: string;
  snapshotId: string;
  assets: string[];
  impactType: string;
  allocationDelta: number;
  conviction: string;
  sentiment: string;
  category: string;
  engagementScore: number;
  significanceScore: number;
  tweet: TweetData;
}

export interface SignificantTweetsResponse {
  kolId: string;
  username: string;
  significantTweets: SignificantTweetItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface Allocation {
  asset: string;
  mint?: string;
  percentage: number;
  conviction: "low" | "medium" | "high" | "stale";
  reasoning: string;
  since: string;
  lastSignal: string;
}

export interface PortfolioSnapshot {
  id: string;
  kolId: string;
  thesisSummary: string;
  allocations: Allocation[];
  changes: string[];
  sourceTweetIds: string[];
  createdAt: string;
}

export interface PortfolioResponse {
  kolId: string;
  username: string;
  snapshot: PortfolioSnapshot;
}

export interface PeriodResult {
  fromSnapshotId: string;
  toSnapshotId: string;
  fromDate: string;
  toDate: string;
  periodReturn: number;
  cumulativeValue: number;
  periodDays: number;
  details: Record<
    string,
    {
      weight: number;
      priceFrom: number | null;
      priceTo: number | null;
      assetReturn: number;
    }
  >;
}

export interface BacktestResult {
  kolId: string;
  snapshotCount: number;
  periods: PeriodResult[];
  totalReturn: number;
  latestCumulativeValue: number;
}

// --- Fetch helpers ---

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

export function fetchKols(): Promise<KolItem[]> {
  return apiFetch<KolItem[]>("/api/kols");
}

export function fetchSignificantTweets(
  kolId: string,
  limit = 10,
): Promise<SignificantTweetsResponse> {
  return apiFetch<SignificantTweetsResponse>(
    `/api/kols/${kolId}/tweets/significant?limit=${limit}`,
  );
}

export function fetchPortfolio(kolId: string): Promise<PortfolioResponse> {
  return apiFetch<PortfolioResponse>(`/api/kols/${kolId}/portfolio`);
}

export function fetchBacktest(kolId: string): Promise<BacktestResult> {
  return apiFetch<BacktestResult>(`/api/kols/${kolId}/backtest`);
}
