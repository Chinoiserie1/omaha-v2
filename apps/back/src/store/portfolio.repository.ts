import { prisma } from "@repo/database";
import type { PortfolioSnapshot, Prisma } from "@repo/database";

export async function createSnapshot(data: {
  kolId: string;
  thesisSummary: string;
  allocations: Prisma.InputJsonValue;
  changes: string[];
  sourceTweetIds: string[];
  createdAt?: Date;
}): Promise<PortfolioSnapshot> {
  return prisma.portfolioSnapshot.create({ data });
}

export async function findLatestSnapshot(
  kolId: string
): Promise<PortfolioSnapshot | null> {
  return prisma.portfolioSnapshot.findFirst({
    where: { kolId },
    orderBy: { createdAt: "desc" },
  });
}

export async function findSnapshotHistory(
  kolId: string,
  limit = 50
): Promise<PortfolioSnapshot[]> {
  return prisma.portfolioSnapshot.findMany({
    where: { kolId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
