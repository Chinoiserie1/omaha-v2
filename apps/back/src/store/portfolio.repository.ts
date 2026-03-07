import { prisma } from "@repo/database";
import type { PortfolioSnapshot, Prisma } from "@repo/database";

export async function createSnapshot(data: {
  quantId: string;
  thesisSummary: string;
  allocations: Prisma.InputJsonValue;
  changes: string[];
  sourceTweetIds: string[];
  createdAt?: Date;
}): Promise<PortfolioSnapshot> {
  return prisma.portfolioSnapshot.create({ data });
}

export async function findLatestSnapshot(
  quantId: string
): Promise<PortfolioSnapshot | null> {
  return prisma.portfolioSnapshot.findFirst({
    where: { quantId },
    orderBy: { createdAt: "desc" },
  });
}

export async function findEarliestSnapshot(
  quantId: string
): Promise<PortfolioSnapshot | null> {
  return prisma.portfolioSnapshot.findFirst({
    where: { quantId },
    orderBy: { createdAt: "asc" },
  });
}

export async function deleteAllSnapshots(quantId: string): Promise<number> {
  const result = await prisma.portfolioSnapshot.deleteMany({ where: { quantId } });
  return result.count;
}

export async function findSnapshotHistory(
  quantId: string,
  limit = 50
): Promise<PortfolioSnapshot[]> {
  return prisma.portfolioSnapshot.findMany({
    where: { quantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
