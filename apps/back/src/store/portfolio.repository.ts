import { prisma } from "@repo/database";
import type { PortfolioSnapshot, SnapshotAllocation } from "@repo/database";
import type { AllocationCreateInput } from "../utils/snapshot-converters.js";

export type PortfolioSnapshotWithAllocations = PortfolioSnapshot & {
  allocationRows: SnapshotAllocation[];
};

const includeAllocations = { allocationRows: true } as const;

export async function createSnapshot(data: {
  quantId: string;
  thesisSummary: string;
  allocations: readonly AllocationCreateInput[];
  changes: string[];
  sourceTweetIds: string[];
  createdAt?: Date;
}): Promise<PortfolioSnapshotWithAllocations> {
  return prisma.portfolioSnapshot.create({
    data: {
      quantId: data.quantId,
      thesisSummary: data.thesisSummary,
      changes: data.changes,
      sourceTweetIds: data.sourceTweetIds,
      ...(data.createdAt ? { createdAt: data.createdAt } : {}),
      allocationRows: {
        create: data.allocations.map((a) => ({
          asset: a.asset,
          mint: a.mint ?? null,
          tokenId: a.tokenId ?? null,
          percentage: a.percentage,
          conviction: a.conviction,
          reasoning: a.reasoning,
          since: a.since,
          lastSignal: a.lastSignal,
        })),
      },
    },
    include: includeAllocations,
  });
}

export async function findLatestSnapshot(
  quantId: string,
): Promise<PortfolioSnapshotWithAllocations | null> {
  return prisma.portfolioSnapshot.findFirst({
    where: { quantId },
    orderBy: { createdAt: "desc" },
    include: includeAllocations,
  });
}

export async function findEarliestSnapshot(
  quantId: string,
): Promise<PortfolioSnapshotWithAllocations | null> {
  return prisma.portfolioSnapshot.findFirst({
    where: { quantId },
    orderBy: { createdAt: "asc" },
    include: includeAllocations,
  });
}

export async function deleteAllSnapshots(quantId: string): Promise<number> {
  const result = await prisma.portfolioSnapshot.deleteMany({
    where: { quantId },
  });
  return result.count;
}

export async function findSnapshotHistory(
  quantId: string,
  limit = 50,
): Promise<PortfolioSnapshotWithAllocations[]> {
  return prisma.portfolioSnapshot.findMany({
    where: { quantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: includeAllocations,
  });
}
