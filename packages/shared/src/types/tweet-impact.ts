export type ImpactType =
  | "new_position"
  | "increase"
  | "decrease"
  | "exit"
  | "reinforcement";

export interface TweetImpact {
  id: string;
  tweetId: string;
  kolId: string;
  snapshotId: string;
  assets: string[];
  impactType: ImpactType;
  allocationDelta: number;
  conviction: string;
  sentiment: string;
  category: string;
  engagementScore: number;
  significanceScore: number;
  createdAt: Date;
}

export interface SignificantTweet {
  id: string;
  tweetId: string;
  assets: string[];
  impactType: ImpactType;
  allocationDelta: number;
  conviction: string;
  sentiment: string;
  category: string;
  engagementScore: number;
  significanceScore: number;
  createdAt: Date;
  tweet: {
    tweetId: string;
    fullText: string;
    postedAt: Date;
    favoriteCount: number;
    retweetCount: number;
    replyCount: number;
    bookmarkCount: number;
    viewsCount: number;
  };
}
