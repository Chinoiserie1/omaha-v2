export interface Tweet {
  id: string;
  tweetId: string;
  kolId: string;
  fullText: string;
  postedAt: Date;
  favoriteCount: number;
  retweetCount: number;
  replyCount: number;
  bookmarkCount: number;
  viewsCount: number;
  isRetweet: boolean;
  isReply: boolean;
  isThread: boolean;
  conversationId: string | null;
  rawJson: unknown;
  createdAt: Date;
  fetchedAt: Date;
}

export interface ClassifiedTweet {
  id: string;
  tweetId: string;
  category: string;
  assets: string[];
  sentiment: string | null;
  conviction: string | null;
  rawLlmResponse: unknown;
  classifiedAt: Date;
}
