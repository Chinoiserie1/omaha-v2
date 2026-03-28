import { prisma } from "@repo/database";
import type { RebalanceEvent, Prisma } from "@repo/database";

export async function createEvent(data: {
  vaultId: string;
  snapshotId: string;
  status: string;
  vaultEquityUsd?: number;
}): Promise<RebalanceEvent> {
  return prisma.rebalanceEvent.create({ data });
}

export async function completeEvent(
  id: string,
  data: {
    status: string;
    sellCount?: number;
    buyCount?: number;
    totalSwaps?: number;
    swapDetails?: Prisma.InputJsonValue;
    errorMessage?: string;
  }
): Promise<RebalanceEvent> {
  return prisma.rebalanceEvent.update({
    where: { id },
    data: { ...data, completedAt: new Date() },
  });
}

export async function findByVault(
  vaultId: string,
  limit = 20
): Promise<RebalanceEvent[]> {
  return prisma.rebalanceEvent.findMany({
    where: { vaultId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

export async function findLatestByVault(
  vaultId: string
): Promise<RebalanceEvent | null> {
  return prisma.rebalanceEvent.findFirst({
    where: { vaultId },
    orderBy: { startedAt: "desc" },
  });
}

export async function findByVaultWithSnapshots(
  vaultId: string,
  limit = 10
) {
  return prisma.rebalanceEvent.findMany({
    where: { vaultId },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      snapshot: {
        select: {
          id: true,
          thesisSummary: true,
          changes: true,
          createdAt: true,
          tweetImpacts: {
            orderBy: { significanceScore: "desc" },
            take: 1,
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
          },
        },
      },
    },
  });
}

const snapshotInclude = {
  snapshot: {
    select: {
      id: true,
      thesisSummary: true,
      changes: true,
      createdAt: true,
      tweetImpacts: {
        orderBy: { significanceScore: "desc" as const },
        take: 1,
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
      },
    },
  },
};

export async function findByVaultWithSnapshotsPaginated(
  vaultId: string,
  skip: number,
  take: number,
) {
  const where = { vaultId };
  const [events, total] = await Promise.all([
    prisma.rebalanceEvent.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip,
      take,
      include: snapshotInclude,
    }),
    prisma.rebalanceEvent.count({ where }),
  ]);
  return { events, total };
}
