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
