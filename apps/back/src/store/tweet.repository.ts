import { prisma } from "@repo/database";
import type { Tweet, Prisma } from "@repo/database";

export interface CreateTweetInput {
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
  isThread?: boolean;
  conversationId?: string | undefined;
  rawJson?: unknown;
}

export async function upsertTweet(input: CreateTweetInput): Promise<Tweet> {
  const createData: {
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
    rawJson?: Prisma.InputJsonValue;
  } = {
    tweetId: input.tweetId,
    kolId: input.kolId,
    fullText: input.fullText,
    postedAt: input.postedAt,
    favoriteCount: input.favoriteCount,
    retweetCount: input.retweetCount,
    replyCount: input.replyCount,
    bookmarkCount: input.bookmarkCount,
    viewsCount: input.viewsCount,
    isRetweet: input.isRetweet,
    isReply: input.isReply,
    isThread: input.isThread ?? false,
    conversationId: input.conversationId ?? null,
  };

  if (input.rawJson !== undefined) {
    createData.rawJson = input.rawJson as Prisma.InputJsonValue;
  }

  return prisma.tweet.upsert({
    where: { tweetId: input.tweetId },
    update: {
      favoriteCount: input.favoriteCount,
      retweetCount: input.retweetCount,
      replyCount: input.replyCount,
      bookmarkCount: input.bookmarkCount,
      viewsCount: input.viewsCount,
      ...(input.isThread !== undefined ? { isThread: input.isThread } : {}),
    },
    create: createData,
  });
}

export interface FindTweetsParams {
  kolId: string;
  limit: number;
  offset: number;
  from?: Date | undefined;
  to?: Date | undefined;
}

export async function findTweetsByKol(
  params: FindTweetsParams
): Promise<{ tweets: Tweet[]; total: number }> {
  const where: {
    kolId: string;
    postedAt?: { gte?: Date; lte?: Date };
  } = { kolId: params.kolId };

  if (params.from || params.to) {
    where.postedAt = {};
    if (params.from) where.postedAt.gte = params.from;
    if (params.to) where.postedAt.lte = params.to;
  }

  const [tweets, total] = await Promise.all([
    prisma.tweet.findMany({
      where,
      orderBy: { postedAt: "desc" },
      take: params.limit,
      skip: params.offset,
    }),
    prisma.tweet.count({ where }),
  ]);

  return { tweets, total };
}

export async function findThreadByConversationId(
  conversationId: string
): Promise<Tweet[]> {
  return prisma.tweet.findMany({
    where: { conversationId },
    orderBy: { postedAt: "asc" },
  });
}
