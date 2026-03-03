import { prisma } from "@repo/database";
import type { RebalanceEvent, Prisma } from "@repo/database";

export async function createEvent(data: {
  kolVaultId: string;
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

export async function findByKolVault(
  kolVaultId: string,
  limit = 20
): Promise<RebalanceEvent[]> {
  return prisma.rebalanceEvent.findMany({
    where: { kolVaultId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

export async function findLatestByKolVault(
  kolVaultId: string
): Promise<RebalanceEvent | null> {
  return prisma.rebalanceEvent.findFirst({
    where: { kolVaultId },
    orderBy: { startedAt: "desc" },
  });
}

export async function findByVaultWithSnapshots(
  kolVaultId: string,
  limit = 10
) {
  return prisma.rebalanceEvent.findMany({
    where: { kolVaultId },
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
