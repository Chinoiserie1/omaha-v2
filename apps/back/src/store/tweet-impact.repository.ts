import { prisma } from "@repo/database";
import type { Prisma } from "@repo/database";

export async function createTweetImpacts(
  data: Prisma.TweetImpactCreateManyInput[]
) {
  return prisma.tweetImpact.createMany({
    data,
    skipDuplicates: true,
  });
}

export async function findSignificantTweets({
  kolId,
  limit,
  offset,
  asset,
  impactType,
  minScore,
}: {
  kolId: string;
  limit: number;
  offset: number;
  asset?: string | undefined;
  impactType?: string | undefined;
  minScore?: number | undefined;
}) {
  const where: Prisma.TweetImpactWhereInput = { kolId };

  if (asset) {
    where.assets = { has: asset };
  }
  if (impactType) {
    where.impactType = impactType;
  }
  if (minScore !== undefined) {
    where.significanceScore = { gte: minScore };
  }

  const [impacts, total] = await Promise.all([
    prisma.tweetImpact.findMany({
      where,
      orderBy: { significanceScore: "desc" },
      take: limit,
      skip: offset,
      include: {
        tweet: {
          select: {
            tweetId: true,
            fullText: true,
            postedAt: true,
            favoriteCount: true,
            retweetCount: true,
            replyCount: true,
            bookmarkCount: true,
            viewsCount: true,
          },
        },
      },
    }),
    prisma.tweetImpact.count({ where }),
  ]);

  return { impacts, total };
}
