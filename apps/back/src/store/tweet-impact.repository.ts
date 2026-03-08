import { prisma } from "@repo/database";
import type { Prisma } from "@repo/database";

export async function findTrendingAssets(limit: number, dayWindow = 7) {
  const since = new Date();
  since.setDate(since.getDate() - dayWindow);

  const rows = await prisma.$queryRaw<
    { asset: string; signal_count: bigint; quant_count: bigint; latest_signal_at: Date }[]
  >`
    SELECT
      asset,
      COUNT(*)::bigint AS signal_count,
      COUNT(DISTINCT "quantId")::bigint AS quant_count,
      MAX("createdAt") AS latest_signal_at
    FROM "TweetImpact", unnest(assets) AS asset
    WHERE "createdAt" >= ${since}
    GROUP BY asset
    ORDER BY signal_count DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    asset: r.asset,
    signalCount: Number(r.signal_count),
    quantCount: Number(r.quant_count),
    latestSignalAt: r.latest_signal_at,
  }));
}

export async function createTweetImpacts(
  data: Prisma.TweetImpactCreateManyInput[]
) {
  return prisma.tweetImpact.createMany({
    data,
    skipDuplicates: true,
  });
}

export async function findSignificantTweets({
  quantId,
  limit,
  offset,
  asset,
  impactType,
  minScore,
}: {
  quantId: string;
  limit: number;
  offset: number;
  asset?: string | undefined;
  impactType?: string | undefined;
  minScore?: number | undefined;
}) {
  const where: Prisma.TweetImpactWhereInput = { quantId };

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

export async function findSignificantTweetsCrossQuant({
  asset,
  limit,
}: {
  asset: string;
  limit: number;
}) {
  const overFetchLimit = limit * 3;

  const [impacts, total] = await Promise.all([
    prisma.tweetImpact.findMany({
      where: { assets: { has: asset } },
      orderBy: { significanceScore: "desc" },
      take: overFetchLimit,
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
        quant: {
          select: {
            id: true,
            user: {
              select: {
                twitterUsername: true,
                profileImageUrl: true,
                twitterFollowerCount: true,
              },
            },
          },
        },
      },
    }),
    prisma.tweetImpact.count({ where: { assets: { has: asset } } }),
  ]);

  return { impacts, total };
}
