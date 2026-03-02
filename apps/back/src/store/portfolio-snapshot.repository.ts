import { prisma, type Prisma } from "@repo/database";

interface SnapshotHolding {
  mint: string;
  symbol: string;
  amount: number;
  usdPrice: number;
  valueUsd: number;
}

export async function createSnapshot(
  walletAddress: string,
  totalValueUsd: number,
  holdings: SnapshotHolding[],
): Promise<{ id: string }> {
  return prisma.portfolioValueSnapshot.create({
    data: {
      walletAddress,
      totalValueUsd,
      holdings: holdings as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
}

export async function getLatestSnapshot(
  walletAddress: string,
): Promise<{
  totalValueUsd: number;
  holdings: unknown;
  snapshotDate: Date;
} | null> {
  return prisma.portfolioValueSnapshot.findFirst({
    where: { walletAddress },
    orderBy: { snapshotDate: "desc" },
    select: { totalValueUsd: true, holdings: true, snapshotDate: true },
  });
}

export async function getChartHistory(
  walletAddress: string,
  since: Date,
  maxPoints?: number,
): Promise<{ totalValueUsd: number; snapshotDate: Date }[]> {
  if (!maxPoints || maxPoints <= 0) {
    return prisma.portfolioValueSnapshot.findMany({
      where: { walletAddress, snapshotDate: { gte: since } },
      orderBy: { snapshotDate: "asc" },
      select: { totalValueUsd: true, snapshotDate: true },
    });
  }

  return prisma.$queryRaw<{ totalValueUsd: number; snapshotDate: Date }[]>`
    WITH numbered AS (
      SELECT "totalValueUsd", "snapshotDate",
             ROW_NUMBER() OVER (ORDER BY "snapshotDate") AS rn,
             COUNT(*) OVER () AS total
      FROM "PortfolioValueSnapshot"
      WHERE "walletAddress" = ${walletAddress} AND "snapshotDate" >= ${since}
    )
    SELECT "totalValueUsd", "snapshotDate"
    FROM numbered
    WHERE total <= ${maxPoints}
       OR rn % GREATEST(total / ${maxPoints}, 1) = 0
       OR rn = total
    ORDER BY "snapshotDate"
  `;
}
